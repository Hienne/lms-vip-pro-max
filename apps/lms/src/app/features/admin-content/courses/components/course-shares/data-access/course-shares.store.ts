import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  courseEndpoints,
  organizationEndpoints,
  type CourseShare,
  type ShareCourseCommand,
} from '@lms/contracts';
import { confirm, type MenuEntry } from '@lms/ui';
import { catchError, EMPTY, expand, filter, of, reduce } from 'rxjs';
import { invalidation } from '../../../../../../core/data-access/invalidation';
import { serverData } from '../../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../../../core/http/endpoint-client';
import { CoursesStore } from '../../../data-access/courses.store';

/** How many units the search offers at most; the owner and shared ones are taken out of them. */
const OPTIONS_PAGE_SIZE = 20;
/** The names of the shared units come from the caller's orgs: pages of 100, at most five. */
const NAMES_PAGE_SIZE = 100;
const NAMES_MAX_PAGES = 5;

/** The three things a share lets the unit do. */
export type ShareRights = Pick<
  ShareCourseCommand,
  'includeDescendants' | 'canAssign' | 'canSelfEnroll'
>;

const RIGHT_LABEL: readonly (readonly [keyof ShareRights, string])[] = [
  ['includeDescendants', 'Gồm đơn vị con'],
  ['canAssign', 'Được giao học'],
  ['canSelfEnroll', 'Học viên tự đăng ký'],
];

/** A unit the add form can pick. */
export interface OrgOption {
  readonly id: number;
  readonly name: string;
  readonly code: string;
}

export interface ShareRow {
  readonly share: CourseShare;
  readonly name: string;
  /** The rights that are on, as text; no chip per right. */
  readonly rights: string;
}

export type ShareAction = 'edit' | 'revoke' | 'reshare';

const unitName = (orgId: number): string => `Đơn vị #${orgId}`;

/**
 * The sharing of one course (SPEC-course-sharing): who it is shared with and what each unit may
 * do, and the commands that add, change and revoke a share. Provided by the drawer content; the
 * course is the one `CoursesStore` is sharing. Every PUT carries the full command, and a revoke
 * is the same row with `active: false`.
 */
