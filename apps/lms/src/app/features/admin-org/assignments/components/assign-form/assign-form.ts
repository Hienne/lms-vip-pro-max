import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import {
  Alert,
  ErrorState,
  Field,
  Icon,
  IconButton,
  Input,
  NOW,
  Select,
  Switch,
} from '@lms/ui';
import { REQUIREMENT_LABEL } from '../../../../../shared/course/course-labels';
import { ENROLLMENT_MODE_LABEL } from '../../assignment-labels';
import { AssignmentsStore } from '../../data-access/assignments.store';
import { TargetPicker } from '../../../../../shared/assignment-target/target-picker/target-picker';
import {
  sameTarget,
  TARGET_TYPE_LABEL,
  type TargetPick,
} from '../../../../../shared/assignment-target/target-labels';
import {
  assignFormSchema,
  newAssignFormValue,
  toAssignRequest,
} from './assign-form.schema';

/**
 * The assignment form in the assign drawer (the mockup's `assignForm`): a published course, one or
 * more targets, the start and due dates, the reminder, then the requirement, the enrolment mode and
 * an optional title. The server resolves the targets into learners when it saves; the submit button
 * lives in the drawer footer and points here by `form` id.
 */
@Component({
  selector: 'app-assign-form',
  imports: [
    Alert,
    ErrorState,
    Field,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Input,
    Select,
    Switch,
    TargetPicker,
  ],
  templateUrl: './assign-form.html',
  styleUrl: './assign-form.scss',
})
export class AssignForm {
  protected readonly store = inject(AssignmentsStore);
  private readonly now = inject(NOW);

  /** The course the editor opens on. */
  readonly courseId = input<number>();

  protected readonly requirements = Object.entries(REQUIREMENT_LABEL);
  protected readonly modes = Object.entries(ENROLLMENT_MODE_LABEL);
  protected readonly typeLabel = TARGET_TYPE_LABEL;

  private readonly model = linkedSignal(() =>
    newAssignFormValue(this.courseId(), this.now()),
  );
  protected readonly selectedCourse = computed(() =>
    this.store
      .courses$()
      .find((course) => String(course.courseId) === this.model().courseId),
  );

  hasUnsavedChanges(): boolean {
    return this.assignForm().dirty() || this.model().targets.length > 0;
  }

  protected readonly assignForm = form(this.model, assignFormSchema, {
    submission: {
      action: async () => this.store.assign(toAssignRequest(this.model())),
    },
  });

  protected addTarget(pick: TargetPick): void {
    this.model.update((value) => ({
      ...value,
      targets: [...value.targets.filter((t) => !sameTarget(t, pick)), pick],
    }));
  }

  protected removeTarget(index: number): void {
    this.model.update((value) => ({
      ...value,
      targets: value.targets.filter((_, i) => i !== index),
    }));
  }
}
