import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DashboardCounts, LearningProgressOverview } from '@lms/contracts';
import { Button, Card, Icon, Ring, type IconName } from '@lms/ui';
import { isAssessmentAvailable } from '../../../../../shared/learning/assessment-overview';

type KpiTone = 'primary' | 'info' | 'danger' | 'reward';

interface Kpi {
  readonly label: string;
  /** The server's figure, or `null` for a dash. */
  readonly value: number | null;
  readonly unit: 'count' | 'percent';
  /** The figure as shown: a count, or a percent rounded to a whole number; a dash for `null`. */
  readonly shown: string;
  readonly icon: IconName;
  readonly tone: KpiTone;
  /** The server's verdict before the detail ("Đạt · ", "Chưa đạt · "), failing text coloured. */
  readonly verdict: string;
  readonly failed: boolean;
  readonly detail: string;
  /** The quiz's title, kept as the figure's tooltip. */
  readonly title: string | null;
  readonly href: string | null;
  readonly query: Record<string, string> | null;
  readonly overdue?: number;
  /** The completion rate shows as a ring in place of the icon. */
  readonly ring?: boolean;
}

const shown = (value: number | null, unit: 'count' | 'percent'): string =>
  value === null
    ? '—'
    : unit === 'percent'
      ? String(Math.round(value))
      : String(value);

/**
 * The learner's figures as a row of cards (the mockup's `UI.Kpi`): the assigned courses, the
 * completion rate with its ring, the last and the best score, each with an icon. Every number and
 * verdict is the server's. The completion rate comes from the dashboard; when that read fails only
 * its card shows the retry. Empty score figures collapse into one result.
 */
@Component({
  selector: 'app-learn-kpis',
  imports: [Button, Card, Icon, NgTemplateOutlet, Ring, RouterLink],
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
      shown: shown(counts.assigned, 'count'),
      icon: 'book-open',
      tone: 'primary',
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
    const rate = counts?.completionRate ?? null;
    return {
      label: 'Tỷ lệ hoàn thành',
      value: rate,
      unit: 'percent',
      shown: shown(rate, 'percent'),
      icon: 'book-open',
      tone: 'primary',
      ring: true,
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
      return [this.score('Kết quả kiểm tra', null, none, 'info')];
    }
    const { last } = assessment;
    if (!last && assessment.bestScorePercent === null) {
      return [
        this.score('Kết quả kiểm tra', null, 'Chưa làm bài kiểm tra', 'info'),
      ];
    }
    return [
      last
        ? this.score(
            'Điểm kiểm tra gần nhất',
            last.scorePercent,
            last.quizTitle,
            last.passed === false ? 'danger' : 'info',
            last.passed,
            last.quizTitle,
          )
        : this.score(
            'Điểm kiểm tra gần nhất',
            null,
            'Chưa làm bài kiểm tra',
            'info',
          ),
      this.score(
        'Điểm cao nhất',
        assessment.bestScorePercent,
        `Đạt ${assessment.passedQuizCount}/${assessment.quizCount} bài kiểm tra`,
        'reward',
      ),
    ];
  });

  private score(
    label: string,
    value: number | null,
    detail: string,
    tone: KpiTone,
    passed: boolean | null = null,
    title: string | null = null,
  ): Kpi {
    return {
      label,
      value,
      unit: 'percent',
      shown: shown(value, 'percent'),
      icon: tone === 'reward' ? 'trophy' : 'clipboard-check',
      tone,
      verdict: passed === null ? '' : passed ? 'Đạt' : 'Chưa đạt',
      failed: passed === false,
      detail,
      title,
      href: '/progress',
      query: null,
    };
  }
}
