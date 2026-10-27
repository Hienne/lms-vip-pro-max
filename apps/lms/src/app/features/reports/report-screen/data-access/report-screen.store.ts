import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { reportEndpoints, type ReportDimension } from '@lms/contracts';
import type { DataTableSort, DataTableColumn, DonutDatum } from '@lms/ui';

export const REPORT_DIMENSIONS = [
  { id: 'learners', label: 'Học viên' },
  { id: 'courses', label: 'Khóa học' },
  { id: 'programs', label: 'Chương trình' },
  { id: 'groups', label: 'Phòng / nhóm' },
  { id: 'units', label: 'Đơn vị' },
  { id: 'status', label: 'Trạng thái hoàn thành' },
  { id: 'results', label: 'Kết quả kiểm tra' },
  { id: 'competency', label: 'Năng lực theo nhóm kiến thức' },
] as const;
const statusLabel: Record<string, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang học',
  completed: 'Đã hoàn thành',
  failed: 'Chưa đạt',
};
const dateText = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
const pct = (value: number | null) => (value === null ? '—' : `${value}%`);
import { FileSaver } from '../../../../core/files/file-saver';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';

const dimensions: readonly ReportDimension[] = [
  'learners',
  'courses',
  'programs',
  'groups',
  'units',
  'status',
  'results',
  'competency',
];
@Injectable()
export class ReportScreenStore {
  private readonly client = inject(EndpointClient);
  private readonly saver = inject(FileSaver);
  private readonly route = inject(ActivatedRoute);
  private readonly routeParams = toSignal(this.route.paramMap);
  private readonly state = {
    unitId: signal(''),
    groupId: signal(''),
    programId: signal(''),
    courseId: signal(''),
    period: signal(''),
    page: signal(0),
    q: signal(''),
    sort: signal<DataTableSort>({ key: 'name', dir: 'asc' }),
  };
  private readonly changes = invalidation();
  private readonly filters = computed(() => {
    const period = this.state.period();
    const from = period
      ? new Date(Date.now() - Number(period) * 86400000).toISOString()
      : undefined;
    return {
      unitId: this.state.unitId() || undefined,
      groupId: this.state.groupId() || undefined,
      programId: this.state.programId() || undefined,
      courseId: this.state.courseId() || undefined,
      from,
    };
  });
  private readonly overview = serverData(
    (query: ReturnType<typeof this.filters>) =>
      this.client.call(reportEndpoints.overview, { query }),
    { params: () => this.filters(), reloadOn: this.changes },
  );
  private readonly detail = serverData(
    (params: {
      dim: ReportDimension;
      query: {
        unitId?: string;
        groupId?: string;
        programId?: string;
        courseId?: string;
        from?: string;
        q?: string;
        page: number;
        size: number;
        sort: string;
      };
    }) =>
      this.client.call(reportEndpoints.detail, {
        params: { dim: params.dim },
        query: params.query,
      }),
    {
      params: () => {
        const value = this.routeParams()?.get('dim');
        if (!value || !dimensions.includes(value as ReportDimension))
          return undefined;
        return {
          dim: value as ReportDimension,
          query: {
            ...this.filters(),
            q: this.state.q() || undefined,
            page: this.state.page(),
            size: 20,
            sort: `${this.state.sort().key},${this.state.sort().dir}`,
          },
        };
      },
      reloadOn: this.changes,
    },
  );
  private readonly exportMutation = serverMutation(
    (input: {
      dim: 'overview' | ReportDimension;
      query: {
        unitId?: string;
        groupId?: string;
        programId?: string;
        courseId?: string;
        from?: string;
        q?: string;
        sort: string;
      };
    }) =>
      this.client.call(reportEndpoints.export, {
        query: { ...input.query, dim: input.dim },
      }),
    {
      errors: 'toast',
      success: () => 'Đã xuất báo cáo CSV',
      onSuccess: (blob) =>
        this.saver.save(
          blob,
          `bao-cao-${this.dimension$() ?? 'tong-quan'}.csv`,
        ),
    },
  );
  readonly dimension$ = computed(() => {
    const value = this.routeParams()?.get('dim');
    return value && dimensions.includes(value as ReportDimension)
      ? (value as ReportDimension)
      : null;
  });
  readonly overview$ = this.overview.value;
  readonly detail$ = this.detail.value;
  readonly dimensionLabel$ = computed(
    () =>
      REPORT_DIMENSIONS.find((d) => d.id === this.dimension$())?.label ??
      'Báo cáo',
  );
  readonly period$ = this.state.period.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly groups$ = computed(
    () =>
      this.overview$()?.filters.groups.filter(
        (g) => !this.state.unitId() || g.unitId === this.state.unitId(),
      ) ?? [],
  );
  readonly weeks$ = computed(
    () =>
      this.overview$()?.weeks.map((w) => ({
        label: new Date(w.weekStart).toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
        }),
        value: w.completedLessons,
      })) ?? [],
  );
  readonly statusParts$ = computed((): readonly DonutDatum[] => {
    const t = this.overview$()?.total;
    return t
      ? [
          { label: 'Đã hoàn thành', value: t.completed, tone: 'success' },
          { label: 'Đang học', value: t.inProgress, tone: 'primary' },
          { label: 'Chưa bắt đầu', value: t.notStarted, tone: 'neutral' },
          { label: 'Chưa đạt', value: t.failed, tone: 'danger' },
        ]
      : [];
  });
  readonly columns$ = computed((): readonly DataTableColumn[] => {
    const dim = this.dimension$();
    const pairs: readonly (readonly [string, string])[] =
      dim === 'learners'
        ? [
            ['name', 'Học viên'],
            ['email', 'Email'],
            ['unit', 'Đơn vị'],
            ['group', 'Phòng/nhóm'],
            ['courses', 'Khóa'],
            ['pct', 'Tiến độ'],
            ['overdue', 'Quá hạn'],
            ['failed', 'Chưa đạt'],
            ['avgScore', 'Điểm TB'],
            ['lastAccess', 'Truy cập'],
          ]
        : dim === 'status'
          ? [
              ['name', 'Học viên'],
              ['course', 'Khóa học'],
              ['group', 'Phòng/nhóm'],
              ['status', 'Trạng thái'],
              ['pct', 'Tiến độ'],
              ['startedAt', 'Bắt đầu'],
              ['completedAt', 'Hoàn thành'],
              ['dueAt', 'Hạn'],
            ]
          : dim === 'results'
            ? [
                ['name', 'Học viên'],
                ['unit', 'Đơn vị'],
                ['quiz', 'Bài kiểm tra'],
                ['nth', 'Lần'],
                ['score', 'Điểm'],
                ['passed', 'Kết quả'],
                ['at', 'Ngày'],
              ]
            : dim === 'competency'
              ? [
                  ['name', 'Học viên'],
                  ['unit', 'Đơn vị'],
                  ...(this.overview$()?.competency ?? []).map(
                    (c) => [c.id, c.name] as const,
                  ),
                ]
              : [
                  ['name', this.dimensionLabel$()],
                  ['learners', 'Học viên'],
                  ['enrolments', 'Lượt tham gia'],
                  ['pct', 'Tiến độ TB'],
                  ['completed', 'Hoàn thành'],
                  ['inProgress', 'Đang học'],
                  ['notStarted', 'Chưa bắt đầu'],
                  ['overdue', 'Quá hạn'],
                  ['avgScore', 'Điểm TB'],
                  ['passRate', 'Tỷ lệ đạt'],
                ];
    return pairs.map(([key, label]) => ({
      key,
      label,
      sortable: dim !== 'competency' || key === 'name' || key === 'unit',
    }));
  });
  readonly displayRows$ = computed(
    (): readonly ({ id: string } & Record<string, string | number>)[] =>
      (this.detail$()?.items ?? []).map((row) => {
        if ('values' in row)
          return {
            id: row.id,
            name: row.name,
            unit: row.unit,
            ...Object.fromEntries(
              row.values.map((v) => [v.competencyId, pct(v.value)]),
            ),
          };
        if ('quiz' in row)
          return {
            ...row,
            score: pct(row.score),
            passed: row.passed ? 'Đạt' : 'Chưa đạt',
            at: dateText(row.at),
            autoSubmitted: row.autoSubmitted ? 'Tự nộp' : '',
          };
        if ('course' in row)
          return {
            ...row,
            status: statusLabel[row.status] ?? row.status,
            pct: pct(row.pct),
            overdue: row.overdue ? 'Quá hạn' : '',
            startedAt: dateText(row.startedAt),
            completedAt: dateText(row.completedAt),
            dueAt: dateText(row.dueAt),
            lastAccess: dateText(row.lastAccess),
          };
        if ('email' in row)
          return {
            ...row,
            courses: `${row.completed}/${row.courses}`,
            pct: pct(row.pct),
            avgScore: pct(row.avgScore),
            lastAccess: dateText(row.lastAccess),
          };
        return {
          ...row,
          pct: pct(row.pct),
          avgScore: pct(row.avgScore),
          passRate: pct(row.passRate),
        };
      }),
  );
  setSort(sort: DataTableSort): void {
    this.state.sort.set(sort);
    this.setPage(0);
  }
  readonly filters$ = this.filters;
  readonly page$ = this.state.page.asReadonly();
  readonly query$ = this.state.q.asReadonly();
  readonly isLoading$ = computed(() =>
    this.dimension$() ? this.detail.isLoading() : this.overview.isLoading(),
  );
  readonly error$ = computed(() =>
    this.dimension$() ? this.detail.error() : this.overview.error(),
  );
  readonly isExporting$ = this.exportMutation.isPending;
  setFilter(
    key: 'unitId' | 'groupId' | 'programId' | 'courseId' | 'period',
    value: string,
  ): void {
    this.state[key].set(value);
    this.state.page.set(0);
    if (key === 'unitId') this.state.groupId.set('');
  }
  setQuery(value: string): void {
    this.state.q.set(value);
    this.state.page.set(0);
  }
  setPage(page: number): void {
    this.state.page.set(page);
  }
  export(): void {
    this.exportMutation.run({
      dim: this.dimension$() ?? 'overview',
      query: {
        ...this.filters(),
        q: this.state.q() || undefined,
        sort: `${this.sort$().key},${this.sort$().dir}`,
      },
    });
  }
  retry(): void {
    if (this.dimension$()) this.detail.reload();
    else this.overview.reload();
  }
}
