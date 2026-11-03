import { Component, computed, input, output } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { Card, CardBody, Icon, LinkButton } from '@lms/ui';
import {
  draftChecks,
  draftTotals,
  type CourseDraftValue,
} from '../../course-draft';

/**
 * Step 4 of the editor: the checks before publishing and a summary of the draft. Assigning and
 * sharing the course join this step in a later module; until then they stay on their own screens.
 */
@Component({
  selector: 'app-course-review',
  imports: [Card, CardBody, Icon, LinkButton],
  templateUrl: './course-review.html',
  styleUrl: './course-review.scss',
})
export class CourseReview {
  readonly draft = input.required<FieldTree<CourseDraftValue>>();
  readonly goToStep = output<number>();

  protected readonly checks = computed(() =>
    draftChecks(this.draft()().value()),
  );
  protected readonly ready = computed(() =>
    this.checks().every((check) => check.ok || check.optional),
  );
  protected readonly totals = computed(() =>
    draftTotals(this.draft()().value()),
  );
}
