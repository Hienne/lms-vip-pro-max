import { Component, inject, input, linkedSignal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import {
  Alert,
  Field,
  Icon,
  IconButton,
  Input,
  NOW,
  Select,
  Switch,
} from '@lms/ui';
import { REQUIREMENT_LABEL } from '../../../../../shared/course/course-labels';
import {
  ENROLLMENT_MODE_LABEL,
  TARGET_TYPE_LABEL,
} from '../../assignment-labels';
import {
  AssignmentsStore,
  type TargetPick,
} from '../../data-access/assignments.store';
import { TargetPicker } from '../target-picker/target-picker';
import {
  assignFormSchema,
  newAssignFormValue,
  toAssignRequest,
} from './assign-form.schema';

/**
 * The assign drawer's form (the mockup's `assignForm`): a published course, one or more targets,
 * the start and due dates, the requirement and the reminder. The server resolves the targets into
 * learners when it saves; the submit button lives in the drawer footer and points here by `form`
 * id.
 */
@Component({
  selector: 'app-assign-form',
  imports: [
    Alert,
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

  /** The course the drawer opens on. */
  readonly courseId = input<number>();

  protected readonly requirements = Object.entries(REQUIREMENT_LABEL);
  protected readonly modes = Object.entries(ENROLLMENT_MODE_LABEL);
  protected readonly typeLabel = TARGET_TYPE_LABEL;

  private readonly model = linkedSignal(() =>
    newAssignFormValue(this.courseId(), this.now()),
  );
  protected readonly assignForm = form(this.model, assignFormSchema, {
    submission: {
      action: async () => this.store.assign(toAssignRequest(this.model())),
    },
  });

  protected addTarget(pick: TargetPick): void {
    const same = (t: TargetPick) =>
      t.targetType === pick.targetType &&
      t.userId === pick.userId &&
      t.teamId === pick.teamId &&
      t.orgId === pick.orgId &&
      t.groupId === pick.groupId;
    this.model.update((value) => ({
      ...value,
      targets: [...value.targets.filter((t) => !same(t)), pick],
    }));
  }

  protected removeTarget(index: number): void {
    this.model.update((value) => ({
      ...value,
      targets: value.targets.filter((_, i) => i !== index),
    }));
  }
}
