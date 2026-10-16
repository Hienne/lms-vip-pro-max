import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  adminOrgEndpoints,
  type OrgGroup,
  type OrgUnit,
  type SaveGroupCommand,
  type SaveUnitCommand,
} from '@lms/contracts';
import { confirm, openDrawer, type DrawerContext } from '@lms/ui';
import { filter } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { SessionStore } from '../../../../core/session/session.store';
import { EndpointClient } from '../../../../core/http/endpoint-client';

type Editing =
  | { readonly kind: 'unit'; readonly unit: OrgUnit | null }
  | {
      readonly kind: 'group';
      readonly unit: OrgUnit;
      readonly group: OrgGroup | null;
    };

type StatusRequest = {
  readonly unitId: string;
  readonly status: 'active' | 'paused';
};

/**
 * The org screen (the mockup's `org` page): the units the caller may see, the one picked, and the
 * commands on units and groups. Every accepted mutation bumps `changes`, which the list reloads
 * on, so the page shows the server's truth (the mock API is stateless).
 */
@Injectable()
export class OrgStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    selectedUnitId: signal<string | null>(null),
    editing: signal<Editing | null>(null),
  };

  /** The CDK handle of the open drawer: an imperative UI object, not state. */
  private drawer?: { close(): void };

  private readonly changes = invalidation();

  private readonly orgData = serverData(
    () => this.client.call(adminOrgEndpoints.org),
    {
      reloadOn: this.changes,
    },
  );

  private readonly unitMutation = serverMutation(
    (command: SaveUnitCommand) =>
      this.client.call(adminOrgEndpoints.saveUnit, { body: command }),
    {
      errors: 'inline',
      success: () => 'Đã lưu',
      onSuccess: () => this.drawer?.close(),
      invalidates: this.changes,
    },
  );

  private readonly groupMutation = serverMutation(
    (command: SaveGroupCommand) =>
      this.client.call(adminOrgEndpoints.saveGroup, { body: command }),
    {
      errors: 'inline',
      success: () => 'Đã lưu',
      onSuccess: () => this.drawer?.close(),
      invalidates: this.changes,
    },
  );

  private readonly statusMutation = serverMutation(
    (request: StatusRequest) =>
      this.client.call(adminOrgEndpoints.setUnitStatus, {
        params: { unitId: request.unitId },
        body: { status: request.status },
      }),
    {
      errors: 'toast',
      success: () => 'Đã cập nhật',
      invalidates: this.changes,
    },
  );

  private readonly deleteMutation = serverMutation(
    (groupId: string) =>
      this.client.call(adminOrgEndpoints.deleteGroup, { params: { groupId } }),
    {
      errors: 'toast',
      success: () => 'Đã xóa',
      invalidates: this.changes,
    },
  );

  readonly editing$ = this.state.editing.asReadonly();
  readonly units$ = computed(() => this.orgData.value() ?? []);
  readonly isLoading$ = this.orgData.isLoading;
  readonly loadError$ = this.orgData.error;

  /** The picked unit, or the first one until the user picks. */
  readonly selected$ = computed(() => {
    const units = this.units$();
    return (
      units.find((unit) => unit.id === this.state.selectedUnitId()) ?? units[0]
    );
  });

  /** Only a whole-system caller creates units and pauses them; a limited one edits its own. */
  readonly canManageUnits$ = computed(
    () => this.session.user$()?.scopeUnitId === null,
  );

  readonly isSavingUnit$ = this.unitMutation.isPending;
  readonly unitError$ = this.unitMutation.error;
  readonly isSavingGroup$ = this.groupMutation.isPending;
  readonly groupError$ = this.groupMutation.error;

  private setSelectedUnitId(id: string | null): void {
    this.state.selectedUnitId.set(id);
  }

  private setEditing(editing: Editing | null): void {
    this.state.editing.set(editing);
  }

  private openEditor(
    editing: Editing,
    title: string,
    body: TemplateRef<DrawerContext>,
    footer: TemplateRef<DrawerContext>,
  ): void {
    const ref = openDrawer(this.dialog, body, { title, footer });
    this.drawer = ref;
    this.unitMutation.reset();
    this.groupMutation.reset();
    this.setEditing(editing);
    ref.closed.subscribe(() => {
      this.drawer = undefined;
      this.setEditing(null);
    });
  }

  pick(unitId: string): void {
    this.setSelectedUnitId(unitId);
  }

  /** Opens the add-unit (`null`) or the edit-unit drawer. */
  editUnit(
    unit: OrgUnit | null,
    body: TemplateRef<DrawerContext>,
    footer: TemplateRef<DrawerContext>,
  ): void {
    this.openEditor(
      { kind: 'unit', unit },
      unit ? 'Sửa đơn vị' : 'Thêm đơn vị',
      body,
      footer,
    );
  }

  /** Opens the add-group (`null`) or the rename-group drawer, for the picked unit. */
  editGroup(
    group: OrgGroup | null,
    body: TemplateRef<DrawerContext>,
    footer: TemplateRef<DrawerContext>,
  ): void {
    const unit = this.selected$();
    if (!unit) return;
    this.openEditor(
      { kind: 'group', unit, group },
      group ? 'Đổi tên phòng/nhóm' : `Thêm phòng/nhóm vào ${unit.name}`,
      body,
      footer,
    );
  }

  saveUnit(command: SaveUnitCommand): void {
    this.unitMutation.run(command);
  }

  saveGroup(command: Omit<SaveGroupCommand, 'unitId'>): void {
    const editing = this.state.editing();
    if (editing?.kind !== 'group') return;
    this.groupMutation.run({ ...command, unitId: editing.unit.id });
  }

  /** Asks first, then pauses an active unit or reactivates a paused one. */
  toggleUnitStatus(unit: OrgUnit): void {
    const pausing = unit.status === 'active';
    confirm(this.dialog, {
      title: `${pausing ? 'Tạm dừng' : 'Kích hoạt'} đơn vị ${unit.name}?`,
      message: 'Thay đổi áp dụng ngay cho mọi người dùng thuộc đơn vị.',
      tone: 'warning',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.statusMutation.run({
          unitId: unit.id,
          status: pausing ? 'paused' : 'active',
        }),
      );
  }

  /** Asks first; the server refuses a group that still has members. */
  deleteGroup(group: OrgGroup): void {
    confirm(this.dialog, {
      title: 'Xóa phòng/nhóm?',
      message: 'Chỉ xóa được nhóm không còn thành viên.',
      confirmLabel: 'Xóa',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.deleteMutation.run(group.id));
  }

  retryLoad(): void {
    this.orgData.reload();
  }
}