@Injectable()
export class CourseSharesStore {
  private readonly client = inject(EndpointClient);
  private readonly parent = inject(CoursesStore);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    /** The add form is open. */
    adding: signal(false),
    /** The unit whose rights are being edited inline. */
    editingOrgId: signal<number | null>(null),
    /** What the author typed in the unit search (already paused by the picker). */
    orgQuery: signal(''),
    pickedOrg: signal<OrgOption | null>(null),
  };

  private readonly courseId = computed(
    () => this.parent.sharing$()?.card.courseId,
  );

  private readonly changes = invalidation();

  private readonly sharesData = serverData(
    (courseId: number) =>
      this.client.call(courseEndpoints.shares, { params: { courseId } }),
    { params: () => this.courseId(), reloadOn: this.changes },
  );

  /** Gives the owner unit, which the add form must not offer. */
  private readonly courseData = serverData(
    (courseId: number) =>
      this.client.call(courseEndpoints.getCourse, {
        params: { courseId },
        query: {},
      }),
    { params: () => this.courseId() },
  );

  /**
   * The names of the caller's units. A caller who cannot list units gets none, and every unit then
   * shows as "Đơn vị #<id>".
   */
  private readonly namesData = serverData(
    (_courseId: number) =>
      this.client
        .call(organizationEndpoints.listOrgs, {
          query: { page: 0, size: NAMES_PAGE_SIZE },
        })
        .pipe(
          expand((page) =>
            page.page + 1 < Math.min(page.totalPages, NAMES_MAX_PAGES)
              ? this.client.call(organizationEndpoints.listOrgs, {
                  query: { page: page.page + 1, size: NAMES_PAGE_SIZE },
                })
              : EMPTY,
          ),
          reduce((names, page) => {
            for (const org of page.items) names.set(org.id, org.name);
            return names;
          }, new Map<number, string>()),
          catchError(() => of(new Map<number, string>())),
        ),
    { params: () => this.courseId() },
  );

  /** Units to pick from, read only while the add form is open. */
  private readonly optionsData = serverData(
    (q: string) =>
      this.client.call(organizationEndpoints.listOrgs, {
        query: {
          ...(q ? { q } : {}),
          status: 'active',
          size: OPTIONS_PAGE_SIZE,
        },
      }),
    { params: () => (this.state.adding() ? this.state.orgQuery() : undefined) },
  );

  private readonly saveMutation = serverMutation(
    (command: ShareCourseCommand) =>
      this.client.call(courseEndpoints.share, {
        params: { courseId: this.courseId() as number },
        body: command,
      }),
    {
      errors: 'toast',
      success: () => 'Đã cập nhật chia sẻ',
      onSuccess: (share) => this.settled(share),
      invalidates: this.changes,
    },
  );

  // Selectors
  readonly adding$ = this.state.adding.asReadonly();
  readonly editingOrgId$ = this.state.editingOrgId.asReadonly();
  readonly pickedOrg$ = this.state.pickedOrg.asReadonly();
  readonly isSaving$ = this.saveMutation.isPending;
  readonly isLoading$ = this.sharesData.isLoading;
  readonly loadError$ = this.sharesData.error;
  readonly optionsError$ = this.optionsData.error;
  readonly isSearching$ = this.optionsData.isLoading;

  private readonly names = computed(
    () => this.namesData.value() ?? new Map<number, string>(),
  );

  private readonly nameOf = (orgId: number): string =>
    this.names().get(orgId) ?? unitName(orgId);

  readonly ownerName$ = computed(() => {
    const ownerOrgId = this.courseData.value()?.course.ownerOrgId;
    return ownerOrgId === undefined ? undefined : this.nameOf(ownerOrgId);
  });

  private readonly rows = computed((): readonly ShareRow[] =>
    (this.sharesData.value() ?? [])
      .map((share) => ({
        share,
        name: this.nameOf(share.orgId),
        rights:
          RIGHT_LABEL.filter(([key]) => share[key])
            .map(([, label]) => label)
            .join(' · ') || 'Chưa bật quyền nào',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
  );
  readonly active$ = computed(() =>
    this.rows().filter((row) => row.share.status === 'active'),
  );
  readonly revoked$ = computed(() =>
    this.rows().filter((row) => row.share.status === 'revoked'),
  );

  readonly options$ = computed((): readonly OrgOption[] => {
    const ownerOrgId = this.courseData.value()?.course.ownerOrgId;
    const shared = new Set(this.active$().map((row) => row.share.orgId));
    return (this.optionsData.value()?.items ?? [])
      .filter((org) => org.id !== ownerOrgId && !shared.has(org.id))
      .map(({ id, name, code }) => ({ id, name, code }));
  });

  /** The row menu: an active share can be changed or revoked, a revoked one shared again. */
  menuFor(row: ShareRow): readonly MenuEntry<ShareAction>[] {
    return row.share.status === 'active'
      ? [
          { kind: 'item', value: 'edit', label: 'Sửa quyền', icon: 'pen-line' },
          {
            kind: 'item',
            value: 'revoke',
            label: 'Thu hồi',
            icon: 'x',
            tone: 'danger',
          },
        ]
      : [
          {
            kind: 'item',
            value: 'reshare',
            label: 'Chia sẻ lại',
            icon: 'globe',
          },
        ];
  }

  // Setters
  private setAdding(adding: boolean): void {
    this.state.adding.set(adding);
  }

  private setEditingOrgId(orgId: number | null): void {
    this.state.editingOrgId.set(orgId);
  }

  private setOrgQuery(query: string): void {
    this.state.orgQuery.set(query);
  }

  private setPickedOrg(org: OrgOption | null): void {
    this.state.pickedOrg.set(org);
  }

  // Commands
  retryLoad(): void {
    this.sharesData.reload();
  }

  startAdd(): void {
    this.saveMutation.reset();
    this.setEditingOrgId(null);
    this.setAdding(true);
  }

  cancelAdd(): void {
    this.closeAdd();
  }

  search(query: string): void {
    this.setOrgQuery(query.trim().slice(0, 100));
  }

  pick(org: OrgOption | null): void {
    this.setPickedOrg(org);
  }

  add(rights: ShareRights): void {
    const org = this.state.pickedOrg();
    if (!org) return;
    this.saveMutation.run({ orgId: org.id, ...rights, active: true });
  }

  cancelEdit(): void {
    this.setEditingOrgId(null);
  }

  act(row: ShareRow, action: ShareAction): void {
    switch (action) {
      case 'edit':
        this.saveMutation.reset();
        this.closeAdd();
        this.setEditingOrgId(row.share.orgId);
        return;
      case 'revoke':
        return this.revoke(row);
      case 'reshare':
        this.saveMutation.run(this.commandOf(row.share, true));
        return;
    }
  }

  saveRights(row: ShareRow, rights: ShareRights): void {
    this.saveMutation.run({ orgId: row.share.orgId, ...rights, active: true });
  }

  /** Asks first: the unit can no longer assign the course; assignments already made stay. */
  private revoke(row: ShareRow): void {
    confirm(this.dialog, {
      title: `Thu hồi chia sẻ với ${row.name}?`,
      message:
        'Đơn vị này không giao thêm được khóa học. Các lượt giao đã có vẫn giữ nguyên.',
      confirmLabel: 'Thu hồi',
      tone: 'warning',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.saveMutation.run(this.commandOf(row.share, false)));
  }

  private commandOf(share: CourseShare, active: boolean): ShareCourseCommand {
    const { orgId, includeDescendants, canAssign, canSelfEnroll } = share;
    return { orgId, includeDescendants, canAssign, canSelfEnroll, active };
  }

  /** The server accepted a row: the form it came from closes. */
  private settled(share: CourseShare): void {
    if (this.state.editingOrgId() === share.orgId) this.setEditingOrgId(null);
    if (this.state.adding() && this.state.pickedOrg()?.id === share.orgId) {
      this.closeAdd();
    }
  }

  private closeAdd(): void {
    this.setAdding(false);
    this.setPickedOrg(null);
    this.setOrgQuery('');
  }
}
