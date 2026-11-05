import { Component, computed, inject, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import { z } from 'zod';
import { AssessmentReportExportQuerySchema } from '@lms/contracts';
import {
  Alert,
  DonutChart,
  Button,
  Card,
  DataTable,
  DataTableCell,
  Empty,
  ErrorState,
  Field,
  Input,
  Icon,
  FmtNumPipe,
  FmtPctPipe,
  PageHeader,
  Select,
  Spinner,
  Tooltip,
  type DataTableColumn,
} from '@lms/ui';
import { ReportScreenStore } from './data-access/report-screen.store';
import type { PickerKey } from './data-access/report-pickers';
import { ReportPicker } from './components/report-picker/report-picker';

interface PickerField {
  readonly key: PickerKey;
  readonly label: string;
  /** What an empty choice means. */
  readonly emptyLabel: string;
  /** The picker this one waits for, and the reason it gives meanwhile. */
  readonly parent?: { readonly key: PickerKey; readonly reason: string };
}

const PICKERS: Record<PickerKey, PickerField> = {
  orgId: {
    key: 'orgId',
    label: 'Đơn vị',
    emptyLabel: 'Toàn bộ phạm vi được cấp',
  },
  teamId: {
    key: 'teamId',
    label: 'Phòng / nhóm',
    emptyLabel: 'Tất cả phòng / nhóm',
    parent: { key: 'orgId', reason: 'Chọn đơn vị trước' },
  },
  courseId: {
    key: 'courseId',
    label: 'Khóa học',
    emptyLabel: 'Tất cả khóa học',
  },
  quizId: {
    key: 'quizId',
    label: 'Bài kiểm tra',
    emptyLabel: 'Tất cả bài kiểm tra',
    parent: { key: 'courseId', reason: 'Chọn khóa học trước' },
  },
};

const EMPTY_FORM = {
  userId: '',
  from: '',
  to: '',
  status: '',
  learnerStatus: '',
  passed: '',
  groupBy: 'user' as 'user' | 'org',
};

/** An ISO date-time as a `datetime-local` value, in the browser's time zone. */
function toLocalInput(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const filterSchema = z
  .object({
    userId: z.string().max(20),
    from: z.string(),
    to: z.string(),
    status: z.string(),
    learnerStatus: z.string(),
    passed: z.string(),
    groupBy: z.enum(['user', 'org']),
  })
  .superRefine((v, ctx) => {
    if (v.from && !Number.isFinite(Date.parse(v.from)))
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Ngày giờ không hợp lệ.',
      });
    if (
      v.to &&
      (!Number.isFinite(Date.parse(v.to)) ||
        (v.from && Date.parse(v.to) <= Date.parse(v.from)))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Đến ngày phải sau từ ngày.',
      });
  });
@Component({
  selector: 'app-report-screen',
  imports: [
    ReportPicker,
    Tooltip,
    DonutChart,
    RouterLink,
    FormField,
    FormRoot,
    Alert,
    Button,
    Card,
    DataTable,
    DataTableCell,
    Empty,
    ErrorState,
    Field,
    Input,
    Icon,
    FmtNumPipe,
    FmtPctPipe,
    PageHeader,
    Select,
    Spinner,
  ],
  providers: [ReportScreenStore],
  templateUrl: './report-screen.html',
  styleUrl: './report-screen.scss',
})
export class ReportScreen {
  protected readonly store = inject(ReportScreenStore);
  protected readonly groupColumns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Bài kiểm tra / đơn vị', sortable: false },
    { key: 'gradedAttempts', label: 'Lượt chấm', sortable: false },
    { key: 'learners', label: 'Học viên', sortable: false },
    { key: 'passedLearners', label: 'Học viên đạt', sortable: false },
    { key: 'passRate', label: 'Đạt (%)', sortable: false },
    { key: 'averageScore', label: 'Điểm TB (%)', sortable: false },
  ];
  /**
   * "Tình trạng học viên" needs a quiz, so its course and quiz pickers lead the form; elsewhere
   * the pickers set the scope under "Phạm vi & điều kiện chi tiết".
   */
  protected readonly leadPickers = computed(() =>
    this.store.dimension$() === 'learners'
      ? [PICKERS.courseId, PICKERS.quizId]
      : [],
  );
  protected readonly scopePickers = computed(() =>
    this.store.dimension$() === 'learners'
      ? [PICKERS.orgId, PICKERS.teamId]
      : [PICKERS.orgId, PICKERS.teamId, PICKERS.courseId, PICKERS.quizId],
  );
  /** The detailed filters stay open while one of them says a link's id is not found. */
  protected readonly scopeHasError = computed(() =>
    Object.values(this.store.pickers.errors$()).some(Boolean),
  );
  /** The form shows the filters the URL applies, until the user edits them. */
  private readonly filterModel = linkedSignal(() => {
    const f = this.store.filters$();
    return {
      userId: f.userId ?? '',
      from: toLocalInput(f.from),
      to: toLocalInput(f.to),
      status: f.status ?? '',
      learnerStatus: f.learnerStatus ?? '',
      passed: f.passed === undefined ? '' : String(f.passed),
      groupBy: (f.groupBy ?? 'user') as 'user' | 'org',
    };
  });
  protected readonly filterForm = form(
    this.filterModel,
    (path) => validateStandardSchema(path, filterSchema),
    { submission: { action: async () => this.applyFilters() } },
  );
  private applyFilters(): void {
    const f = this.filterModel();
    this.store.applyFilters(
      AssessmentReportExportQuerySchema.parse({
        ...this.store.pickers.picks$(),
        userId: f.userId || undefined,
        from: f.from ? new Date(f.from).toISOString() : undefined,
        to: f.to ? new Date(f.to).toISOString() : undefined,
        status: f.status || undefined,
        learnerStatus: f.learnerStatus || undefined,
        passed: f.passed ? f.passed === 'true' : undefined,
        groupBy: f.groupBy,
      }),
    );
  }
  protected resetFilters(): void {
    this.filterForm().reset({ ...EMPTY_FORM });
    this.store.pickers.clear();
    this.store.applyFilters({});
  }
}
