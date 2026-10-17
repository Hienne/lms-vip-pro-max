import {
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import type {
  GrantRequest,
  OrganizationInfo,
  RoleOption,
  ScopeType,
  TeamInfo,
} from '@lms/contracts';
import { Button, Field, Icon, Select } from '@lms/ui';
import { SCOPE_TYPE_LABEL } from '../../../../shared/status/scope-label';

interface PickerValue {
  roleId: string;
  scope: ScopeType | '';
  orgId: string;
  teamId: string;
}

const EMPTY: PickerValue = { roleId: '', scope: '', orgId: '', teamId: '' };

/**
 * Picks one role grant: a role, then a scope the role can be given at, then the org and team the
 * scope needs. The server's `assignableScopes` decide what is offered; an incomplete pick cannot
 * be added. Used by the add-user drawer and the grants tab of the user page.
 */
@Component({
  selector: 'app-grant-picker',
  imports: [Button, Field, FormField, Icon, Select],
  templateUrl: './grant-picker.html',
  styleUrl: './grant-picker.scss',
})
export class GrantPicker {
  readonly roles = input.required<readonly RoleOption[]>();
  readonly orgs = input.required<readonly OrganizationInfo[]>();
  /** The teams of the org picked last: the owner loads them when `orgChosen` fires. */
  readonly teams = input.required<readonly TeamInfo[]>();
  readonly busy = input(false);
  readonly orgChosen = output<number | undefined>();
  readonly added = output<GrantRequest>();

  private readonly model = linkedSignal<readonly RoleOption[], PickerValue>({
    source: this.roles,
    computation: () => ({ ...EMPTY }),
  });
  protected readonly pickerForm = form(this.model);

  protected readonly assignable = computed(() =>
    this.roles().filter((role) => role.assignableScopes.length > 0),
  );
  private readonly role = computed(() =>
    this.roles().find((role) => String(role.roleId) === this.model().roleId),
  );
  protected readonly scopes = computed(() =>
    (this.role()?.assignableScopes ?? []).map((type) => ({
      value: type,
      label: SCOPE_TYPE_LABEL[type],
    })),
  );
  protected readonly needsOrg = computed(() =>
    ['ORG', 'TEAM'].includes(this.model().scope),
  );
  protected readonly needsTeam = computed(() => this.model().scope === 'TEAM');

  /** The request the pick adds up to, or null while a part is missing. */
  protected readonly request = computed((): GrantRequest | null => {
    const { roleId, scope, orgId, teamId } = this.model();
    if (!roleId || !scope) return null;
    const request: GrantRequest = { roleId: Number(roleId), scope };
    if (scope === 'ORG') {
      return orgId ? { ...request, orgId: Number(orgId) } : null;
    }
    if (scope === 'TEAM') {
      return orgId && teamId
        ? { ...request, orgId: Number(orgId), teamId: Number(teamId) }
        : null;
    }
    return request;
  });

  protected onRoleChange(): void {
    const first = this.role()?.assignableScopes[0] ?? '';
    this.model.update((value) => ({
      ...value,
      scope: first,
      orgId: '',
      teamId: '',
    }));
    this.orgChosen.emit(undefined);
  }

  protected onScopeChange(): void {
    this.model.update((value) => ({ ...value, orgId: '', teamId: '' }));
    this.orgChosen.emit(undefined);
  }

  protected onOrgChange(): void {
    this.model.update((value) => ({ ...value, teamId: '' }));
    const orgId = this.model().orgId;
    this.orgChosen.emit(orgId ? Number(orgId) : undefined);
  }

  protected add(): void {
    const request = this.request();
    if (!request) return;
    this.added.emit(request);
    this.model.set({ ...EMPTY });
    this.orgChosen.emit(undefined);
  }
}
