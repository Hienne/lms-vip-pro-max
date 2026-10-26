import { Component, computed, input, output } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import { Card, CardBody, Field, Icon, Input, LinkButton } from '@lms/ui';
import { draftChecks, type CourseDraftValue } from '../../course-draft';

/**
 * Step 3 of the editor: how the course is completed, the reward, and the checks before
 * publishing. Completion itself is measured by the server: every required lesson, a video watched
 * past its threshold, a PDF read to its last page.
 */
@Component({
  selector: 'app-course-finish',
  imports: [Card, CardBody, Field, FormField, Icon, Input, LinkButton],
  templateUrl: './course-finish.html',
  styleUrl: './course-finish.scss',
})
export class CourseFinish {
  readonly draft = input.required<FieldTree<CourseDraftValue>>();
  readonly goToStep = output<number>();

  protected readonly checks = computed(() =>
    draftChecks(this.draft()().value()),
  );
  protected readonly ready = computed(() =>
    this.checks().every((check) => check.ok || check.optional),
  );
}
