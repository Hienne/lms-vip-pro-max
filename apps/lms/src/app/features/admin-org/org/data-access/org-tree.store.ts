import {
  computed,
  DestroyRef,
  inject,
  effect,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  organizationEndpoints,
  type OrganizationTreeNode,
  type Page,
} from '@lms/contracts';
import type { TreeNode } from '@lms/ui';
import type { ChangeToken } from '../../../../core/data-access/invalidation';
import { toAppError, type AppError } from '../../../../core/errors/app-error';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/** Nodes asked for per request; every level is paged, so a node can hold more than this. */
const LEVEL_SIZE = 50;
const ROOT = 'root';
const MORE = 'more:';
const WAIT = 'wait:';

interface Level {
  readonly items: readonly OrganizationTreeNode[];
  /** The last page loaded (0-based). */
  readonly page: number;
  readonly totalPages: number;
}

/**
 * The org tree, loaded lazily from `GET /orgs/tree`: the roots in scope without `parentId`, a
 * node's children with it when the node is opened or picked, each level one page at a time ("Xem
 * thêm" asks the next). A node the server says `hasChildren` carries a placeholder child until its
 * level is read, so the tree shows it as openable; any other node is a leaf. A root whose parent
 * is out of scope stays a root: its parent is never read. Reads here are one level at a time and
 * concurrent, which `serverData` (one value per store) does not model, so the store subscribes
 * itself. `reloadOn` reads the loaded levels again when the org change token is bumped, so a
 * mutation only has to invalidate; an answer to a read made before that reload is dropped.
 */
@Injectable()
export class OrgTreeStore {
  private readonly client = inject(EndpointClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    levels: signal<Readonly<Record<string, Level>>>({}),
    expanded: signal<readonly string[]>([]),
    picked: signal<string | undefined>(undefined),
    error: signal<AppError | undefined>(undefined),
  };
  private readonly inFlight = new Set<string>();
  /** Bumped by a reload; a level answer from an older generation is stale. */
  private generation = 0;

  constructor() {
    this.loadLevel(ROOT, 0);
  }

  readonly expanded$ = this.state.expanded.asReadonly();
  readonly loadError$ = this.state.error.asReadonly();
  readonly isLoading$ = computed(
    () => this.state.levels()[ROOT] === undefined && !this.state.error(),
  );

  /** Every node read so far. */
  private readonly known = computed(() =>
    Object.values(this.state.levels()).flatMap((level) => level.items),
  );

  /** The picked org's id, or the first root until one is picked. */
  readonly selectedId$ = computed(
    () =>
      this.state.picked() ?? this.state.levels()[ROOT]?.items[0]?.id.toString(),
  );
  readonly selected$ = computed(() =>
    this.known().find((org) => String(org.id) === this.selectedId$()),
  );
  /** The UNIT nodes read so far: the candidates for a new org's parent. */
  readonly units$ = computed(() =>
    this.known().filter((org) => org.orgType === 'UNIT'),
  );

  readonly nodes$ = computed(() => this.nodesOf(ROOT));

  private nodesOf(key: string): readonly TreeNode<OrganizationTreeNode>[] {
    const level = this.state.levels()[key];
    if (!level) return [];
    const nodes = level.items.map((org): TreeNode<OrganizationTreeNode> => {
      const children = !org.hasChildren
        ? []
        : this.state.levels()[String(org.id)]
          ? this.nodesOf(String(org.id))
          : [{ id: `${WAIT}${org.id}`, label: 'Đang tải…' }];
      return {
        id: String(org.id),
        label: org.name,
        icon: org.orgType === 'UNIT' ? 'building-2' : 'layers',
        data: org,
        children: children.length ? children : undefined,
      };
    });
    return level.page + 1 < level.totalPages
      ? [...nodes, { id: `${MORE}${key}`, label: 'Xem thêm…' }]
      : nodes;
  }

  private loadLevel(key: string, page: number): void {
    const flight = `${key}/${page}`;
    if (this.inFlight.has(flight)) return;
    this.inFlight.add(flight);
    const generation = this.generation;
    const parent = key === ROOT ? {} : { parentId: Number(key) };
    this.client
      .call(organizationEndpoints.orgTree, {
        query: { ...parent, page, size: LEVEL_SIZE },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (generation !== this.generation) return;
          this.inFlight.delete(flight);
          this.setError(undefined);
          this.addLevelPage(key, result);
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.inFlight.delete(flight);
          this.setError(toAppError(error));
        },
      });
  }

  private ensureLevel(id: string): void {
    if (this.state.levels()[id] === undefined) this.loadLevel(id, 0);
  }

  // Setters: the only writers of state
  private setError(error: AppError | undefined): void {
    this.state.error.set(error);
  }

  private setPicked(id: string): void {
    this.state.picked.set(id);
  }

  private setExpanded(ids: readonly string[]): void {
    this.state.expanded.set(ids);
  }

  /** Stores a page of a level: the first page replaces it, a later page is appended. */
  private addLevelPage(key: string, result: Page<OrganizationTreeNode>): void {
    this.state.levels.update((levels) => ({
      ...levels,
      [key]: {
        items:
          result.page === 0
            ? result.items
            : [...(levels[key]?.items ?? []), ...result.items],
        page: result.page,
        totalPages: result.totalPages,
      },
    }));
  }

  // Commands
  /** The tree opened or closed nodes: read the children of each newly opened one. */
  expand(ids: readonly string[]): void {
    const opened = ids.filter((id) => !this.state.expanded().includes(id));
    this.setExpanded(ids);
    opened.forEach((id) => this.ensureLevel(id));
  }

  /** The tree picked a node; a "Xem thêm" row loads the next page instead of being picked. */
  select(id: string | undefined): void {
    if (id === undefined || id.startsWith(WAIT)) return;
    if (id.startsWith(MORE)) {
      const key = id.slice(MORE.length);
      const level = this.state.levels()[key];
      if (level) this.loadLevel(key, level.page + 1);
      return;
    }
    this.setPicked(id);
    const org = this.known().find((o) => String(o.id) === id);
    if (org?.hasChildren) this.open(id);
  }

  /**
   * Reads the loaded levels again (first page) whenever `token` is bumped. Call it once, from the
   * owner's constructor: the effect lives as long as this store.
   */
  reloadOn(token: ChangeToken): void {
    let seen = untracked(token.version);
    effect(() => {
      const version = token.version();
      if (version === seen) return;
      seen = version;
      untracked(() => this.refresh());
    });
  }

  /** Reads again, from the first page, every loaded level and every level still being read. */
  private refresh(): void {
    const keys = new Set([
      ...Object.keys(this.state.levels()),
      ...[...this.inFlight].map((flight) => flight.split('/')[0]),
    ]);
    this.generation++;
    this.inFlight.clear();
    keys.forEach((key) => this.loadLevel(key, 0));
  }

  /** Opens a node whose children may not have been read yet, so a new child shows in the tree. */
  reveal(id: number): void {
    this.open(String(id));
  }

  private open(key: string): void {
    this.ensureLevel(key);
    if (!this.state.expanded().includes(key)) {
      this.setExpanded([...this.state.expanded(), key]);
    }
  }

  /** Reads again the roots and every opened level not read yet, whichever read failed. */
  retry(): void {
    this.setError(undefined);
    [ROOT, ...this.state.expanded()].forEach((key) => this.ensureLevel(key));
  }
}
