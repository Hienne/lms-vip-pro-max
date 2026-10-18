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
  adminOrgEndpoints,
  type Role,
  type SaveRoleCommand,
} from '@lms/contracts';
import { confirm } from '@lms/ui';
import { filter } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/**
 * The roles screen: the roles the server holds, and the commands to add, change and delete one.
 * Every accepted mutation bumps `changes`, which the list reloads on, so the page shows the
 * server's truth.
 */
@Injectable()
export class RolesStore {
  private readonly client = inject(EndpointClient);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    editing: signal<{ readonly role: Role | null } | null>(null),
  };

  private readonly changes = invalidation();

  private readonly rolesData = serverData(
    () => this.client.call(adminOrgEndpoints.roles),
    {
      reloadOn: this.changes,
    },
  );

  private readonly saveMutation = serverMutation(
    (command: SaveRoleCommand) =>
      this.client.call(adminOrgEndpoints.saveRole, { body: command }),
    {
      errors: 'toast',
      success: (command) =>
        command.id ? 'Đã cập nhật vai trò' : 'Đã thêm vai trò',
      onSuccess: () => this.setEditing(null),
      invalidates: this.changes,
    },
  );

  private readonly deleteMutation = serverMutation(
    (roleId: string) =>
      this.client.call(adminOrgEndpoints.deleteRole, { params: { roleId } }),
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
  readonly editorTitle$ = computed(() => {
    const role = this.state.editing()?.role;
    return role ? `Sửa vai trò ${role.name}` : 'Thêm vai trò';
  });

  private setEditing(editing: { readonly role: Role | null } | null): void {
    this.state.editing.set(editing);
  }

  /** Opens the add (`null`) or edit drawer: the page shows it while `editing$` is set. */
  edit(role: Role | null): void {
    this.saveMutation.reset();
    this.setEditing({ role });
  }

  cancelEdit(): void {
    this.setEditing(null);
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
