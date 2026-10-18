import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  organizationEndpoints,
  type CreateOrgCommand,
  type CreateTeamCommand,
  type OrganizationInfo,
  type TeamInfo,
  type UpdateOrgCommand,
  type UpdateTeamCommand,
} from '@lms/contracts';
import { confirm } from '@lms/ui';
import { filter } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import { OrgTreeStore } from './org-tree.store';

export const TEAMS_PAGE_SIZE = 6;

type OrgSave =
  | { readonly kind: 'create'; readonly command: CreateOrgCommand }
  | {
      readonly kind: 'update';
      readonly orgId: number;
      readonly patch: UpdateOrgCommand;
    };

type TeamSave =
  | {
      readonly kind: 'create';
      readonly orgId: number;
      readonly command: CreateTeamCommand;
    }
  | {
      readonly kind: 'update';
      readonly teamId: number;
      readonly patch: UpdateTeamCommand;
    };

/**
 * The org screen (the mockup's `org` page): the picked org with its administrators and its teams,
 * and the commands on orgs and teams. The tree itself is `OrgTreeStore`. Every accepted mutation
 * bumps `changes` (the detail and the teams reload on it) and refreshes the tree.
 */
@Injectable()
export class OrgStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly tree = inject(OrgTreeStore);

  private readonly selectedOrgId = computed(() => this.tree.selected$()?.id);

  private readonly state = {
    editingOrg: signal<{ readonly org: OrganizationInfo | null } | null>(null),
    editingTeam: signal<{ readonly team: TeamInfo | null } | null>(null),
    /** The team page being read (0-based); a different org starts again at the first. */
    teamPage: linkedSignal<number | undefined, number>({
      source: this.selectedOrgId,
      computation: () => 0,
    }),
  };

  private readonly changes = invalidation();

  private readonly detailData = serverData(
    (orgId: number) =>
      this.client.call(organizationEndpoints.getOrg, { params: { orgId } }),
    { params: () => this.selectedOrgId(), reloadOn: this.changes },
  );
  private readonly teamsData = serverData(
    (read: { orgId: number; page: number }) =>
      this.client.call(organizationEndpoints.listTeams, {
        params: { orgId: read.orgId },
        query: { page: read.page, size: TEAMS_PAGE_SIZE, sort: 'name,asc' },
      }),
    {
      params: () => {
        const orgId = this.selectedOrgId();
        return orgId === undefined
          ? undefined
          : { orgId, page: this.state.teamPage() };
      },
      reloadOn: this.changes,
    },
  );

  private readonly orgMutation = serverMutation(
    (save: OrgSave) =>
      save.kind === 'create'
        ? this.client.call(organizationEndpoints.createOrg, {
            body: save.command,
          })
        : this.client.call(organizationEndpoints.updateOrg, {
            params: { orgId: save.orgId },
            body: save.patch,
          }),
    {
      errors: 'toast',
      success: () => 'Đã lưu',
      onSuccess: (org) => {
        this.setEditingOrg(null);
        this.tree.refresh();
        if (org.parentId) this.tree.reveal(org.parentId);
      },
      invalidates: this.changes,
    },
  );

  private readonly statusMutation = serverMutation(
    (org: OrganizationInfo) =>
      this.client.call(organizationEndpoints.updateOrg, {
        params: { orgId: org.id },
        body: { status: org.status === 'active' ? 'inactive' : 'active' },
      }),
    {
      errors: 'toast',
      success: () => 'Đã cập nhật',
      onSuccess: () => this.tree.refresh(),
      invalidates: this.changes,
    },
  );

  private readonly teamMutation = serverMutation(
    (save: TeamSave) =>
      save.kind === 'create'
        ? this.client.call(organizationEndpoints.createTeam, {
            params: { orgId: save.orgId },
            body: save.command,
          })
        : this.client.call(organizationEndpoints.updateTeam, {
            params: { teamId: save.teamId },
            body: save.patch,
          }),
    {
      errors: 'toast',
      success: () => 'Đã lưu',
      onSuccess: () => {
        this.setEditingTeam(null);
        this.tree.refresh();
      },
      invalidates: this.changes,
    },
  );

  private readonly deleteMutation = serverMutation(
    (teamId: number) =>
      this.client.call(organizationEndpoints.deleteTeam, {
        params: { teamId },
      }),
    {
      errors: 'toast',
      success: () => 'Đã xóa nhóm',
      onSuccess: () => this.tree.refresh(),
      invalidates: this.changes,
    },
  );

  readonly editingOrg$ = this.state.editingOrg.asReadonly();
  readonly editingTeam$ = this.state.editingTeam.asReadonly();
  readonly detail$ = this.detailData.value;
  readonly detailError$ = this.detailData.error;
  readonly teams$ = computed(() => this.teamsData.value()?.items ?? []);
  readonly teamsTotal$ = computed(
    () => this.teamsData.value()?.totalElements ?? 0,
  );
  readonly teamPage$ = computed(() => this.state.teamPage() + 1);
  readonly teamsLoading$ = this.teamsData.isLoading;
  readonly teamsError$ = this.teamsData.error;

  /** Creating an org and pausing one are for global administrators; the server enforces it. */
  readonly canManageOrgs$ = computed(
    () =>
      this.session.user$()?.grants.some((g) => g.scope.type === 'GLOBAL') ??
      false,
  );

  readonly isSavingOrg$ = this.orgMutation.isPending;
  readonly isSavingTeam$ = this.teamMutation.isPending;
  readonly orgEditorTitle$ = computed(() =>
    this.state.editingOrg()?.org ? 'Sửa đơn vị' : 'Thêm đơn vị / phòng',
  );
  readonly teamEditorTitle$ = computed(() =>
    this.state.editingTeam()?.team ? 'Sửa nhóm' : 'Thêm nhóm',
  );

  // Setters: the only writers of state
  private setEditingOrg(
    editing: { readonly org: OrganizationInfo | null } | null,
  ): void {
    this.state.editingOrg.set(editing);
  }

  private setEditingTeam(
    editing: { readonly team: TeamInfo | null } | null,
  ): void {
    this.state.editingTeam.set(editing);
  }

  private setTeamPage(page: number): void {
    this.state.teamPage.set(page);
  }

  // Commands
  /** Opens the add (`null`) or edit drawer of an org: the page shows it while `editingOrg$` is set. */
  editOrg(org: OrganizationInfo | null): void {
    this.orgMutation.reset();
    this.setEditingOrg({ org });
  }

  cancelOrgEdit(): void {
    this.setEditingOrg(null);
  }

  editTeam(team: TeamInfo | null): void {
    this.teamMutation.reset();
    this.setEditingTeam({ team });
  }

  cancelTeamEdit(): void {
    this.setEditingTeam(null);
  }

  goToTeamPage(page: number): void {
    this.setTeamPage(page - 1);
  }

  createOrg(command: CreateOrgCommand): void {
    this.orgMutation.run({ kind: 'create', command });
  }

  updateOrg(orgId: number, patch: UpdateOrgCommand): void {
    this.orgMutation.run({ kind: 'update', orgId, patch });
  }

  createTeam(orgId: number, command: CreateTeamCommand): void {
    this.teamMutation.run({ kind: 'create', orgId, command });
  }

  updateTeam(teamId: number, patch: UpdateTeamCommand): void {
    this.teamMutation.run({ kind: 'update', teamId, patch });
  }

  /** Asks first, then pauses an active org or reactivates a paused one. */
  toggleOrgStatus(org: OrganizationInfo): void {
    const pausing = org.status === 'active';
    confirm(this.dialog, {
      title: `${pausing ? 'Tạm dừng' : 'Kích hoạt'} ${org.name}?`,
      message: 'Thay đổi áp dụng ngay cho mọi người dùng thuộc đơn vị.',
      tone: 'warning',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.statusMutation.run(org));
  }

  /** Asks first; the server refuses a team that still has members or grants. */
  deleteTeam(team: TeamInfo): void {
    confirm(this.dialog, {
      title: `Xóa nhóm ${team.name}?`,
      message:
        'Chỉ xóa được nhóm không còn thành viên và không còn quyền gắn với nhóm.',
      confirmLabel: 'Xóa',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.deleteMutation.run(team.id));
  }

  retryDetail(): void {
    this.detailData.reload();
  }
}
