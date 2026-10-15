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
import type { Role, SaveRoleCommand } from '@lms/contracts';
import { confirm, openDrawer, Toaster, type DrawerContext } from '@lms/ui';
import { filter, tap } from 'rxjs';
import { toAppError } from '../../../../core/errors/app-error';
import { AdminOrgApi } from '../../data-access/admin-org.api';

/**
 * The roles screen: the roles the server holds, and the commands to add, change and delete one.
 * Every accepted mutation bumps `changes`, which the list resource reads in `params`, so the page
 * reloads from the server (Prism is stateless).
 */
@Injectable()
export class RolesStore {
  private readonly api = inject(AdminOrgApi);
  private readonly dialog = inject(Dialog);
  private readonly toaster = inject(Toaster);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    editing: signal<{ readonly role: Role | null } | null>(null),
    saveRequest: signal<SaveRoleCommand | undefined>(undefined),
    deleteRequest: signal<{ readonly roleId: string } | undefined>(undefined),
    changes: signal(0),
  };

  /** The CDK handle of the open drawer: an imperative UI object, not state. */
  private drawer?: { close(): void };

  private readonly rolesResource = rxResource({
    params: () => ({ changes: this.state.changes() }),
    stream: () => this.api.roles(),
  });

  /** The last list the server sent: it stays on screen while a reload is under way. */
  private readonly latest = linkedSignal<
    Role[] | undefined,
    Role[] | undefined
  >({
    source: () =>
      this.rolesResource.hasValue() ? this.rolesResource.value() : undefined,
    computation: (value, previous) => value ?? previous?.value,
  });

  private readonly saveResource = rxResource({
    params: () => this.state.saveRequest(),
    stream: ({ params: command }) =>
      this.api.saveRole(command).pipe(
        tap(() => {
          this.drawer?.close();
          this.bump();
          this.toaster.success(
            command.id ? 'Đã cập nhật vai trò' : 'Đã thêm vai trò',
          );
        }),
      ),
  });

  private readonly deleteResource = rxResource({
    params: () => this.state.deleteRequest(),
    stream: ({ params: request }) =>
      this.api.deleteRole(request.roleId).pipe(
        tap({
          next: () => {
            this.bump();
            this.toaster.success('Đã xóa vai trò');
          },
          error: (error: unknown) =>
            this.toaster.error(toAppError(error).message),
        }),
      ),
  });

  readonly editing$ = this.state.editing.asReadonly();
  readonly roles$ = computed(() => this.latest() ?? []);
  readonly isLoading$ = computed(
    () => this.rolesResource.isLoading() && this.latest() === undefined,
  );
  readonly loadError$ = computed(() =>
    this.rolesResource.error()
      ? toAppError(this.rolesResource.error())
      : undefined,
  );
  readonly isSaving$ = this.saveResource.isLoading;
  readonly saveError$ = computed(() =>
    this.saveResource.error()
      ? toAppError(this.saveResource.error())
      : undefined,
  );

  private setEditing(editing: { readonly role: Role | null } | null): void {
    this.state.editing.set(editing);
  }

  private setSaveRequest(command: SaveRoleCommand | undefined): void {
    this.state.saveRequest.set(command);
  }

  private setDeleteRequest(
    request: { readonly roleId: string } | undefined,
  ): void {
    this.state.deleteRequest.set(request);
  }

  private setChanges(count: number): void {
    this.state.changes.set(count);
  }

  private bump(): void {
    this.setChanges(this.state.changes() + 1);
  }

  /** Opens the add (`null`) or edit drawer; the templates come from the page. */
  edit(
    role: Role | null,
    body: TemplateRef<DrawerContext>,
    footer: TemplateRef<DrawerContext>,
  ): void {
    const ref = openDrawer(this.dialog, body, {
      title: role ? `Sửa vai trò ${role.name}` : 'Thêm vai trò',
      footer,
    });
    this.drawer = ref;
    this.setSaveRequest(undefined);
    this.setEditing({ role });
    ref.closed.subscribe(() => {
      this.drawer = undefined;
      this.setEditing(null);
    });
  }

  save(command: SaveRoleCommand): void {
    this.setSaveRequest({ ...command });
  }

  /** Asks first; the server refuses a system role and one that users still hold. */
  remove(role: Role): void {
    confirm(this.dialog, {
      title: `Xóa vai trò ${role.name}?`,
      message: 'Chỉ xóa được vai trò tùy chỉnh không còn người dùng nào giữ.',
      confirmLabel: 'Xóa',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.setDeleteRequest({ roleId: role.id }));
  }

  retryLoad(): void {
    this.rolesResource.reload();
  }
}
