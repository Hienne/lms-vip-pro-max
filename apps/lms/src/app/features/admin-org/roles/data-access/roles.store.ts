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
import type { Role, SaveRoleCommand } from '@lms/contracts';
import { confirm, openDrawer, type DrawerContext } from '@lms/ui';
import { filter } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { AdminOrgApi } from '../../data-access/admin-org.api';

/**
 * The roles screen: the roles the server holds, and the commands to add, change and delete one.
 * Every accepted mutation bumps `changes`, which the list reloads on, so the page shows the
 * server's truth (Prism is stateless).
 */
@Injectable()
export class RolesStore {
  private readonly api = inject(AdminOrgApi);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    editing: signal<{ readonly role: Role | null } | null>(null),
  };

  /** The CDK handle of the open drawer: an imperative UI object, not state. */
  private drawer?: { close(): void };

  private readonly changes = invalidation();

  private readonly rolesData = serverData(() => this.api.roles(), {
    reloadOn: this.changes,
  });

  private readonly saveMutation = serverMutation(
    (command: SaveRoleCommand) => this.api.saveRole(command),
    {
      errors: 'inline',
      success: (command) =>
        command.id ? 'Đã cập nhật vai trò' : 'Đã thêm vai trò',
      onSuccess: () => this.drawer?.close(),
      invalidates: this.changes,
    },
  );

  private readonly deleteMutation = serverMutation(
    (roleId: string) => this.api.deleteRole(roleId),
    {
      errors: 'toast',
      success: () => 'Đã xóa vai trò',
      invalidates: this.changes,
    },
  );

  readonly editing$ = this.state.editing.asReadonly();
  readonly roles$ = computed(() => this.rolesData.value() ?? []);
  readonly isLoading$ = this.rolesData.isLoading;
  readonly loadError$ = this.rolesData.error;
  readonly isSaving$ = this.saveMutation.isPending;
  readonly saveError$ = this.saveMutation.error;

  private setEditing(editing: { readonly role: Role | null } | null): void {
    this.state.editing.set(editing);
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
    this.saveMutation.reset();
    this.setEditing({ role });
    ref.closed.subscribe(() => {
      this.drawer = undefined;
      this.setEditing(null);
    });
  }

  save(command: SaveRoleCommand): void {
    this.saveMutation.run(command);
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
      .subscribe(() => this.deleteMutation.run(role.id));
  }

  retryLoad(): void {
    this.rolesData.reload();
  }
}
