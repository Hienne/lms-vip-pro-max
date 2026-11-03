import { Component, computed, inject, input, output } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { Card, CardBody, Icon, LinkButton } from '@lms/ui';
import {
  draftChecks,
  draftTotals,
  type CourseDraftValue,
} from '../../course-draft';
import { CourseEditorStore } from '../../data-access/course-editor.store';
import { AssignRows } from './components/assign-rows/assign-rows';
import { ShareUnits } from './components/share-units/share-units';

/**
 * Step 4 of the editor, in two columns from `lg`: on the left who the course is assigned to and
 * which units it is shared with, as it is published; on the right the checks before publishing
 * and a summary of the draft.
 */
@Component({
  selector: 'app-course-review',
  imports: [AssignRows, Card, CardBody, Icon, LinkButton, ShareUnits],
  templateUrl: './course-review.html',
  styleUrl: './course-review.scss',
})
export class CourseReview {
  readonly draft = input.required<FieldTree<CourseDraftValue>>();
  readonly goToStep = output<number>();

  private readonly store = inject(CourseEditorStore);

  protected readonly checks = computed(() =>
    draftChecks(this.draft()().value(), this.store.quizzes$()),
  );
  protected readonly ready = computed(() =>
    this.checks().every((check) => check.ok || check.optional),
  );
  protected readonly totals = computed(() =>
    draftTotals(this.draft()().value()),
  );
}
