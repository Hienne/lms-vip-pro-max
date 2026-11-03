import { Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import { Card, CardBody, Field, Input } from '@lms/ui';
import type { CourseDraftValue } from '../../course-draft';

/**
 * Step 3 of the editor: how the course is completed and the reward for it. Completion itself is
 * measured by the server: every required lesson, a video watched past its threshold, a PDF read to
 * its last page. The final exam joins this step in a later module.
 */
@Component({
  selector: 'app-course-rules',
  imports: [Card, CardBody, Field, FormField, Input],
  templateUrl: './course-rules.html',
  styleUrl: './course-rules.scss',
})
export class CourseRules {
  readonly draft = input.required<FieldTree<CourseDraftValue>>();
}
