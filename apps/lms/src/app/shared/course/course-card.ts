import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CourseStatus } from '@lms/contracts';
import {
  Badge,
  Card,
  Icon,
  Progress,
  type IconName,
  type ProgressTone,
} from '@lms/ui';
import { DueDate } from './due-date';
import { RequiredMark } from './required-mark';

export type CourseCover =
  | 'layers'
  | 'process'
  | 'clock'
  | 'building'
  | 'database'
  | 'shield';

const COVER_ICON: Record<CourseCover, IconName> = {
  layers: 'layers',
  process: 'workflow',
  clock: 'clock',
  building: 'building-2',
  database: 'database',
  shield: 'shield',
};

/**
 * What the card shows about a course. The learner feature maps its API result to this; the card
 * holds no business rule (progress, status and overdue come from the server).
 */
export interface CourseCardView {
  readonly id: string;
  readonly title: string;
  readonly required: boolean;
  readonly cover: CourseCover;
  readonly domain: string;
  readonly module: string;
  readonly minutes: number;
  readonly lessons: number;
  readonly level: string;
  /** Progress, 0 to 100. */
  readonly pct: number;
  readonly status: CourseStatus;
  /** The status in words, as the server phrases it. */
  readonly statusLabel: string;
  readonly overdue?: boolean;
  /** ISO date-time. */
  readonly dueAt?: string | null;
  /** Best quiz score in percent, when the course has a quiz that was taken. */
  readonly bestScore?: number | null;
  /** Router path of the course page. */
  readonly link: string;
}

const PROGRESS_TONE: Partial<Record<CourseStatus, ProgressTone>> = {
  completed: 'success',
  failed: 'danger',
};

/** The mockup's `UI.Minutes`: "45 phút", "1g 8p" or "2 giờ". */
function formatMinutes(total: number): string {
  const minutes = Math.round(total);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}g ${rest}p` : `${hours} giờ`;
}

/**
 * A course in a catalog or dashboard grid (the mockup's `UI.CourseCard`). The whole card is one
 * link to the course page.
 */
@Component({
  selector: 'app-course-card',
  imports: [RouterLink, Card, Badge, Icon, Progress, RequiredMark, DueDate],
  templateUrl: './course-card.html',
  styleUrl: './course-card.scss',
})
export class CourseCard {
  readonly course = input.required<CourseCardView>();

  protected readonly coverIcon = computed(
    () => COVER_ICON[this.course().cover],
  );
  protected readonly duration = computed(() =>
    formatMinutes(this.course().minutes),
  );
  protected readonly progressTone = computed(
    () => PROGRESS_TONE[this.course().status],
  );
  protected readonly statusText = computed(() => {
    const { statusLabel, bestScore } = this.course();
    return typeof bestScore === 'number'
      ? `${statusLabel} · Điểm cao nhất ${bestScore}%`
      : statusLabel;
  });
  protected readonly completed = computed(
    () => this.course().status === 'completed',
  );
}
