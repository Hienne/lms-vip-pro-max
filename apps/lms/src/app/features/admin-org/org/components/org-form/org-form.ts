import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  hidden,
  validateStandardSchema,
} from '@angular/forms/signals';
import { isEmptyPatch, type OrganizationInfo } from '@lms/contracts';
import { Field, Input, Select } from '@lms/ui';
import { OrgStore } from '../../data-access/org.store';
import {
  OrgFormSchema,
  toCreateOrgCommand,
  toOrgFormValue,
  toUpdateOrgCommand,
  type OrgFormValue,
} from './org-form.schema';

/**
 * The add/edit form of an org (a unit or a department). It owns the form model and the
 * validation; the submit button lives in the drawer footer and points here by `form` id. The type
 * and the parent are chosen when adding and fixed afterwards.
 */
@Component({
  selector: 'app-org-form',
  imports: [Field, FormField, FormRoot, Input, Select],
  templateUrl: './org-form.html',
})
export class OrgForm {
  protected readonly store = inject(OrgStore);

  /** The org being edited; `null` adds a new one. */
  readonly org = input.required<OrganizationInfo | null>();

  protected readonly isEdit = computed(() => this.org() !== null);
  protected readonly parents = this.store.units$;

  private readonly model = linkedSignal<OrgFormValue>(() =>
    toOrgFormValue(
      this.org(),
      this.store.selected$()?.orgType === 'UNIT'
        ? (this.store.selected$()?.id ?? null)
        : null,
    ),
  );
  protected readonly orgForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, OrgFormSchema);
      hidden(path.orgType, { when: () => this.isEdit() });
      hidden(path.parentId, { when: () => this.isEdit() });
      hidden(path.status, {
        when: () => !this.isEdit() || !this.store.canManageOrgs$(),
      });
    },
    { submission: { action: async () => this.save() } },
  );

  private save(): void {
    const org = this.org();
    if (!org) {
      this.store.createOrg(toCreateOrgCommand(this.model()));
      return;
    }
    const patch = toUpdateOrgCommand(
      org,
      this.model(),
      this.store.canManageOrgs$(),
    );
    if (isEmptyPatch(patch)) this.store.cancelOrgEdit();
    else this.store.updateOrg(org.id, patch);
  }
}
