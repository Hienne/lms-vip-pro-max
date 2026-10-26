import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '@lms/ui';
import type { OutlineChapter } from '../../data-access/lesson.store';

/** "Mục lục": the course's chapters and lessons with the server's status; the current one is marked. */
@Component({
  selector: 'app-lesson-outline',
  imports: [Icon, RouterLink],
  templateUrl: './lesson-outline.html',
  styleUrl: './lesson-outline.scss',
})
export class LessonOutline {
  readonly chapters = input.required<readonly OutlineChapter[]>();
}
