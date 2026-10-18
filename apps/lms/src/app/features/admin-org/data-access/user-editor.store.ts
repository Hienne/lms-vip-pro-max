import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  identityEndpoints,
  MAX_PAGE_SIZE,
  organizationEndpoints,
  type AccountStatus,
  type CreateUserCommand,
  type GrantRequest,
  type UpdateUserCommand,
} from '@lms/contracts';
import { confirm } from '@lms/ui';
import { filter } from 'rxjs';
import {
  invalidation,
  type ChangeToken,
} from '../../../core/data-access/invalidation';
import { serverData } from '../../../core/data-access/server-data';
import { serverMutation } from '../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../core/http/endpoint-client';
import { SessionStore } from '../../../core/session/session.store';
import { scopeLabel } from '../../../shared/status/scope-label';
import type { ManagedUser } from '../components/user-form/user-form.schema';

/** A role grant collected in the add form, with the words the form lists it by. */
export interface PendingGrant {
  readonly request: GrantRequest;
  readonly label: string;
}

type SaveRequest =
  | { readonly kind: 'create'; readonly command: CreateUserCommand }
  | {
      readonly kind: 'update';
      readonly userId: string;
      readonly patch: UpdateUserCommand;
    };

type StatusTarget = {
  readonly userId: string;
  readonly fullName: string;
  readonly status: AccountStatus;
};

/** What each status change asks and tells the admin. */
const STATUS_COPY: Readonly<
  Record<
    AccountStatus,
    {
      readonly done: string;
      readonly confirmLabel: string;
      readonly message: string;
      readonly danger: boolean;
    }
  >
> = {
  active: {
    done: 'Đã kích hoạt tài khoản',
    confirmLabel: 'Kích hoạt',
    message: 'Người dùng có thể đăng nhập lại ngay.',
    danger: false,
  },
  inactive: {
    done: 'Đã tạm dừng tài khoản',
    confirmLabel: 'Tạm dừng',
    message: 'Người dùng không đăng nhập được cho đến khi được kích hoạt lại.',
    danger: true,
  },
  locked: {
    done: 'Đã khóa tài khoản',
    confirmLabel: 'Khóa tài khoản',
    message:
      'Người dùng bị đăng xuất và không thể đăng nhập. Lịch sử học tập được giữ nguyên.',
    danger: true,
  },
};

/**
 * The commands on one user that the users list and the user page share: the add/edit drawer,
 * status changes and role grants, plus the lookups their forms need (roles, orgs, the teams of
 * the org being picked). Each page provides its own instance. `changes` is bumped by every
 * accepted mutation, so the page's own data read reloads: the server, not the response of a
 * mutation, is the source of truth.
 */
