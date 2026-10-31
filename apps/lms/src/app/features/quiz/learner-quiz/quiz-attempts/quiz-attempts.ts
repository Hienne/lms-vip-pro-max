import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  DataTable,
  DataTableCell,
  Empty,
  ErrorState,
  FmtDatetimePipe,
  FmtScorePipe,
  FmtTimePipe,
  Icon,
  PageHeader,
  Skeleton,
  type BreadcrumbItem,
  type DataTableColumn,
} from '@lms/ui';
import {
  ATTEMPTS_PAGE_SIZE,
  QuizAttemptsStore,
  type AttemptView,
} from './data-access/quiz-attempts.store';

const COLUMNS: readonly DataTableColumn[] = [
  { key: 'attemptNo', label: 'Lượt', sortable: false },
  { key: 'submittedAt', label: 'Nộp lúc', sortable: false },
  { key: 'durationSeconds', label: 'Thời gian', sortable: false },
  { key: 'score', label: 'Điểm', sortable: false },
  { key: 'outcome', label: 'Kết quả', sortable: false },
  { key: 'actions', label: '', kind: 'actions' },
];

/** The history of one quiz (the mockup's `quizAttempts`): the summary line and every attempt. */
@Component({
  selector: 'app-quiz-attempts',
  imports: [
    Badge,
    Breadcrumb,
    Button,
    Card,
    DataTable,
    DataTableCell,
    Empty,
    ErrorState,
    FmtDatetimePipe,
    FmtScorePipe,
    FmtTimePipe,
    Icon,
    PageHeader,
    RouterLink,
    Skeleton,
  ],
  providers: [QuizAttemptsStore],
  templateUrl: './quiz-attempts.html',
  styleUrl: './quiz-attempts.scss',
})
export class QuizAttempts {
  protected readonly store = inject(QuizAttemptsStore);
  protected readonly columns = COLUMNS;
  protected readonly pageSize = ATTEMPTS_PAGE_SIZE;
  protected readonly OUTCOME_TEXT: Record<AttemptView['outcome'], string> = {
    passed: 'Đạt',
    failed: 'Chưa đạt',
    running: 'Đang làm',
    voided: 'Đã hủy',
  };

  protected readonly crumbs = computed((): readonly BreadcrumbItem[] => {
    const quizId = this.store.quizId$();
    const title = this.store.history$()?.quizTitle ?? 'Bài kiểm tra';
    return [
      { label: title, href: quizId ? `/quiz/${quizId}` : '/quiz' },
      { label: 'Lịch sử thi' },
    ];
  });

  /** The server's combined summary in one line, where the mockup had four KPI cards. */
  protected readonly summaryLine = computed(() => {
    const summary = this.store.history$()?.summary;
    if (!summary) return '';
    const parts = [
      `Đã thi ${summary.attemptsUsed} lượt`,
      `Còn ${summary.attemptsLeft} lượt`,
    ];
    if (summary.bestScore != null)
      parts.push(`Cao nhất ${Math.round(summary.bestScore * 10) / 10}%`);
    if (summary.lastScore != null)
      parts.push(`Gần nhất ${Math.round(summary.lastScore * 10) / 10}%`);
    parts.push(summary.passed ? 'Đã đạt' : 'Chưa đạt');
    return parts.join(' · ');
  });
}
