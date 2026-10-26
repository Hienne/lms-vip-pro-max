import { Component, computed, inject, output, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import type { TargetType } from '@lms/contracts';
import {
  Button,
  Checkbox,
  Field,
  Icon,
  Segmented,
  Select,
  type SegmentedOption,
} from '@lms/ui';
import { TARGET_TYPE_LABEL } from '../../assignment-labels';
import {
  AssignmentsStore,
  type TargetPick,
} from '../../data-access/assignments.store';

interface PickerValue {
  targetType: TargetType;
  userId: string;
  orgId: string;
  teamId: string;
  groupId: string;
  includeDescendants: boolean;
}

const EMPTY: Omit<PickerValue, 'targetType'> = {
  userId: '',
  orgId: '',
  teamId: '',
  groupId: '',
  includeDescendants: true,
};

/**
 * Picks one target of an assignment: a person, a team of an org, an org (with or without its
 * subtree) or a learning group. An incomplete pick cannot be added; the owner keeps the list.
 */
@Component({
  selector: 'app-target-picker',
  imports: [Button, Checkbox, Field, FormField, Icon, Segmented, Select],
  templateUrl: './target-picker.html',
  styleUrl: './target-picker.scss',
})
export class TargetPicker {
  protected readonly store = inject(AssignmentsStore);

  readonly added = output<TargetPick>();

  protected readonly types: readonly SegmentedOption<TargetType>[] = (
    ['org', 'team', 'learning_group', 'user'] as const
  ).map((value) => ({ value, label: TARGET_TYPE_LABEL[value] }));

  private readonly model = signal<PickerValue>({
    targetType: 'org',
    ...EMPTY,
  });
  protected readonly pickerForm = form(this.model);

  /** The pick as a target, or null while a part is missing. */
  protected readonly pick = computed((): TargetPick | null => {
    const value = this.model();
    const name = (list: readonly { id: number; name: string }[], id: string) =>
      list.find((item) => String(item.id) === id)?.name ?? '';
    switch (value.targetType) {
      case 'user': {
        const person = this.store
          .people$()
          .find((p) => p.userId === value.userId);
        return person
          ? {
              targetType: 'user',
              userId: person.userId,
              label: `${person.fullName} · ${person.userId}`,
            }
          : null;
      }
      case 'team':
        return value.orgId && value.teamId
          ? {
              targetType: 'team',
              teamId: Number(value.teamId),
              label: `${name(this.store.teams$(), value.teamId)} · ${name(this.store.orgs$(), value.orgId)}`,
            }
          : null;
      case 'org':
        return value.orgId
          ? {
              targetType: 'org',
              orgId: Number(value.orgId),
              includeDescendants: value.includeDescendants,
              label:
                name(this.store.orgs$(), value.orgId) +
                (value.includeDescendants ? ' và đơn vị cấp dưới' : ''),
            }
          : null;
      case 'learning_group':
        return value.groupId
          ? {
              targetType: 'learning_group',
              groupId: Number(value.groupId),
              label:
                this.store.groups$().find((g) => g.id === value.groupId)?.group
                  .name ?? '',
            }
          : null;
    }
  });

  protected chooseType(type: TargetType): void {
    this.model.set({ targetType: type, ...EMPTY });
    this.store.pickTargetOrg(undefined);
  }

  protected onOrgChange(): void {
    this.model.update((value) => ({ ...value, teamId: '' }));
    if (this.model().targetType === 'team') {
      const orgId = Number(this.model().orgId);
      this.store.pickTargetOrg(orgId || undefined);
    }
  }

  protected add(): void {
    const pick = this.pick();
    if (!pick) return;
    this.added.emit(pick);
    this.model.update((value) => ({ ...value, ...EMPTY }));
  }
}
