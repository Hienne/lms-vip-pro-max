import { Component, inject, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  form,
  FormField,
  submit,
  validateStandardSchema,
} from '@angular/forms/signals';
import { z } from 'zod';
import { AssessmentReportExportQuerySchema } from '@lms/contracts';
import {
  Alert,
  BarChart,
  Button,
  Card,
  DataTable,
  Empty,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  type DataTableColumn,
} from '@lms/ui';
import { ReportScreenStore } from './data-access/report-screen.store';
const id = z
  .string()
  .refine(
    (v) => !v || (/^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v))),
    'Nhập ID là số nguyên dương.',
  );
const filterSchema = z
  .object({
    orgId: id,
    teamId: id,
    courseId: id,
    quizId: id,
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
/** An ISO date-time as a `datetime-local` value, in the browser's time zone. */
function toLocalInput(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

@Component({
  selector: 'app-report-screen',
  imports: [
    BarChart,
    RouterLink,
    FormField,
    Alert,
    Button,
    Card,
    DataTable,
    Empty,
    ErrorState,
    Field,
    Input,
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
    { key: 'name', label: 'Tên', sortable: false },
    { key: 'gradedAttempts', label: 'Lượt chấm', sortable: false },
    { key: 'learners', label: 'Học viên', sortable: false },
    { key: 'passedLearners', label: 'Học viên đạt', sortable: false },
    { key: 'passRate', label: 'Đạt (%)', sortable: false },
    { key: 'averageScore', label: 'Điểm TB (%)', sortable: false },
  ];
  /** The form shows the filters the URL applies, until the user edits them. */
  private readonly filterModel = linkedSignal(() => {
    const f = this.store.filters$();
    return {
      orgId: f.orgId ? String(f.orgId) : '',
      teamId: f.teamId ? String(f.teamId) : '',
      courseId: f.courseId ? String(f.courseId) : '',
      quizId: f.quizId ? String(f.quizId) : '',
      userId: f.userId ?? '',
      from: toLocalInput(f.from),
      to: toLocalInput(f.to),
      status: f.status ?? '',
      learnerStatus: f.learnerStatus ?? '',
      passed: f.passed === undefined ? '' : String(f.passed),
      groupBy: (f.groupBy ?? 'user') as 'user' | 'org',
    };
  });
  protected readonly filterForm = form(this.filterModel, (path) =>
    validateStandardSchema(path, filterSchema),
  );
  protected applyFilters(event: Event): void {
    event.preventDefault();
    void submit(this.filterForm, async () => {
      const f = this.filterModel();
      this.store.applyFilters(
        AssessmentReportExportQuerySchema.parse({
          orgId: f.orgId ? Number(f.orgId) : undefined,
          teamId: f.teamId ? Number(f.teamId) : undefined,
          courseId: f.courseId ? Number(f.courseId) : undefined,
          quizId: f.quizId ? Number(f.quizId) : undefined,
          userId: f.userId || undefined,
          from: f.from ? new Date(f.from).toISOString() : undefined,
          to: f.to ? new Date(f.to).toISOString() : undefined,
          status: f.status || undefined,
          learnerStatus: f.learnerStatus || undefined,
          passed: f.passed ? f.passed === 'true' : undefined,
          groupBy: f.groupBy,
        }),
      );
    });
  }
}
