import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '@lms/ui';
import { LessonStatus } from '../../../../../shared/course/lesson-status';
import type { OutlineChapter } from '../../data-access/course.store';

/** The chapters and lessons of an enrolled course, each lesson with the server's status. */
@Component({
  selector: 'app-course-outline',
  imports: [Icon, LessonStatus, RouterLink],
  templateUrl: './course-outline.html',
  styleUrl: './course-outline.scss',
})
export class CourseOutline {
  readonly chapters = input.required<readonly OutlineChapter[]>();
}
