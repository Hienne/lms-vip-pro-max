import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '@lms/ui';
import type { BlockView, OutlineChapter } from '../../data-access/lesson.store';
import { BLOCK_TYPE_LABEL } from '../block-list/block-list';

/**
 * "Mục lục": the course's chapters and lessons with the server's status; the current one is marked.
 * Under the current lesson it lists that lesson's blocks, so moving between blocks lives here and not
 * in a strip above the content (SPEC-learning-ui).
 */
@Component({
  selector: 'app-lesson-outline',
  imports: [Icon, RouterLink],
  templateUrl: './lesson-outline.html',
  styleUrl: './lesson-outline.scss',
})
export class LessonOutline {
  readonly chapters = input.required<readonly OutlineChapter[]>();
  /** The current lesson's blocks; listed only when there are two or more to move between. */
  readonly blocks = input<readonly BlockView[]>([]);
  readonly activeBlockId = input<number | undefined>();

  readonly blockSelected = output<number>();

  protected readonly typeLabel = BLOCK_TYPE_LABEL;
}
