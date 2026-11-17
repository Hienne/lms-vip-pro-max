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
  type OrganizationDetail,
  type OrganizationTreeNode,
  type Page,
  type TeamInfo,
} from '@lms/contracts';
import type { TreeNode } from '@lms/ui';
import { firstValueFrom } from 'rxjs';
import type { ChangeToken } from '../../../../core/data-access/invalidation';
import { toAppError, type AppError } from '../../../../core/errors/app-error';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';

/** Nodes asked for per request; every level is paged, so a node can hold more than this. */
const LEVEL_SIZE = 50;
const ROOT = 'root';
const MORE = 'more:';
const WAIT = 'wait:';
const TEAM = 'team:';
const TEAM_MORE = 'team-more:';

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
  private readonly session = inject(SessionStore, { optional: true });
  private userInteracted = false;
  private initialized = false;

  private readonly state = {
    levels: signal<Readonly<Record<string, Level>>>({}),
    teams: signal<Readonly<Record<string, Page<TeamInfo>>>>({}),
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
  readonly selectedTeam$ = computed(() => {
    const picked = this.selectedId$();
    if (!picked?.startsWith(TEAM)) return undefined;
    return Object.values(this.state.teams())
      .flatMap((page) => page.items)
      .find((team) => `${TEAM}${team.id}` === picked);
  });
  readonly selected$ = computed(() => {
    const id = this.selectedTeam$()?.orgId ?? this.selectedId$();
    return this.known().find((org) => String(org.id) === String(id));
  });
  /** The UNIT nodes read so far: the candidates for a new org's parent. */
  readonly units$ = computed(() =>
    this.known().filter((org) => org.orgType === 'UNIT'),
  );

  readonly nodes$ = computed(() => this.nodesOf(ROOT));

  private nodesOf(key: string): readonly TreeNode<OrganizationTreeNode>[] {
    const level = this.state.levels()[key];
    if (!level) return [];
    const nodes = level.items.map((org): TreeNode<OrganizationTreeNode> => {
      const children =
        org.orgType === 'DEPARTMENT'
          ? this.teamNodes(org.id)
          : !org.hasChildren
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

  private teamNodes(orgId: number): readonly TreeNode<OrganizationTreeNode>[] {
    const page = this.state.teams()[String(orgId)];
    if (!page) return [{ id: `${WAIT}team-${orgId}`, label: 'Đang tải…' }];
    const nodes: TreeNode<OrganizationTreeNode>[] = page.items.map((team) => ({
      id: `${TEAM}${team.id}`,
      label: team.name,
      icon: 'users',
    }));
    return page.page + 1 < page.totalPages
      ? [...nodes, { id: `${TEAM_MORE}${orgId}`, label: 'Xem thêm…' }]
      : nodes;
  }

  private loadTeams(orgId: number, page: number): void {
    const key = String(orgId);
    const flight = `team-${key}/${page}`;
    if (this.inFlight.has(flight)) return;
    this.inFlight.add(flight);
    const generation = this.generation;
    this.client
      .call(organizationEndpoints.listTeams, {
        params: { orgId },
        query: { page, size: LEVEL_SIZE, sort: 'name,asc' },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (generation !== this.generation) return;
          this.inFlight.delete(flight);
          this.setError(undefined);
          const picked = this.state.picked();
          const wasInThisOrg = this.state
            .teams()
            [key]?.items.some((team) => `${TEAM}${team.id}` === picked);
          if (
            result.page === 0 &&
            wasInThisOrg &&
            !result.items.some((team) => `${TEAM}${team.id}` === picked)
          ) {
            this.setPicked(key);
          }
          this.state.teams.update((teams) => ({
            ...teams,
            [key]: {
              ...result,
              items:
                result.page === 0
                  ? result.items
                  : [...(teams[key]?.items ?? []), ...result.items],
            },
          }));
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.inFlight.delete(flight);
          this.setError(toAppError(error));
        },
      });
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
          if (key === ROOT && page === 0 && !this.initialized) {
            this.initialized = true;
            void this.selectOwnOrganization(generation);
          }
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
    this.userInteracted = true;
    const opened = ids.filter((id) => !this.state.expanded().includes(id));
    this.setExpanded(ids);
    opened.forEach((id) => {
      const org = this.known().find((node) => String(node.id) === id);
      if (org?.orgType === 'DEPARTMENT') {
        if (!this.state.teams()[id]) this.loadTeams(org.id, 0);
      } else if (org) this.ensureLevel(id);
    });
  }

  /** The tree picked a node; a "Xem thêm" row loads the next page instead of being picked. */
  select(id: string | undefined): void {
    this.userInteracted = true;
    if (id === undefined || id.startsWith(WAIT)) return;
    if (id.startsWith(TEAM_MORE)) {
      const key = id.slice(TEAM_MORE.length);
      const page = this.state.teams()[key];
      if (page) this.loadTeams(Number(key), page.page + 1);
      return;
    }
    if (id.startsWith(MORE)) {
      const key = id.slice(MORE.length);
      const level = this.state.levels()[key];
      if (level) this.loadLevel(key, level.page + 1);
      return;
    }
    this.setPicked(id);
    const org = this.known().find((o) => String(o.id) === id);
    if (org?.hasChildren || org?.orgType === 'DEPARTMENT') this.open(id);
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
    [...keys]
      .filter((key) => !key.startsWith('team-'))
      .forEach((key) => this.loadLevel(key, 0));
    const teamKeys = new Set([
      ...Object.keys(this.state.teams()),
      ...[...keys]
        .filter((key) => key.startsWith('team-'))
        .map((key) => key.slice(5)),
    ]);
    teamKeys.forEach((key) => this.loadTeams(Number(key), 0));
  }

  /** Opens a node whose children may not have been read yet, so a new child shows in the tree. */
  reveal(id: number): void {
    this.open(String(id));
  }

  private open(key: string): void {
    const org = this.known().find((node) => String(node.id) === key);
    if (org?.orgType === 'DEPARTMENT') {
      if (!this.state.teams()[key]) this.loadTeams(org.id, 0);
    } else this.ensureLevel(key);
    if (!this.state.expanded().includes(key)) {
      this.setExpanded([...this.state.expanded(), key]);
    }
  }

  /** Prefer the signed-in person's organization when it is visible in the current tree. */
  private async selectOwnOrganization(generation: number): Promise<void> {
    const orgId = this.session?.user$()?.org?.id;
    if (orgId == null || this.userInteracted) return;
    try {
      const path: number[] = [];
      const visited = new Set<number>();
      let current: number | null | undefined = orgId;
      while (current != null && !visited.has(current)) {
        visited.add(current);
        path.unshift(current);
        const knownRoot = this.state
          .levels()
          [ROOT]?.items.find((node) => node.id === current);
        if (knownRoot) break;
        try {
          const detail: OrganizationDetail = await firstValueFrom(
            this.client
              .call(organizationEndpoints.getOrg, {
                params: { orgId: current },
              })
              .pipe(takeUntilDestroyed(this.destroyRef)),
          );
          current = detail.organization.parentId;
        } catch {
          path.shift();
          break;
        }
      }
      let levelKey = ROOT;
      for (const id of path) {
        if (this.userInteracted || generation !== this.generation) return;
        let level = this.state.levels()[levelKey];
        while (
          level &&
          !level.items.some((node) => node.id === id) &&
          level.page + 1 < level.totalPages
        ) {
          const result = await firstValueFrom(
            this.client
              .call(organizationEndpoints.orgTree, {
                query: {
                  ...(levelKey === ROOT ? {} : { parentId: Number(levelKey) }),
                  page: level.page + 1,
                  size: LEVEL_SIZE,
                },
              })
              .pipe(takeUntilDestroyed(this.destroyRef)),
          );
          if (this.userInteracted || generation !== this.generation) return;
          this.addLevelPage(levelKey, result);
          level = this.state.levels()[levelKey];
        }
        if (!level?.items.some((node) => node.id === id)) return;
        if (id === orgId) {
          this.setPicked(String(id));
          const node = this.known().find((org) => org.id === id);
          if (node?.orgType === 'DEPARTMENT') this.open(String(id));
          return;
        }
        if (!this.state.expanded().includes(String(id))) {
          this.setExpanded([...this.state.expanded(), String(id)]);
        }
        if (!this.state.levels()[String(id)]) {
          const result = await firstValueFrom(
            this.client
              .call(organizationEndpoints.orgTree, {
                query: { parentId: id, page: 0, size: LEVEL_SIZE },
              })
              .pipe(takeUntilDestroyed(this.destroyRef)),
          );
          if (this.userInteracted || generation !== this.generation) return;
          this.addLevelPage(String(id), result);
        }
        levelKey = String(id);
      }
    } catch {
      // A missing or inaccessible organization leaves the normal scoped tree usable.
    }
  }

  /** Select a visible child, loading its tree pages so both panels share the same selection. */
  async selectChild(child: OrganizationTreeNode): Promise<void> {
    const parent = this.selected$();
    if (!parent || child.parentId !== parent.id) return;
    this.userInteracted = true;
    const generation = this.generation;
    const key = String(parent.id);
    if (!this.state.expanded().includes(key))
      this.setExpanded([...this.state.expanded(), key]);
    try {
      let level = this.state.levels()[key];
      while (
        !level ||
        (!level.items.some((node) => node.id === child.id) &&
          level.page + 1 < level.totalPages)
      ) {
        const page = level ? level.page + 1 : 0;
        const result = await firstValueFrom(
          this.client
            .call(organizationEndpoints.orgTree, {
              query: { parentId: parent.id, page, size: LEVEL_SIZE },
            })
            .pipe(takeUntilDestroyed(this.destroyRef)),
        );
        if (generation !== this.generation || this.selectedId$() !== key)
          return;
        this.addLevelPage(key, result);
        level = this.state.levels()[key];
      }
      if (level.items.some((node) => node.id === child.id))
        this.select(String(child.id));
    } catch (error: unknown) {
      this.setError(toAppError(error));
    }
  }
  /** Reads again the roots and every opened level not read yet, whichever read failed. */
  retry(): void {
    this.setError(undefined);
    [ROOT, ...this.state.expanded()].forEach((key) => {
      const org = this.known().find((node) => String(node.id) === key);
      if (org?.orgType === 'DEPARTMENT') this.loadTeams(org.id, 0);
      else this.ensureLevel(key);
    });
  }
}