@Injectable()
export class UserEditorStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    editing: signal<{ readonly user: ManagedUser | null } | null>(null),
    formOrgId: signal<number | undefined>(undefined),
    grantOrgId: signal<number | undefined>(undefined),
    pendingGrants: signal<readonly PendingGrant[]>([]),
  };

  private readonly changeSource = invalidation();

  /** The token other stores reload on; it cannot be bumped from outside. */
  readonly changes: ChangeToken = {
    version: this.changeSource.version,
  };

  private readonly rolesData = serverData(() =>
    this.client.call(identityEndpoints.listRoles),
  );
  // The orgs in the caller's scope; a flat read of the first page is enough for a select.
  private readonly orgsData = serverData(() =>
    this.client.call(organizationEndpoints.listOrgs, {
      query: { size: MAX_PAGE_SIZE, sort: 'name,asc' },
    }),
  );
  // The teams of the org picked in the user form, and of the one picked in the grant picker.
  private readonly teamsOf = (orgId: () => number | undefined) =>
    serverData(
      (id: number) =>
        this.client.call(organizationEndpoints.listTeams, {
          params: { orgId: id },
          query: { size: MAX_PAGE_SIZE, sort: 'name,asc' },
        }),
      { params: orgId },
    );
  private readonly formTeamsData = this.teamsOf(() => this.state.formOrgId());
  private readonly grantTeamsData = this.teamsOf(() => this.state.grantOrgId());

  private readonly saveMutation = serverMutation(
    (request: SaveRequest) =>
      request.kind === 'create'
        ? this.client.call(identityEndpoints.createUser, {
            body: request.command,
          })
        : this.client.call(identityEndpoints.updateUser, {
            params: { userId: request.userId },
            body: request.patch,
          }),
    {
      errors: 'toast',
      success: (request) =>
        request.kind === 'create'
          ? 'Đã thêm người dùng'
          : 'Đã cập nhật người dùng',
      onSuccess: () => this.setEditing(null),
      invalidates: this.changeSource,
    },
  );

  private readonly statusMutation = serverMutation(
    (target: StatusTarget) =>
      this.client.call(identityEndpoints.setUserStatus, {
        params: { userId: target.userId },
        body: { status: target.status },
      }),
    {
      errors: 'toast',
      success: (target) => STATUS_COPY[target.status].done,
      invalidates: this.changeSource,
    },
  );

  private readonly grantMutation = serverMutation(
    (input: { readonly userId: string; readonly request: GrantRequest }) =>
      this.client.call(identityEndpoints.grantRole, {
        params: { userId: input.userId },
        body: input.request,
      }),
    {
      errors: 'toast',
      success: () => 'Đã cấp vai trò',
      invalidates: this.changeSource,
    },
  );

  private readonly revokeMutation = serverMutation(
    (input: { readonly userId: string; readonly grantId: number }) =>
      this.client.call(identityEndpoints.revokeRole, { params: input }),
    {
      errors: 'toast',
      success: () => 'Đã thu hồi vai trò',
      invalidates: this.changeSource,
    },
  );

  readonly me$ = this.session.user$;
  readonly editing$ = this.state.editing.asReadonly();
  /** The first role grants of the user being added. */
  readonly pendingGrants$ = this.state.pendingGrants.asReadonly();

  readonly roles$ = computed(() => this.rolesData.value() ?? []);
  readonly orgs$ = computed(() => this.orgsData.value()?.items ?? []);
  readonly formTeams$ = computed(() => this.formTeamsData.value()?.items ?? []);
  readonly grantTeams$ = computed(
    () => this.grantTeamsData.value()?.items ?? [],
  );
  /** The lookups are ready, or failed: the drawer shows the form or the failure. */
  readonly lookupError$ = computed(
    () => this.rolesData.error() ?? this.orgsData.error(),
  );
  readonly lookupsReady$ = computed(
    () =>
      this.rolesData.value() !== undefined &&
      this.orgsData.value() !== undefined,
  );

  readonly isSaving$ = this.saveMutation.isPending;
  readonly isChangingStatus$ = this.statusMutation.isPending;
  readonly isGranting$ = this.grantMutation.isPending;
  readonly editorTitle$ = computed(() => {
    const user = this.state.editing()?.user;
    return user ? `Sửa ${user.fullName}` : 'Thêm người dùng';
  });

  // Setters: the only writers of state
  private setEditing(editing: { readonly user: ManagedUser | null } | null) {
    this.state.editing.set(editing);
  }

  private setFormOrgId(orgId: number | undefined): void {
    this.state.formOrgId.set(orgId);
  }

  private setGrantOrgId(orgId: number | undefined): void {
    this.state.grantOrgId.set(orgId);
  }

  private setPendingGrants(grants: readonly PendingGrant[]): void {
    this.state.pendingGrants.set(grants);
  }

  // Commands

  /** Opens the add (`user` null) or edit drawer: the editor shows it while `editing$` is set. */
  edit(user: ManagedUser | null): void {
    this.saveMutation.reset();
    this.setFormOrgId(user?.orgId ?? this.me$()?.org?.id ?? undefined);
    this.setPendingGrants([]);
    this.setEditing({ user });
  }

  cancelEdit(): void {
    this.setEditing(null);
  }

  /** The form's org select changed: load that org's teams. */
  pickFormOrg(orgId: number | undefined): void {
    this.setFormOrgId(orgId);
  }

  /** The grant picker's org select changed: load that org's teams. */
  pickGrantOrg(orgId: number | undefined): void {
    this.setGrantOrgId(orgId);
  }

  /** Adds a grant to the new user's list, worded by role and scope. */
  addPendingGrant(request: GrantRequest): void {
    const role = this.roles$().find((r) => r.roleId === request.roleId);
    const scope = scopeLabel(
      { type: request.scope, orgId: request.orgId, teamId: request.teamId },
      {
        orgName: this.orgs$().find((o) => o.id === request.orgId)?.name,
        teamName: this.grantTeams$().find((t) => t.id === request.teamId)?.name,
      },
    );
    const label = `${role?.name ?? `#${request.roleId}`} · ${scope}`;
    this.setPendingGrants([...this.state.pendingGrants(), { request, label }]);
  }

  removePendingGrant(index: number): void {
    this.setPendingGrants(
      this.state.pendingGrants().filter((_, i) => i !== index),
    );
  }

  create(command: CreateUserCommand): void {
    this.saveMutation.run({ kind: 'create', command });
  }

  update(userId: string, patch: UpdateUserCommand): void {
    this.saveMutation.run({ kind: 'update', userId, patch });
  }

  /** Asks first for a change that stops the user signing in; reactivating needs no question. */
  setStatus(user: Omit<StatusTarget, 'status'>, status: AccountStatus): void {
    const target = { ...user, status };
    const copy = STATUS_COPY[status];
    if (!copy.danger) {
      this.statusMutation.run(target);
      return;
    }
    confirm(this.dialog, {
      title: `${copy.confirmLabel} ${user.fullName}?`,
      message: copy.message,
      confirmLabel: copy.confirmLabel,
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.statusMutation.run(target));
  }

  grant(userId: string, request: GrantRequest): void {
    this.grantMutation.run({ userId, request });
  }

  revoke(userId: string, grantId: number, roleName: string): void {
    confirm(this.dialog, {
      title: `Thu hồi vai trò ${roleName}?`,
      message: 'Người dùng mất quyền ngay; lịch sử cấp quyền được giữ lại.',
      confirmLabel: 'Thu hồi',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.revokeMutation.run({ userId, grantId }));
  }
}
