import { Component, input } from '@angular/core';
import { Icon } from '@lms/ui';

export type LessonStatusValue = 'not_started' | 'in_progress' | 'completed';

const LABEL: Record<LessonStatusValue, string> = {
  not_started: 'Chưa học',
  in_progress: 'Đang học',
  completed: 'Đã hoàn thành',
};

/**
 * The one marker for a lesson's or block's state, shared by the course outline and the lesson
 * table of contents: a check for done, a play arrow for in progress, a dash for not started. The
 * shapes differ, so state never rests on colour, and none looks like a radio button. The state
 * is also written for screen readers.
 */
@Component({
  selector: 'app-lesson-status',
  imports: [Icon],
  host: {
    class: 'lesson-status',
    '[attr.data-status]': 'state()',
  },
  template: `
    @switch (state()) {
      @case ('completed') {
        <ui-icon name="circle-check" size="sm" />
      }
      @case ('in_progress') {
        <ui-icon name="play" size="sm" />
      }
      @default {
        <ui-icon name="minus" size="sm" />
      }
    }
    <span class="lesson-status__sr">{{ label() }}</span>
  `,
  styleUrl: './lesson-status.scss',
})
export class LessonStatus {
  readonly state = input.required<LessonStatusValue>();

  protected label(): string {
    return LABEL[this.state()];
  }
}
