import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CourseStatus } from '@lms/contracts';
import {
  Badge,
  Card,
  FmtPctPipe,
  Icon,
  Progress,
  type IconName,
  type ProgressTone,
} from '@lms/ui';
import type { CourseCardView } from '../../../../../shared/course/course-card';
import { DueDate } from '../../../../../shared/course/due-date';

const PROGRESS_TONE: Partial<Record<CourseStatus, ProgressTone>> = {
  completed: 'success',
  failed: 'danger',
};

/** The mockup's pastel cover colours, taken from the theme's tokens, and the art on each. */
const COVER_TONES = ['primary', 'info', 'accent'] as const;
const COVER_ART: readonly IconName[] = [
  'layers',
  'workflow',
  'database',
  'shield',
  'book-open',
];

/** A stable number from the id, so a course keeps its colour and art between visits. */
function hash(id: string): number {
  let total = 0;
  for (const char of id) total = (total * 31 + char.charCodeAt(0)) % 9973;
  return total;
}

/** The mockup's `UI.Minutes`: "45 phút", "1g 8p" or "2 giờ". */
function formatMinutes(total: number): string {
  const minutes = Math.round(total);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}g ${rest}p` : `${hours} giờ`;
}

/**
 * A course on the learner's home as the mockup draws it (`UI.CourseCard`): a cover band with the
 * "Bắt buộc" or "Tự chọn" mark and the status on it, then the category, title, meta line with
 * icons, progress and the status line. The cover is the uploaded image when there is one, else a
 * pastel band with an icon. Progress, status and overdue are the server's. The whole tile is one
 * link to the course.
 */
@Component({
  selector: 'app-course-tile',
  imports: [Badge, Card, DueDate, FmtPctPipe, Icon, Progress, RouterLink],
  templateUrl: './course-tile.html',
  styleUrl: './course-tile.scss',
})
export class CourseTile {
  readonly course = input.required<CourseCardView>();

  private readonly seed = computed(() => hash(this.course().id));
  protected readonly coverTone = computed(
    () => COVER_TONES[this.seed() % COVER_TONES.length],
  );
  protected readonly art = computed(
    () => COVER_ART[this.seed() % COVER_ART.length],
  );
  protected readonly duration = computed(() => {
    const minutes = this.course().minutes;
    return minutes === undefined ? null : formatMinutes(minutes);
  });
  protected readonly progressTone = computed(
    () => PROGRESS_TONE[this.course().status],
  );
  protected readonly bestScore = computed(() => {
    const score = this.course().bestScore;
    return typeof score === 'number' ? score : null;
  });
  protected readonly completed = computed(
    () => this.course().status === 'completed',
  );
  protected readonly showsProgress = computed(
    () => this.course().enrolled !== false,
  );
}
