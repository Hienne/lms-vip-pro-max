import { booleanAttribute, Component, computed, input } from '@angular/core';
import { Badge, Icon } from '@lms/ui';
import type { CourseStatus as CourseStatusValue } from '@lms/contracts';
import type { StatusView } from './status-view';

/** The mockup's `COURSE_STATUS`; a missing enum value is a compile error. */
const COURSE_STATUS_VIEW: Record<CourseStatusValue, StatusView> = {
  not_started: { label: 'Chưa bắt đầu', tone: 'neutral' },
  in_progress: { label: 'Đang học', tone: 'info' },
  completed: { label: 'Đã hoàn thành', tone: 'success', icon: 'check' },
  failed: { label: 'Chưa đạt', tone: 'danger', icon: 'x' },
};

/**
 * A learner's course status as a badge; the icon on done and failed keeps the meaning off colour.
 * `overdue` adds a "Quá hạn" badge next to it.
 */
@Component({
  selector: 'app-course-status',
  imports: [Badge, Icon],
  template: `
    <span uiBadge [tone]="view().tone">
      @if (view().icon; as icon) {
        <ui-icon [name]="icon" />
      }
      {{ view().label }}
    </span>
    @if (overdue()) {
      <span uiBadge tone="danger"> <ui-icon name="clock" /> Quá hạn </span>
    }
  `,
})
export class CourseStatus {
  readonly status = input.required<CourseStatusValue>();
  readonly overdue = input(false, { transform: booleanAttribute });

  protected readonly view = computed(() => COURSE_STATUS_VIEW[this.status()]);
}
