import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  CatalogStatusSchema,
  courseEndpoints,
  trainingCatalogEndpoints,
  type CatalogStatus,
  type CourseCard,
  type CourseLifecycle,
  type CourseListQuery,
  type Page,
} from '@lms/contracts';
import { confirm, type DataTableSort, type MenuEntry } from '@lms/ui';
import { filter, switchMap } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import { LEVEL_LABEL } from '../../../../shared/course/course-labels';
import { courseCatalogStatus } from '../../../../shared/status/catalog-status';

export const COURSES_PAGE_SIZE = 10;

/** A table column's key to the sort field the backend accepts. */
const SORT_FIELD: Readonly<Record<string, string>> = {
  title: 'title',
  updated: 'updateTime',
};

export interface CourseRow {
  readonly id: string;
  readonly card: CourseCard;
  readonly title: string;
  readonly programName: string;
  readonly level: string;
  readonly status: CatalogStatus;
}

/** What the row menu can do; publishing happens in the editor, where the draft is. */
export type CourseAction =
  | 'copy'
  | 'share'
  | 'pause'
  | 'resume'
  | 'archive'
  | 'assign';

const STATE_COPY: Record<
  CourseLifecycle,
  { verb: string; message: string; tone: 'primary' | 'warning' }
> = {
  active: {
    verb: 'Mở lại',
    message: 'Học viên được giao học tiếp được ngay.',
    tone: 'primary',
  },
  paused: {
    verb: 'Tạm dừng',
    message: 'Học viên tạm thời không học tiếp được, tiến độ được giữ nguyên.',
    tone: 'warning',
  },
  archived: {
    verb: 'Lưu trữ',
    message:
      'Khóa học ngừng hẳn và không giao thêm được. Lịch sử học tập được giữ.',
    tone: 'warning',
  },
};

/**
 * The authoring list of courses (the mockup's `adminCourses`): the courses the caller may manage,
 * filtered, sorted and paged by the server, with the row commands the backend has: copy, pause,
 * resume and archive. A course is never deleted.
 */
