import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DashboardCounts, LearningProgressOverview } from '@lms/contracts';
import { Button, FmtPctPipe } from '@lms/ui';
import { isAssessmentAvailable } from '../../../../../shared/learning/assessment-overview';

interface Kpi {
  readonly label: string;
  /** The server's figure, or `null` for a dash. */
  readonly value: number | null;
  readonly unit: 'count' | 'percent';
  /** The server's verdict before the detail ("Đạt · ", "Chưa đạt · "), failing text coloured. */
  readonly verdict: string;
  readonly failed: boolean;
  readonly detail: string;
  /** Longer words kept off the one-line footnote, as the figure's tooltip. */
  readonly title: string | null;
  readonly href: string | null;
  readonly query: Record<string, string> | null;
  readonly overdue?: number;
}

/**
 * The learner's figures as one row of label over number, no card per number
 * (visual-design.md): the assigned courses, the completion rate, the last and the best score. Each
 * footnote stays on one line; the last quiz's title moves into the figure's tooltip. Every
 * number and verdict is the server's. The completion rate comes from the dashboard; when that read
 * fails only its figure shows the retry. Empty score figures collapse into one result.
 */
@Component({
  selector: 'app-learn-kpis',
  imports: [Button, FmtPctPipe, NgTemplateOutlet, RouterLink],
  templateUrl: './learn-kpis.html',
  styleUrl: './learn-kpis.scss',
})
export class LearnKpis {
  readonly summary = input.required<LearningProgressOverview>();
  /** The dashboard's counts; absent while loading or after an error. */
  readonly dashboard = input<DashboardCounts>();
  readonly dashboardFailed = input(false);
  readonly retryDashboard = output();

  protected readonly assigned = computed((): Kpi => {
    const counts = this.summary().counts;
    return {
      label: 'Khóa học được giao',
      value: counts.assigned,
      unit: 'count',
      verdict: '',
      failed: false,
      detail: `${counts.mandatory} bắt buộc`,
      title: null,
      overdue: counts.overdue,
      href: '/catalog',
      query: { scope: 'assigned' },
    };
  });

  protected readonly completion = computed((): Kpi => {
    const counts = this.dashboard();
    return {
      label: 'Tỷ lệ hoàn thành',
      value: counts?.completionRate ?? null,
      unit: 'percent',
      verdict: '',
      failed: false,
      detail: counts
        ? `${counts.completed}/${counts.courses} khóa đã xong`
        : '',
      title: null,
      href: null,
      query: null,
    };
  });

  protected readonly scores = computed((): readonly Kpi[] => {
    const assessment = this.summary().assessment;
    const none = 'Chưa có bài kiểm tra';
    if (!isAssessmentAvailable(assessment)) {
      return [this.score('Kết quả kiểm tra', null, none)];
    }
    const { last } = assessment;
    if (!last && assessment.bestScorePercent === null) {
      return [this.score('Kết quả kiểm tra', null, 'Chưa làm bài kiểm tra')];
    }
    return [
      last
        ? this.score(
            'Điểm kiểm tra gần nhất',
            last.scorePercent,
            '',
            last.passed,
            last.quizTitle,
          )
        : this.score('Điểm kiểm tra gần nhất', null, 'Chưa làm bài kiểm tra'),
      this.score(
        'Điểm cao nhất',
        assessment.bestScorePercent,
        `Đạt ${assessment.passedQuizCount}/${assessment.quizCount} bài kiểm tra`,
      ),
    ];
  });

  private score(
    label: string,
    value: number | null,
    detail: string,
    passed: boolean | null = null,
    title: string | null = null,
  ): Kpi {
    return {
      label,
      value,
      unit: 'percent',
      verdict: passed === null ? '' : passed ? 'Đạt' : 'Chưa đạt',
      failed: passed === false,
      detail,
      title,
      href: '/progress',
      query: null,
    };
  }
}
