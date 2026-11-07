import { computed, inject, Injectable } from '@angular/core';
import { authV1Endpoints, type UpdateMeCommand } from '@lms/contracts';
import { MyLevelStore } from '../../../../core/learning/my-level.store';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import { scopeLabel } from '../../../../shared/status/scope-label';

/**
 * The profile page: the signed-in user from the session, and the one command it offers, saving
 * the personal fields. The backend answers the refreshed `/me`, which becomes the signed-in
 * user. A refusal shows its message as a toast and leaves the form as it was.
 * Changing the password is `PasswordChangeStore`, shared with the forced change.
 */
@Injectable()
export class ProfileStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly myLevel = inject(MyLevelStore);

  private readonly saveMutation = serverMutation(
    (command: UpdateMeCommand) =>
      this.client.call(authV1Endpoints.updateMe, { body: command }),
    {
      errors: 'toast',
      success: () => 'Đã lưu hồ sơ',
      onSuccess: (me) => this.session.apply(me),
    },
  );

  readonly user$ = this.session.user$;
  /** The learner's level from the server; undefined for anyone who has none or while it loads. */
  readonly level$ = this.myLevel.level$;
  /** Accounts synced from SSO are read-only here: the source system owns their fields. */
  readonly readOnly$ = computed(() => this.user$()?.authProvider === 'SSO');
  readonly isSaving$ = this.saveMutation.isPending;

  /** One badge per distinct role, as a user with two grants of one role shows it once. */
  readonly roles$ = computed(() => {
    const seen = new Map<string, string>();
    for (const grant of this.user$()?.grants ?? []) {
      seen.set(grant.roleCode, grant.roleName);
    }
    return [...seen].map(([code, name]) => ({ code, name }));
  });

  /** The functions granted to the user, in the sidebar's order. */
  readonly menuItems$ = computed(() =>
    (this.user$()?.nav ?? []).flatMap((section) => section.items),
  );

  readonly grants$ = computed(() => {
    const user = this.user$();
    return (user?.grants ?? []).map((grant) => ({
      roleName: grant.roleName,
      scope: scopeLabel(grant.scope, {
        orgName: grant.scope.orgId === user?.org?.id ? user?.org?.name : null,
        teamName:
          grant.scope.teamId === user?.team?.id ? user?.team?.name : null,
      }),
    }));
  });

  save(command: UpdateMeCommand): void {
    this.saveMutation.run(command);
  }
}
