import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { form, FormField, FormRoot, validate } from '@angular/forms/signals';
import { ASSIGNMENT_LIMITS, type GroupDetail } from '@lms/contracts';
import { Alert, Button, Field, Icon, IconButton, Select } from '@lms/ui';
import { AssignmentsStore } from '../../data-access/assignments.store';

/**
 * The members of a learning group, edited as one list and saved at once (the server replaces the
 * whole list). Assignments already made keep their learners.
 */
@Component({
  selector: 'app-group-members',
  imports: [
    Alert,
    Button,
    Field,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Select,
  ],
  templateUrl: './group-members.html',
  styleUrl: './group-members.scss',
})
export class GroupMembers {
  protected readonly store = inject(AssignmentsStore);

  readonly detail = input.required<GroupDetail>();

  private readonly model = linkedSignal(() => ({
    userIds: this.detail()
      .members.filter((m) => !m.leftAt)
      .map((m) => m.userId),
    pick: '',
  }));
  protected readonly membersForm = form(
    this.model,
    (path) => {
      validate(path.userIds, ({ value }) =>
        value().length > ASSIGNMENT_LIMITS.groupMembers
          ? {
              kind: 'members',
              message: `Nhóm tối đa ${ASSIGNMENT_LIMITS.groupMembers} thành viên.`,
            }
          : undefined,
      );
    },
    {
      submission: {
        action: async () =>
          this.store.saveMembers(this.detail().group, [
            ...this.model().userIds,
          ]),
      },
    },
  );

  private readonly people = computed(
    () => new Map(this.store.people$().map((p) => [p.userId, p])),
  );

  protected readonly members = computed(() =>
    this.model().userIds.map((userId) => {
      const person = this.people().get(userId);
      return {
        userId,
        name: person?.fullName ?? userId,
        place: [person?.orgName, person?.teamName].filter(Boolean).join(' · '),
      };
    }),
  );

  protected readonly candidates = computed(() => {
    const chosen = new Set(this.model().userIds);
    return this.store.people$().filter((p) => !chosen.has(p.userId));
  });

  protected add(): void {
    this.model.update((value) =>
      value.pick && !value.userIds.includes(value.pick)
        ? { userIds: [...value.userIds, value.pick], pick: '' }
        : value,
    );
  }

  protected remove(userId: string): void {
    this.model.update((value) => ({
      ...value,
      userIds: value.userIds.filter((id) => id !== userId),
    }));
  }
}