@Injectable()
export class CoursesStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    query: signal(''),
    fieldId: signal<number | undefined>(undefined),
    status: signal<CatalogStatus | ''>(''),
    sort: signal<DataTableSort | null>({ key: 'updated', dir: 'desc' }),
    page: signal(1),
    /** The course being copied: the drawer asks for the new code. */
    copying: signal<CourseRow | null>(null),
    /** The course whose shares the drawer shows. */
    sharing: signal<CourseRow | null>(null),
    /** The last page the server sent: the table stays while the next one loads. */
    shown: linkedSignal<
      Page<CourseCard> | undefined,
      Page<CourseCard> | undefined
    >({
      source: () => this.listData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  private readonly orgId = computed(() => this.session.user$()?.org?.id);

  private readonly request = computed((): CourseListQuery => {
    const { query, fieldId, status, sort, page } = this.state;
    const order = sort();
    const field = order ? SORT_FIELD[order.key] : undefined;
    return {
      page: page() - 1,
      size: COURSES_PAGE_SIZE,
      ...(query().trim() ? { q: query().trim().slice(0, 100) } : {}),
      ...(fieldId() ? { fieldId: fieldId() } : {}),
      ...(status() ? { state: status() } : {}),
      ...(field && order ? { sort: `${field},${order.dir}` } : {}),
    };
  });

  private readonly changes = invalidation();

  private readonly listData = serverData(
    (query: CourseListQuery) =>
      this.client.call(courseEndpoints.instructorCourses, { query }),
    { params: () => this.request(), reloadOn: this.changes },
  );

  private readonly fieldsData = serverData(
    (ownerOrgId: number) =>
      this.client.call(trainingCatalogEndpoints.listFields, {
        query: { ownerOrgId, size: 100 },
      }),
    { params: () => this.orgId() },
  );

  private readonly programsData = serverData(
    (ownerOrgId: number) =>
      this.client.call(trainingCatalogEndpoints.listPrograms, {
        query: { ownerOrgId, size: 100 },
      }),
    { params: () => this.orgId() },
  );

  /** The card carries no `rowVersion`: the course is read first for the one to send. */
  private readonly stateMutation = serverMutation(
    ({ courseId, status }: { courseId: number; status: CourseLifecycle }) =>
      this.client
        .call(courseEndpoints.getCourse, { params: { courseId }, query: {} })
        .pipe(
          switchMap(({ course }) =>
            this.client.call(courseEndpoints.changeState, {
              params: { courseId },
              body: { expectedVersion: course.rowVersion, status },
            }),
          ),
        ),
    {
      errors: 'toast',
      success: ({ status }) =>
        `Đã ${STATE_COPY[status].verb.toLowerCase()} khóa học`,
      invalidates: this.changes,
    },
  );

  private readonly copyMutation = serverMutation(
    ({ courseId, code }: { courseId: number; code: string }) =>
      this.client.call(courseEndpoints.copyCourse, {
        params: { courseId },
        body: { code },
      }),
    {
      errors: 'toast',
      success: (_input, copy) => ({
        title: 'Đã sao chép khóa học',
        detail: `Bản sao ${copy.course.code} ở trạng thái Nháp.`,
      }),
      onSuccess: () => this.setCopying(null),
      invalidates: this.changes,
    },
  );

  // Selectors
  readonly query$ = this.state.query.asReadonly();
  readonly fieldId$ = this.state.fieldId.asReadonly();
  readonly status$ = this.state.status.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly page$ = this.state.page.asReadonly();
  readonly copying$ = this.state.copying.asReadonly();
  readonly sharing$ = this.state.sharing.asReadonly();

  readonly fields$ = computed(() => this.fieldsData.value()?.items ?? []);
  readonly isLoading$ = computed(
    () => this.listData.isLoading() && this.state.shown() === undefined,
  );
  readonly loadError$ = this.listData.error;
  readonly isCopying$ = this.copyMutation.isPending;
  readonly isChangingState$ = this.stateMutation.isPending;
  readonly total$ = computed(() => this.state.shown()?.totalElements ?? 0);
  readonly hasFilters$ = computed(
    () =>
      !!this.state.query().trim() ||
      this.state.fieldId() !== undefined ||
      this.state.status() !== '',
  );

  private readonly programNames = computed(
    () =>
      new Map(
        (this.programsData.value()?.items ?? []).map((p) => [p.id, p.name]),
      ),
  );

  readonly rows$ = computed((): readonly CourseRow[] =>
    (this.state.shown()?.items ?? []).map((card) => ({
      id: String(card.courseId),
      card,
      title: card.title || 'Chưa đặt tên',
      programName:
        (card.programId && this.programNames().get(card.programId)) ||
        'Chưa chọn chương trình',
      level: card.level ? LEVEL_LABEL[card.level] : '',
      status: courseCatalogStatus(card),
    })),
  );

  /** The row menu: what the course's state allows. */
  menuFor(row: CourseRow): readonly MenuEntry<CourseAction>[] {
    const lifecycle = row.card.lifecycleStatus?.toLowerCase();
    return [
      { kind: 'item', value: 'copy', label: 'Sao chép khóa học', icon: 'copy' },
      {
        kind: 'item',
        value: 'share',
        label: 'Chia sẻ cho đơn vị',
        icon: 'globe',
      },
      ...(lifecycle === 'paused' || lifecycle === 'archived'
        ? [
            {
              kind: 'item' as const,
              value: 'resume' as const,
              label: 'Mở lại',
              icon: 'play' as const,
            },
          ]
        : [
            {
              kind: 'item' as const,
              value: 'pause' as const,
              label: 'Tạm dừng',
              icon: 'circle-pause' as const,
            },
          ]),
      ...(lifecycle === 'archived'
        ? []
        : [
            {
              kind: 'item' as const,
              value: 'archive' as const,
              label: 'Lưu trữ',
              icon: 'archive' as const,
            },
          ]),
      { kind: 'separator' },
      {
        kind: 'item',
        value: 'assign',
        label: 'Giao học',
        icon: 'calendar',
        disabled: row.status !== 'published',
      },
    ];
  }

  // Setters
  private setQuery(query: string): void {
    this.state.query.set(query);
  }

  private setFieldId(fieldId: number | undefined): void {
    this.state.fieldId.set(fieldId);
  }

  private setStatus(status: CatalogStatus | ''): void {
    this.state.status.set(status);
  }

  private setSort(sort: DataTableSort | null): void {
    this.state.sort.set(sort);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  private setCopying(row: CourseRow | null): void {
    this.state.copying.set(row);
  }

  private setSharing(row: CourseRow | null): void {
    this.state.sharing.set(row);
  }

  // Commands
  search(query: string): void {
    this.setQuery(query);
    this.setPage(1);
  }

  filterField(value: string): void {
    const id = Number(value);
    this.setFieldId(Number.isInteger(id) && id > 0 ? id : undefined);
    this.setPage(1);
  }

  filterStatus(value: string): void {
    const status = CatalogStatusSchema.safeParse(value);
    this.setStatus(status.success ? status.data : '');
    this.setPage(1);
  }

  sortBy(sort: DataTableSort): void {
    this.setSort(sort);
    this.setPage(1);
  }

  goToPage(page: number): void {
    this.setPage(page);
  }

  retryLoad(): void {
    this.listData.reload();
  }

  act(row: CourseRow, action: CourseAction): void {
    switch (action) {
      case 'copy':
        this.copyMutation.reset();
        this.setCopying(row);
        return;
      case 'share':
        this.setSharing(row);
        return;
      case 'assign':
        void this.router.navigate(['/admin/assignments'], {
          queryParams: { course: row.card.courseId },
        });
        return;
      case 'pause':
        return this.changeState(row, 'paused');
      case 'resume':
        return this.changeState(row, 'active');
      case 'archive':
        return this.changeState(row, 'archived');
    }
  }

  cancelCopy(): void {
    this.setCopying(null);
  }

  closeShares(): void {
    this.setSharing(null);
  }

  copy(code: string): void {
    const row = this.state.copying();
    if (row) this.copyMutation.run({ courseId: row.card.courseId, code });
  }

  /** Asks first: pausing and archiving reach every learner of the course. */
  private changeState(row: CourseRow, status: CourseLifecycle): void {
    const copy = STATE_COPY[status];
    confirm(this.dialog, {
      title: `${copy.verb} "${row.title}"?`,
      message: copy.message,
      confirmLabel: copy.verb,
      tone: copy.tone,
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.stateMutation.run({ courseId: row.card.courseId, status }),
      );
  }
}
