import { Component, computed, inject, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Field,
  Icon,
  Input,
  Progress,
  Select,
  Spinner,
  Table,
  TablePrimary,
  TableSub,
  TableWrap,
} from '@lms/ui';
import { GamificationAdminStore } from '../../data-access/gamification-admin.store';
import {
  badgeFormSchema,
  emptyBadgeForm,
  RULE_LABEL,
  RULE_TYPES,
  toBadgeCommand,
  toBadgeFormValue,
  type BadgeFormValue,
} from './badge-admin.schema';

/**
 * Badge management for system admins: the list with holders and the progress of the background award, and
 * one form for a new or edited badge. Once anyone holds a badge its rule is shown read-only; the server
 * refuses a rule change on it all the same.
 */
@Component({
  selector: 'app-badge-admin',
  imports: [
    Badge,
    Button,
    Empty,
    ErrorState,
    Field,
    FormField,
    FormRoot,
    Icon,
    Input,
    Progress,
    Select,
    Spinner,
    Table,
    TablePrimary,
    TableSub,
    TableWrap,
  ],
  templateUrl: './badge-admin.html',
  styleUrl: './badge-admin.scss',
})
export class BadgeAdmin {
  protected readonly store = inject(GamificationAdminStore);
  protected readonly ruleLabel = RULE_LABEL;
  protected readonly ruleTypes = RULE_TYPES;

  /** The badge being edited, or `null` for a new one. */
  protected readonly editedBadge = computed(() => {
    const editing = this.store.editing$();
    return editing === 'new' || editing === 'closed' ? null : editing;
  });
  /** The rule is read-only once anyone holds the badge. */
  protected readonly ruleLocked = computed(
    () => this.editedBadge()?.locked ?? false,
  );

  private readonly model = linkedSignal<BadgeFormValue>(() => {
    const badge = this.editedBadge();
    return badge ? toBadgeFormValue(badge) : emptyBadgeForm();
  });
  protected readonly badgeForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, () => badgeFormSchema);
    },
    {
      submission: {
        action: async () => {
          this.store.saveBadge(toBadgeCommand(this.model()));
        },
      },
    },
  );

  protected readonly isProgramRule = computed(
    () => this.model().ruleType === 'PROGRAM_COMPLETED',
  );

  protected percent(done: number, total: number): number {
    return total === 0 ? 100 : Math.round((done / total) * 100);
  }
}
