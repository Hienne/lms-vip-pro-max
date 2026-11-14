import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CourseStatus } from '@lms/contracts';
import {
  Badge,
  Card,
  FmtPctPipe,
  Icon,
  Progress,
  type ProgressTone,
} from '@lms/ui';
import {
  courseCompletionNote,
  type CourseCardView,
} from '../../../../../shared/course/course-card';
import { DueDate } from '../../../../../shared/course/due-date';

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
 * A course on the learner's home: the uploaded cover when the course has one (no placeholder art
 * otherwise), the category with at most one status badge (completed or failed; overdue shows once, in the due date), the title,
 * a meta line ("Bắt buộc" or "Tự chọn" as plain text, duration, lessons, level), progress and the
 * status line. Progress, status and overdue are the server's. The whole tile is one
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
  protected readonly completionNote = computed(() =>
    courseCompletionNote(this.course()),
  );
}
