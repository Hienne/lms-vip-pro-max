import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '@lms/ui';
import type {
  LessonState,
  OutlineChapter,
} from '../../data-access/course.store';

const STATE_LABEL: Record<LessonState, string> = {
  not_started: 'Chưa học',
  in_progress: 'Đang học',
  completed: 'Đã hoàn thành',
};

/** The chapters and lessons of an enrolled course, each lesson with the server's status. */
@Component({
  selector: 'app-course-outline',
  imports: [Icon, RouterLink],
  templateUrl: './course-outline.html',
  styleUrl: './course-outline.scss',
})
export class CourseOutline {
  readonly chapters = input.required<readonly OutlineChapter[]>();

  protected readonly stateLabel = STATE_LABEL;
}
