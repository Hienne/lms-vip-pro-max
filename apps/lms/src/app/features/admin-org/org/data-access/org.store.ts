import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  linkedSignal,
  signal,
  type TemplateRef,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  OrgGroup,
  OrgUnit,
  SaveGroupCommand,
  SaveUnitCommand,
} from '@lms/contracts';
import { confirm, openDrawer, Toaster, type DrawerContext } from '@lms/ui';
import { filter, tap } from 'rxjs';
import { toAppError } from '../../../../core/errors/app-error';
import { SessionStore } from '../../../../core/session/session.store';
import { AdminOrgApi } from '../../data-access/admin-org.api';

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
 * commands on units and groups. Every accepted mutation bumps `changes`, which the list resource
 * reads in `params`, so the page reloads from the server (Prism is stateless).
 */
@Injectable()
export class OrgStore {
  private readonly api = inject(AdminOrgApi);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly toaster = inject(Toaster);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    selectedUnitId: signal<string | null>(null),
    editing: signal<Editing | null>(null),
    unitRequest: signal<SaveUnitCommand | undefined>(undefined),
    groupRequest: signal<SaveGroupCommand | undefined>(undefined),
    statusRequest: signal<StatusRequest | undefined>(undefined),
    deleteRequest: signal<{ readonly groupId: string } | undefined>(undefined),
    changes: signal(0),
  };

  /** The CDK handle of the open drawer: an imperative UI object, not state. */
  private drawer?: { close(): void };

  private readonly orgResource = rxResource({
    params: () => ({ changes: this.state.changes() }),
    stream: () => this.api.org(),
  });

  /** The last list the server sent: it stays on screen while a reload is under way. */
  private readonly latest = linkedSignal<
    OrgUnit[] | undefined,
    OrgUnit[] | undefined
  >({
    source: () =>
      this.orgResource.hasValue() ? this.orgResource.value() : undefined,
    computation: (value, previous) => value ?? previous?.value,
  });

  private readonly unitResource = rxResource({
    params: () => this.state.unitRequest(),
    stream: ({ params: command }) =>
      this.api.saveUnit(command).pipe(
        tap(() => {
          this.drawer?.close();
          this.bump();
          this.toaster.success('Đã lưu');
        }),
      ),
  });

  private readonly groupResource = rxResource({
    params: () => this.state.groupRequest(),
    stream: ({ params: command }) =>
      this.api.saveGroup(command).pipe(
        tap(() => {
          this.drawer?.close();
          this.bump();
          this.toaster.success('Đã lưu');
        }),
      ),
  });

  private readonly statusResource = rxResource({
    params: () => this.state.statusRequest(),
    stream: ({ params: request }) =>
      this.api.setUnitStatus(request.unitId, { status: request.status }).pipe(
        tap({
          next: () => {
            this.bump();
            this.toaster.success('Đã cập nhật');
          },
          error: (error: unknown) =>
            this.toaster.error(toAppError(error).message),
        }),
      ),
  });

  private readonly deleteResource = rxResource({
    params: () => this.state.deleteRequest(),
    stream: ({ params: request }) =>
      this.api.deleteGroup(request.groupId).pipe(
        tap({
          next: () => {
            this.bump();
            this.toaster.success('Đã xóa');
          },
          error: (error: unknown) =>
            this.toaster.error(toAppError(error).message),
        }),
      ),
  });

  readonly editing$ = this.state.editing.asReadonly();
  readonly units$ = computed(() => this.latest() ?? []);
  readonly isLoading$ = computed(
    () => this.orgResource.isLoading() && this.latest() === undefined,
  );
  readonly loadError$ = computed(() =>
    this.orgResource.error() ? toAppError(this.orgResource.error()) : undefined,
  );

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

  readonly isSavingUnit$ = this.unitResource.isLoading;
  readonly unitError$ = computed(() =>
    this.unitResource.error()
      ? toAppError(this.unitResource.error())
      : undefined,
  );
  readonly isSavingGroup$ = this.groupResource.isLoading;
  readonly groupError$ = computed(() =>
    this.groupResource.error()
      ? toAppError(this.groupResource.error())
      : undefined,
  );

  private setSelectedUnitId(id: string | null): void {
    this.state.selectedUnitId.set(id);
  }

  private setEditing(editing: Editing | null): void {
    this.state.editing.set(editing);
  }

  private setUnitRequest(command: SaveUnitCommand | undefined): void {
    this.state.unitRequest.set(command);
  }

  private setGroupRequest(command: SaveGroupCommand | undefined): void {
    this.state.groupRequest.set(command);
  }

  private setStatusRequest(request: StatusRequest | undefined): void {
    this.state.statusRequest.set(request);
  }

  private setDeleteRequest(
    request: { readonly groupId: string } | undefined,
  ): void {
    this.state.deleteRequest.set(request);
  }

  private setChanges(count: number): void {
    this.state.changes.set(count);
  }

  private bump(): void {
    this.setChanges(this.state.changes() + 1);
  }

  private openEditor(
    editing: Editing,
    title: string,
    body: TemplateRef<DrawerContext>,
    footer: TemplateRef<DrawerContext>,
  ): void {
    const ref = openDrawer(this.dialog, body, { title, footer });
    this.drawer = ref;
    this.setUnitRequest(undefined);
    this.setGroupRequest(undefined);
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
    this.setUnitRequest({ ...command });
  }

  saveGroup(command: Omit<SaveGroupCommand, 'unitId'>): void {
    const editing = this.state.editing();
    if (editing?.kind !== 'group') return;
    this.setGroupRequest({ ...command, unitId: editing.unit.id });
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
        this.setStatusRequest({
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
      .subscribe(() => this.setDeleteRequest({ groupId: group.id }));
  }

  retryLoad(): void {
    this.orgResource.reload();
  }
}
