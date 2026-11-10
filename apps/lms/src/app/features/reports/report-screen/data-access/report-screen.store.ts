import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, type Observable } from 'rxjs';
import {
  assessmentReportEndpoints as api,
  AssessmentReportTypeSchema,
  type AssessmentReportType,
  type AssessmentReportFilter,
  type AssessmentReportExportQuery,
  learningReportEndpoints as learning,
  type LearningReportFilter,
  type LearningReportSummary,
  type Page,
} from '@lms/contracts';
import type { DataTableColumn, DataTableSort, DonutDatum } from '@lms/ui';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';
import {
  filtersFromQuery,
  queryFromFilters,
  TAB_FILTERS,
  tabQuery,
  type ProgressView,
  type ReportFilters,
  type ReportTab,
} from './report-query';
import { reportPickers } from './report-pickers';
import { learningFilter, progressReport } from './progress-report';

export const REPORT_DIMENSIONS = [
  { id: 'results', label: 'Kết quả từng lượt thi' },
  { id: 'learners', label: 'Tình trạng học viên' },
  { id: 'competency', label: 'Năng lực' },
  { id: 'questions', label: 'Phân tích câu hỏi' },
] as const;
const labels: Record<string, string> = {
  IN_PROGRESS: 'Đang làm',
  SUBMITTED: 'Đã nộp',
  AUTO_SUBMITTED: 'Tự nộp',
  VOIDED: 'Đã hủy',
  NOT_STARTED: 'Chưa thi',
  FAILED: 'Chưa đạt',
  PASSED: 'Đạt',
};
const SORTS: Record<AssessmentReportType, readonly string[]> = {
  results: ['id', 'startedAt', 'submittedAt', 'scorePercent'],
  learners: ['userId', 'finalScore', 'lastSubmittedAt'],
  competency: ['groupKey', 'competencyId'],
  questions: ['questionId', 'timesServed', 'wrongPercent'],
};
const DEFAULT_SORT: Record<AssessmentReportType, DataTableSort> = {
  results: { key: 'submittedAt', dir: 'desc' },
  learners: { key: 'userId', dir: 'asc' },
  competency: { key: 'groupKey', dir: 'asc' },
  questions: { key: 'wrongPercent', dir: 'desc' },
};
const COLUMNS: Record<AssessmentReportType, readonly [string, string][]> = {
  results: [
    ['userId', 'Mã cán bộ'],
    ['userName', 'Học viên'],
    ['quizTitle', 'Bài kiểm tra'],
    ['orgName', 'Đơn vị lúc thi'],
    ['teamName', 'Nhóm lúc thi'],
    ['attemptNo', 'Lần'],
    ['status', 'Trạng thái'],
    ['correctCount', 'Câu đúng'],
    ['totalQuestions', 'Số câu'],
    ['scorePercent', 'Điểm (%)'],
    ['passed', 'Kết quả'],
    ['submittedAt', 'Nộp lúc'],
  ],
  learners: [
    ['userId', 'Mã cán bộ'],
    ['userName', 'Học viên'],
    ['orgName', 'Đơn vị lúc ghi danh'],
    ['teamName', 'Nhóm lúc ghi danh'],
    ['learnerStatus', 'Trạng thái'],
    ['attemptsUsed', 'Lượt đã dùng'],
    ['attemptsLeft', 'Lượt còn lại'],
    ['bestScore', 'Cao nhất (%)'],
    ['lastScore', 'Gần nhất (%)'],
    ['finalScore', 'Điểm cuối (%)'],
    ['lastSubmittedAt', 'Nộp gần nhất'],
  ],
  competency: [
    ['groupKey', 'Mã học viên / đơn vị'],
    ['groupName', 'Tên'],
    ['competencyId', 'ID năng lực'],
    ['code', 'Mã năng lực'],
    ['name', 'Năng lực'],
    ['totalQuestions', 'Số câu'],
    ['correctCount', 'Câu đúng'],
    ['maxScore', 'Điểm tối đa'],
    ['score', 'Điểm'],
    ['percent', 'Tỷ lệ (%)'],
  ],
  questions: [
    ['questionId', 'ID câu hỏi'],
    ['questionVersion', 'Phiên bản'],
    ['code', 'Mã'],
    ['contentPreview', 'Nội dung khi thi'],
    ['timesServed', 'Lượt phát'],
    ['timesCorrect', 'Lượt đúng'],
    ['timesBlank', 'Bỏ trống'],
    ['wrongPercent', 'Sai (%)'],
  ],
};
interface ReportRow extends Record<string, string | number> {
  id: string;
}
interface TableRequest {
  type: AssessmentReportType;
  query: AssessmentReportExportQuery & { page: number; size: number };
}
/** "dd/MM/yyyy HH:mm (zone)": the instant as the server's time zone reads it. */
function asOf(summary: LearningReportSummary): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: summary.timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(summary.dataAsOf))
      .map((part) => [part.type, part.value]),
  );
  return `${parts['day']}/${parts['month']}/${parts['year']} ${parts['hour']}:${parts['minute']} (${summary.timeZone})`;
}
function row(value: object, id: string): ReportRow {
  return {
    id,
    ...Object.fromEntries(
      Object.entries(value).map(([key, value]) => [
        key,
        value == null
          ? '—'
          : typeof value === 'boolean'
            ? value
              ? 'Đạt'
              : 'Chưa đạt'
            : key.endsWith('At')
              ? new Date(String(value)).toLocaleString('vi-VN')
              : typeof value === 'string'
                ? (labels[value] ?? value)
                : value,
      ]),
    ),
  };
}
@Injectable()
export class ReportScreenStore {
  private readonly client = inject(EndpointClient);
  private readonly saver = inject(FileSaver);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap);
  private readonly queryParams = toSignal(this.route.queryParamMap);
  /** The applied filters and the page live in the URL, so a shared link opens the same report. */
  private readonly urlQuery = computed(() =>
    filtersFromQuery(this.queryParams() ?? convertToParamMap({})),
  );
  readonly dimension$ = computed(() => {
    const parsed = AssessmentReportTypeSchema.safeParse(
      this.params()?.get('dim'),
    );
    return parsed.success ? parsed.data : undefined;
  });
  /** "Tiến độ & hoàn thành", the learning progress tab. */
  readonly progress$ = computed(() => this.params()?.get('dim') === 'progress');
  readonly unsupported$ = computed(
    () =>
      !!this.params()?.get('dim') && !this.dimension$() && !this.progress$(),
  );
  /** The tab shown; `undefined` for a path no tab has. */
  readonly tab$ = computed<ReportTab | undefined>(() =>
    this.unsupported$()
      ? undefined
      : this.progress$()
        ? 'progress'
        : (this.dimension$() ?? 'overview'),
  );
  private readonly state = {
    filtersOpen: signal(false),
    sort: linkedSignal(() => DEFAULT_SORT[this.dimension$() ?? 'results']),
    grouping: signal<'quiz' | 'org'>('quiz'),
    groupPage: signal(1),
    groupPageSize: signal(10),
    pageSize: signal(20),
  };
  readonly filters$ = computed<ReportFilters>(() => this.urlQuery().filters);
  readonly page$ = computed(() => this.urlQuery().page);
  /** Rows per page of the open table; chosen in the page, not kept in the URL. */
  readonly pageSize$ = computed(() =>
    this.progress$() ? this.progress.pageSize$() : this.state.pageSize(),
  );
  /** The unit, team, course and quiz pickers, and whether the URL's ids are known to be in scope. */
  readonly pickers = reportPickers(this.filters$);
  /** The groups and the learner list of "Tiến độ & hoàn thành". */
  readonly progress = progressReport({
    filters: this.filters$,
    page: this.page$,
    active: computed(() => this.progress$() && !this.pickers.blocked$()),
  });
  readonly progressGroupLabel$ = computed(() =>
    this.progress.view$() === 'program'
      ? 'Chương trình'
      : this.progress.view$() === 'team'
        ? 'Phòng / nhóm'
        : this.progress.view$() === 'org'
          ? 'Đơn vị'
          : 'Khóa học',
  );
  readonly progressChartTitle$ = computed(
    () =>
      `Hoàn thành theo ${this.progressGroupLabel$().toLocaleLowerCase('vi')}`,
  );
  selectProgressView(value: string): void {
    if (['course', 'org', 'program', 'team', 'learners'].includes(value))
      this.selectView(value as ProgressView);
  }
  readonly progressComparison$ = computed(() =>
    this.progress
      .groups$()
      .slice(0, 6)
      .map((g) => ({ label: g.name ?? String(g.id), value: g.completionRate })),
  );
  readonly progressOverdue$ = computed(() =>
    this.progress
      .groups$()
      .filter((g) => g.overdue > 0)
      .slice(0, 6)
      .map((g) => ({ label: g.name ?? String(g.id), value: g.overdue })),
  );
  readonly filtersOpen$ = this.state.filtersOpen.asReadonly();
  setFiltersOpen(open: boolean): void {
    this.state.filtersOpen.set(open);
  }
  readonly learningChart$ = computed<readonly DonutDatum[]>(() => {
    const c = this.learning$();
    return c && c.enrollments > 0
      ? [
          { label: 'Hoàn thành', value: c.completed, tone: 'success' },
          { label: 'Đang học', value: c.inProgress, tone: 'primary' },
          { label: 'Chưa bắt đầu', value: c.notStarted, tone: 'neutral' },
        ]
      : [];
  });
  readonly primaryTabs$ = computed(() =>
    this.tabs$()
      .filter((t) => ['overview', 'progress', 'results'].includes(t.id))
      .map((t) => ({
        ...t,
        label:
          t.id === 'progress'
            ? 'Học tập'
            : t.id === 'results'
              ? 'Đánh giá'
              : t.label,
      })),
  );
  readonly assessmentTabs$ = computed(() =>
    this.tabs$().filter((t) => !['overview', 'progress'].includes(t.id)),
  );
  readonly sort$ = this.state.sort.asReadonly();
  /** The tab bar: each link keeps the current filters the tab reads. */
  readonly tabs$ = computed(() => {
    const filters = this.filters$();
    const tabs: readonly { id: ReportTab; label: string; path: string[] }[] = [
      { id: 'overview', label: 'Tổng quan', path: ['/reports'] },
      {
        id: 'progress',
        label: 'Tiến độ & hoàn thành',
        path: ['/reports', 'progress'],
      },
      ...REPORT_DIMENSIONS.map((d) => ({
        id: d.id,
        label: d.label,
        path: ['/reports', d.id],
      })),
    ];
    return tabs.map((tab) => ({
      ...tab,
      queryParams: tabQuery(tab.id, filters),
    }));
  });
  private readonly commonFilters = computed<AssessmentReportFilter>(() => {
    const { orgId, teamId, courseId, quizId, from, to } = this.filters$();
    return { orgId, teamId, courseId, quizId, from, to };
  });
  private readonly overview = serverData(
    (query: AssessmentReportFilter) =>
      this.client.call(api.overview, { query }),
    {
      params: () =>
        (!this.params()?.get('dim') || this.dimension$() === 'results') &&
        !this.pickers.blocked$()
          ? this.commonFilters()
          : undefined,
    },
  );
  /** The learning progress of the overview: by unit, team and course, never by quiz or date. */
  private readonly learningSummary = serverData(
    (query: LearningReportFilter) =>
      this.client.call(learning.summary, { query }),
    {
      params: () => {
        if (
          (!this.progress$() && this.params()?.get('dim')) ||
          this.pickers.blocked$()
        )
          return undefined;
        const { orgId, teamId, courseId } = this.filters$();
        return this.progress$()
          ? learningFilter(this.filters$())
          : { orgId, teamId, courseId };
      },
    },
  );
  private readonly tableRequest = computed<TableRequest | undefined>(() => {
    const type = this.dimension$();
    if (!type || this.pickers.blocked$()) return undefined;
    const f = this.filters$(),
      sort = this.sort$();
    const paging = {
      page: this.page$() - 1,
      size: this.state.pageSize(),
      sort: `${sort.key},${sort.dir}`,
    };
    switch (type) {
      case 'learners':
        return f.quizId
          ? {
              type,
              query: {
                quizId: f.quizId,
                orgId: f.orgId,
                teamId: f.teamId,
                learnerStatus: f.learnerStatus,
                ...paging,
              },
            }
          : undefined;
      case 'competency':
        return {
          type,
          query: {
            ...this.commonFilters(),
            groupBy: f.groupBy ?? 'user',
            ...paging,
          },
        };
      case 'results':
        return {
          type,
          query: {
            ...this.commonFilters(),
            userId: f.userId,
            status: f.status,
            passed: f.passed,
            ...paging,
          },
        };
      case 'questions':
        return { type, query: { ...this.commonFilters(), ...paging } };
    }
  });
  private loadPage(input: TableRequest): Observable<Page<ReportRow>> {
    const { type, query } = input;
    switch (type) {
      case 'results':
        return this.client.call(api.results, { query }).pipe(
          map((p) => ({
            ...p,
            items: p.items.map((r) => row(r, String(r.attemptId))),
          })),
        );
      case 'learners':
        return this.client
          .call(api.learners, {
            query: { ...query, quizId: query.quizId as number },
          })
          .pipe(
            map((p) => ({
              ...p,
              items: p.items.map((r) => row(r, String(r.enrollmentId))),
            })),
          );
      case 'competency':
        return this.client.call(api.competency, { query }).pipe(
          map((p) => ({
            ...p,
            items: p.items.map((r) =>
              row(r, `${r.groupKey}-${r.competencyId}`),
            ),
          })),
        );
      case 'questions':
        return this.client.call(api.questions, { query }).pipe(
          map((p) => ({
            ...p,
            items: p.items.map((r) =>
              row(r, `${r.questionId}-${r.questionVersion}`),
            ),
          })),
        );
    }
  }
  private readonly detail = serverData(
    (input: TableRequest) => this.loadPage(input),
    { params: () => this.tableRequest() },
  );
  private readonly exportMutation = serverMutation(
    (input: TableRequest) => {
      const { page, size, ...query } = input.query;
      // Export receives the exact table filters/sort, without pagination.
      void page;
      void size;
      return this.client.call(api.export, {
        params: { type: input.type },
        query,
      });
    },
    {
      errors: 'toast',
      success: () => 'Đã xuất báo cáo CSV',
      onSuccess: (blob) =>
        this.saver.save(blob, `bao-cao-thi-${this.dimension$()}.csv`),
    },
  );
  readonly overview$ = this.overview.value;
  readonly resultChart$ = computed<readonly DonutDatum[]>(() => {
    const data = this.overview$();
    return data && data.learners > 0
      ? [
          { label: 'Đã đạt', value: data.passedLearners, tone: 'success' },
          {
            label: 'Chưa ghi nhận đạt',
            value: Math.max(0, data.learners - data.passedLearners),
            tone: 'neutral',
          },
        ]
      : [];
  });
  readonly scoreComparison$ = computed(() =>
    [...(this.overview$()?.byQuiz ?? [])]
      .filter((group) => group.averageScore !== null)
      .sort((a, b) => b.gradedAttempts - a.gradedAttempts)
      .slice(0, 6),
  );
  readonly byQuiz$ = computed(() =>
    (this.overview$()?.byQuiz ?? []).map((g) => ({
      ...g,
      id: String(g.id ?? 'unknown'),
      name: g.name ?? 'Chưa xác định',
    })),
  );
  readonly byOrg$ = computed(() =>
    (this.overview$()?.byOrg ?? []).map((g) => ({
      ...g,
      id: String(g.id ?? 'unknown'),
      name: g.name ?? 'Chưa xác định',
    })),
  );
  readonly grouping$ = this.state.grouping.asReadonly();
  readonly groupPage$ = this.state.groupPage.asReadonly();
  readonly groupPageSize$ = this.state.groupPageSize.asReadonly();
  private readonly groupedRows = computed(() =>
    this.grouping$() === 'quiz' ? this.byQuiz$() : this.byOrg$(),
  );
  readonly groupTotal$ = computed(() => this.groupedRows().length);
  readonly groupedRows$ = computed(() =>
    this.groupedRows().slice(
      (this.groupPage$() - 1) * this.groupPageSize$(),
      this.groupPage$() * this.groupPageSize$(),
    ),
  );
  readonly activeFilterCount$ = computed(
    () =>
      Object.entries(
        this.progress$()
          ? learningFilter(this.filters$())
          : (this.tableRequest()?.query ?? this.commonFilters()),
      ).filter(
        ([key, value]) =>
          !['page', 'size', 'sort', 'groupBy'].includes(key) &&
          value !== undefined &&
          value !== '',
      ).length,
  );
  readonly description$ = computed(() => {
    switch (this.tab$()) {
      case 'progress':
        return 'Tiến độ học theo phạm vi được cấp. Đơn vị và nhóm lấy theo thời điểm ghi danh.';
      case 'results':
        return 'Tra cứu điểm, số câu đúng và kết quả của từng lượt thi.';
      case 'learners':
        return 'Theo dõi học viên chưa thi, đang làm và đã có kết quả theo bài kiểm tra.';
      case 'competency':
        return 'Phân tích kết quả theo nhóm năng lực của học viên hoặc đơn vị.';
      case 'questions':
        return 'Theo dõi lượt phát, lượt trả lời đúng và tỷ lệ sai theo phiên bản câu hỏi.';
      default:
        return 'Tiến độ học và kết quả thi theo phạm vi được cấp.';
    }
  });
  readonly learning$ = computed(() => this.learningSummary.value()?.counts);
  readonly learningAsOf$ = computed(() => {
    const summary = this.learningSummary.value();
    return summary ? asOf(summary) : '';
  });
  readonly learningLoading$ = this.learningSummary.isLoading;
  readonly learningError$ = this.learningSummary.error;
  readonly examLoading$ = this.overview.isLoading;
  readonly examError$ = computed(
    () => this.pickers.error$() ?? this.overview.error(),
  );
  readonly pageResultsChart$ = computed<readonly DonutDatum[]>(() =>
    ['Đạt', 'Chưa đạt', '—'].map((label, i) => ({
      label: label === '—' ? 'Chưa có kết quả' : label,
      value: this.rows$().filter((r) => r['passed'] === label).length,
      tone: i === 0 ? 'success' : 'neutral',
    })),
  );
  readonly pageStatusChart$ = computed<readonly DonutDatum[]>(() =>
    ['Đang làm', 'Đã nộp', 'Tự nộp', 'Đã hủy'].map((label) => ({
      label,
      value: this.rows$().filter((r) => r['status'] === label).length,
      tone: 'primary',
    })),
  );
  readonly assessmentViews$ = computed(() =>
    this.assessmentTabs$().map((t) => ({ value: t.id, label: t.label })),
  );
  readonly period$ = computed(() => {
    const { from, to } = this.filters$();
    if (!from && !to) return 'all';
    const now = new Date();
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    ).toISOString();
    if (to !== end) return 'custom';
    if (from === new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
      return 'month';
    if (
      from ===
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 29,
      ).toISOString()
    )
      return '30days';
    return 'custom';
  });
  readonly scoreBars$ = computed(() =>
    this.scoreComparison$().map((g) => ({
      label: g.name ?? 'Chưa xác định',
      value: g.averageScore ?? 0,
    })),
  );
  selectAssessment(value: string): void {
    const tab = this.assessmentTabs$().find((t) => t.id === value);
    if (tab)
      void this.router.navigate(tab.path, { queryParams: tab.queryParams });
  }
  selectPeriod(value: string): void {
    if (value === 'custom') {
      this.setFiltersOpen(true);
      return;
    }
    if (value === 'all') {
      this.applyFilters({ ...this.filters$(), from: undefined, to: undefined });
      return;
    }
    const now = new Date();
    const from =
      value === 'month'
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    this.applyFilters({
      ...this.filters$(),
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }
  readonly rows$ = computed(() => this.detail.value()?.items ?? []);
  readonly total$ = computed(() => this.detail.value()?.totalElements ?? 0);
  readonly columns$ = computed<readonly DataTableColumn[]>(() => {
    const type = this.dimension$();
    return type
      ? COLUMNS[type]
          .filter(
            ([key]) =>
              type !== 'results' ||
              [
                'userName',
                'quizTitle',
                'attemptNo',
                'scorePercent',
                'passed',
                'submittedAt',
              ].includes(key),
          )
          .map(([key, label]) => ({
            key,
            label,
            sortable: SORTS[type].includes(key),
          }))
      : [];
  });
  readonly isLoading$ = computed(() =>
    this.dimension$() ? this.detail.isLoading() : this.overview.isLoading(),
  );
  readonly error$ = computed(
    () =>
      this.pickers.error$() ??
      (this.dimension$() ? this.detail.error() : this.overview.error()),
  );
  readonly exporting$ = computed(
    () => this.exportMutation.isPending() || this.progress.exporting$(),
  );
  /** Why "Xuất CSV" is disabled; `undefined` while it can export or the rows are still loading. */
  readonly exportReason$ = computed(() => {
    if (this.progress$())
      return this.pickers.blocked$() ||
        (this.progress.loaded$() && !this.progress.total$())
        ? 'Không có dữ liệu để xuất.'
        : undefined;
    if (!this.dimension$()) return 'Chọn một báo cáo chi tiết để xuất CSV.';
    if (this.needsQuiz$()) return 'Chọn bài kiểm tra để xuất.';
    const page = this.detail.value();
    return this.pickers.blocked$() || (page && !page.totalElements)
      ? 'Không có dữ liệu để xuất.'
      : undefined;
  });
  readonly canExport$ = computed(
    () =>
      !this.exportReason$() &&
      (this.progress$() ? this.progress.loaded$() : !!this.detail.value()),
  );
  readonly needsQuiz$ = computed(
    () => this.dimension$() === 'learners' && !this.filters$().quizId,
  );
  readonly title$ = computed(() =>
    this.progress$()
      ? 'Tiến độ & hoàn thành'
      : (REPORT_DIMENSIONS.find((d) => d.id === this.dimension$())?.label ??
        'Tổng quan kết quả thi'),
  );
  private setSort(value: DataTableSort): void {
    this.state.sort.set(value);
  }
  private setGrouping(value: 'quiz' | 'org'): void {
    this.state.grouping.set(value);
  }
  setGroupPage(value: number): void {
    this.state.groupPage.set(value);
  }
  setGroupPageSize(value: number): void {
    this.state.groupPageSize.set(value);
    this.setGroupPage(1);
  }
  selectGrouping(value: 'quiz' | 'org'): void {
    this.setGrouping(value);
    this.setGroupPage(1);
  }
  /** Writes the filters to the URL in place, from the first page; the report follows the URL. */
  applyFilters(value: ReportFilters): void {
    this.setGroupPage(1);
    void this.navigate(value, 1);
  }
  /** Shows "Tiến độ & hoàn thành" by course, by unit or by learner, from the first page. */
  selectView(view: ProgressView): void {
    void this.navigate({ ...this.filters$(), view }, 1);
  }
  changePage(page: number): void {
    void this.navigate(this.filters$(), page);
  }
  /** A new page size starts again at the first page. */
  changePageSize(size: number): void {
    const apply = () => {
      if (this.progress$()) this.progress.setPageSize(size);
      else this.state.pageSize.set(size);
    };
    // The page lives in the URL: leave a later page first, so the new size is never asked for
    // at a page past the end.
    if (this.page$() > 1) void this.navigate(this.filters$(), 1).then(apply);
    else apply();
  }
  changeSort(sort: DataTableSort): void {
    if (this.progress$()) {
      if (this.progress.setSort(sort) && this.page$() > 1)
        void this.navigate(this.filters$(), 1);
      return;
    }
    const type = this.dimension$();
    if (!type || !SORTS[type].includes(sort.key)) return;
    this.setSort(sort);
    if (this.page$() > 1) void this.navigate(this.filters$(), 1);
  }
  exportCsv(): void {
    if (this.progress$()) return this.progress.exportCsv();
    const request = this.tableRequest();
    if (request && !this.exporting$()) this.exportMutation.run(request);
  }
  /** Writes the filters the current tab reads, so a shared link carries no unused key. */
  private navigate(filters: ReportFilters, page: number): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryFromFilters(
        filters,
        page,
        TAB_FILTERS[this.tab$() ?? 'overview'],
      ),
      replaceUrl: true,
    });
  }
  retryLearning(): void {
    this.learningSummary.reload();
  }
  retry(): void {
    this.pickers.retry();
    this.progress.retry();
    this.overview.reload();
    this.detail.reload();
  }
}
