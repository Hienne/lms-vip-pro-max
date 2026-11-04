import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, type Observable } from 'rxjs';
import {
  assessmentReportEndpoints as api,
  AssessmentReportTypeSchema,
  type AssessmentReportType,
  type AssessmentReportFilter,
  type AssessmentReportExportQuery,
  type Page,
} from '@lms/contracts';
import type { DataTableColumn, DataTableSort, DonutDatum } from '@lms/ui';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';

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
  private readonly params = toSignal(this.route.paramMap);
  private readonly queryParams = toSignal(this.route.queryParamMap);
  readonly incomingUserId$ = computed(
    () => this.queryParams()?.get('userId') ?? '',
  );
  readonly dimension$ = computed(() => {
    const parsed = AssessmentReportTypeSchema.safeParse(
      this.params()?.get('dim'),
    );
    return parsed.success ? parsed.data : undefined;
  });
  readonly unsupported$ = computed(
    () => !!this.params()?.get('dim') && !this.dimension$(),
  );
  private readonly state = {
    filters: linkedSignal<AssessmentReportExportQuery>(() => ({
      userId: this.incomingUserId$() || undefined,
    })),
    table: linkedSignal(() => ({
      page: 1,
      sort: DEFAULT_SORT[this.dimension$() ?? 'results'],
    })),
    grouping: signal<'quiz' | 'org'>('quiz'),
    groupPage: signal(1),
  };
  readonly filters$ = this.state.filters.asReadonly();
  private readonly commonFilters = computed<AssessmentReportFilter>(() => {
    const { orgId, teamId, courseId, quizId, from, to } = this.filters$();
    return { orgId, teamId, courseId, quizId, from, to };
  });
  private readonly overview = serverData(
    (query: AssessmentReportFilter) =>
      this.client.call(api.overview, { query }),
    {
      params: () =>
        !this.params()?.get('dim') ? this.commonFilters() : undefined,
    },
  );
  private readonly tableRequest = computed<TableRequest | undefined>(() => {
    const type = this.dimension$();
    if (!type) return undefined;
    const f = this.filters$(),
      table = this.state.table();
    const paging = {
      page: table.page - 1,
      size: 20,
      sort: `${table.sort.key},${table.sort.dir}`,
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
  private readonly groupedRows = computed(() =>
    this.grouping$() === 'quiz' ? this.byQuiz$() : this.byOrg$(),
  );
  readonly groupTotal$ = computed(() => this.groupedRows().length);
  readonly groupedRows$ = computed(() =>
    this.groupedRows().slice(
      (this.groupPage$() - 1) * 10,
      this.groupPage$() * 10,
    ),
  );
  readonly activeFilterCount$ = computed(
    () =>
      Object.entries(this.tableRequest()?.query ?? this.commonFilters()).filter(
        ([key, value]) =>
          !['page', 'size', 'sort', 'groupBy'].includes(key) &&
          value !== undefined &&
          value !== '',
      ).length,
  );
  readonly description$ = computed(() => {
    switch (this.dimension$()) {
      case 'results':
        return 'Tra cứu điểm, số câu đúng và kết quả của từng lượt thi.';
      case 'learners':
        return 'Theo dõi học viên chưa thi, đang làm và đã có kết quả theo bài kiểm tra.';
      case 'competency':
        return 'Phân tích kết quả theo nhóm năng lực của học viên hoặc đơn vị.';
      case 'questions':
        return 'Theo dõi lượt phát, lượt trả lời đúng và tỷ lệ sai theo phiên bản câu hỏi.';
      default:
        return 'Theo dõi kết quả kiểm tra, mức độ tham gia và năng lực trong phạm vi được cấp.';
    }
  });
  readonly rows$ = computed(() => this.detail.value()?.items ?? []);
  readonly total$ = computed(() => this.detail.value()?.totalElements ?? 0);
  readonly columns$ = computed<readonly DataTableColumn[]>(() => {
    const type = this.dimension$();
    return type
      ? COLUMNS[type].map(([key, label]) => ({
          key,
          label,
          sortable: SORTS[type].includes(key),
        }))
      : [];
  });
  readonly page$ = computed(() => this.state.table().page);
  readonly sort$ = computed(() => this.state.table().sort);
  readonly isLoading$ = computed(
    () => this.overview.isLoading() || this.detail.isLoading(),
  );
  readonly error$ = computed(
    () => this.overview.error() ?? this.detail.error(),
  );
  readonly exporting$ = this.exportMutation.isPending;
  readonly canExport$ = computed(() => !!this.tableRequest());
  readonly needsQuiz$ = computed(
    () => this.dimension$() === 'learners' && !this.filters$().quizId,
  );
  readonly title$ = computed(
    () =>
      REPORT_DIMENSIONS.find((d) => d.id === this.dimension$())?.label ??
      'Tổng quan kết quả thi',
  );
  private setFilters(value: AssessmentReportExportQuery): void {
    this.state.filters.set(value);
  }
  private setTable(value: { page: number; sort: DataTableSort }): void {
    this.state.table.set(value);
  }
  private setGrouping(value: 'quiz' | 'org'): void {
    this.state.grouping.set(value);
  }
  setGroupPage(value: number): void {
    this.state.groupPage.set(value);
  }
  selectGrouping(value: 'quiz' | 'org'): void {
    this.setGrouping(value);
    this.setGroupPage(1);
  }
  applyFilters(value: AssessmentReportExportQuery): void {
    this.setFilters(value);
    this.setTable({ ...this.state.table(), page: 1 });
    this.setGroupPage(1);
  }
  changePage(page: number): void {
    this.setTable({ ...this.state.table(), page });
  }
  changeSort(sort: DataTableSort): void {
    const type = this.dimension$();
    if (type && SORTS[type].includes(sort.key))
      this.setTable({ page: 1, sort });
  }
  exportCsv(): void {
    const request = this.tableRequest();
    if (request && !this.exporting$()) this.exportMutation.run(request);
  }
  retry(): void {
    this.overview.reload();
    this.detail.reload();
  }
}
