import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { reportEndpoints, type ReportDimension } from '@lms/contracts';
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
            sort: 'name,asc',
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
  readonly displayRows$ = computed(() =>
    (this.detail.value()?.items ?? []).map((row) => {
      const fields = row as Record<string, unknown>;
      const first = (...keys: string[]) =>
        keys
          .map((key) => fields[key])
          .find(
            (value) => value !== undefined && value !== null && value !== '',
          );
      const value = first('pct', 'score', 'avgScore', 'enrolments');
      return {
        id: String(first('id') ?? JSON.stringify(row)),
        name: String(first('name', 'title', 'quiz') ?? '—'),
        unit: String(first('unit', 'group', 'program') ?? '—'),
        status: String(first('status', 'enrolments', 'quiz') ?? '—'),
        value:
          value === undefined
            ? '—'
            : `${value}${first('pct', 'score', 'avgScore') !== undefined ? '%' : ''}`,
        date: String(first('at', 'lastAccess', 'dueAt', 'completedAt') ?? '—'),
      };
    }),
  );
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
        sort: 'name,asc',
      },
    });
  }
  retry(): void {
    if (this.dimension$()) this.detail.reload();
    else this.overview.reload();
  }
}
