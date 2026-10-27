import { Component, inject, input, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import { isEmptyPatch, type TeamInfo } from '@lms/contracts';
import { Field, Input, Textarea } from '@lms/ui';
import { OrgStore } from '../../data-access/org.store';
import {
  TeamFormSchema,
  toCreateTeamCommand,
  toTeamFormValue,
  toUpdateTeamCommand,
} from './team-form.schema';

/**
 * The add/edit form of a team of the picked org. It owns the form model and the validation; the
 * submit button lives in the drawer footer and points here by `form` id.
 */
@Component({
  selector: 'app-team-form',
  imports: [Field, FormField, FormRoot, Input, Textarea],
  templateUrl: './team-form.html',
})
export class TeamForm {
  private readonly store = inject(OrgStore);

  /** The team being edited; `null` adds a new one. */
  readonly team = input.required<TeamInfo | null>();

  private readonly model = linkedSignal(() => toTeamFormValue(this.team()));
  protected readonly teamForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, TeamFormSchema);
    },
    { submission: { action: async () => this.save() } },
  );

  private save(): void {
    const team = this.team();
    if (!team) {
      const orgId = this.store.selected$()?.id;
      if (orgId !== undefined) {
        this.store.createTeam(orgId, toCreateTeamCommand(this.model()));
      }
      return;
    }
    const patch = toUpdateTeamCommand(team, this.model());
    if (isEmptyPatch(patch)) this.store.cancelTeamEdit();
    else this.store.updateTeam(team.id, patch);
  }
}
