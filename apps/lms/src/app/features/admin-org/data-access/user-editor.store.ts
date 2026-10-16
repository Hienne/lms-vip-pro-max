import { Dialog } from '@angular/cdk/dialog';
import {
  DestroyRef,
  inject,
  Injectable,
  signal,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  adminOrgEndpoints,
  type AccountStatus,
  type SaveUserCommand,
  type UserListItem,
} from '@lms/contracts';
import { confirm, openDrawer, type DrawerContext } from '@lms/ui';
import { filter } from 'rxjs';
import {
  invalidation,
  type ChangeToken,
} from '../../../core/data-access/invalidation';
import { serverData } from '../../../core/data-access/server-data';
import { serverMutation } from '../../../core/data-access/server-mutation';
import { SessionStore } from '../../../core/session/session.store';
import { EndpointClient } from '../../../core/http/endpoint-client';

type StatusRequest = {
  readonly userId: string;
  readonly status: AccountStatus;
};

/**
 * The commands on one user that the users list and the user page share: the add/edit drawer, lock
 * and unlock, and the password reset. Each page provides its own instance. `changes` is bumped by
 * every accepted mutation that alters a user; the page's own data read reloads on it, because the
 * server, not the response of a mutation, is the source of truth (Prism is stateless).
 */
@Injectable()
export class UserEditorStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    editing: signal<{ readonly user: UserListItem | null } | null>(null),
  };

  /** The CDK handle of the open drawer: an imperative UI object, not state. */
  private drawer?: { close(): void };

  private readonly changeSource = invalidation();

  /** The token other stores reload on; it cannot be bumped from outside. */
  readonly changes: ChangeToken = {
    version: this.changeSource.version,
  };

  private readonly metaData = serverData(() =>
    this.client.call(adminOrgEndpoints.adminMeta),
  );

  private readonly saveMutation = serverMutation(
    (command: SaveUserCommand) =>
      this.client.call(adminOrgEndpoints.saveUser, { body: command }),
    {
      errors: 'inline',
      success: (command) =>
        command.id ? 'Đã cập nhật người dùng' : 'Đã thêm người dùng',
      onSuccess: () => this.drawer?.close(),
      invalidates: this.changeSource,
    },
  );

  private readonly statusMutation = serverMutation(
    (request: StatusRequest) =>
      this.client.call(adminOrgEndpoints.setUserStatus, {
        params: { userId: request.userId },
        body: { status: request.status },
      }),
    {
      errors: 'toast',
      success: (request) =>
        request.status === 'locked'
          ? 'Đã khóa tài khoản'
          : 'Đã mở khóa tài khoản',
      invalidates: this.changeSource,
    },
  );

  private readonly resetMutation = serverMutation(
    (userId: string) =>
      this.client.call(adminOrgEndpoints.resetPassword, { params: { userId } }),
    {
      errors: 'toast',
      success: (_userId, result) => ({
        title: 'Đã gửi liên kết đặt lại mật khẩu',
        detail: result.sentTo,
      }),
    },
  );

  readonly me$ = this.session.user$;
  readonly editing$ = this.state.editing.asReadonly();

  readonly meta$ = this.metaData.value;
  readonly metaError$ = this.metaData.error;
  readonly isSaving$ = this.saveMutation.isPending;
  readonly saveError$ = this.saveMutation.error;
  readonly isResetting$ = this.resetMutation.isPending;
  readonly isChangingStatus$ = this.statusMutation.isPending;

  private setEditing(editing: { readonly user: UserListItem | null } | null) {
    this.state.editing.set(editing);
  }

  /** Opens the add (`user` null) or edit drawer; the templates come from the editor component. */
  edit(
    user: UserListItem | null,
    body: TemplateRef<DrawerContext>,
    footer: TemplateRef<DrawerContext>,
  ): void {
    const ref = openDrawer(this.dialog, body, {
      title: user ? `Sửa ${user.name}` : 'Thêm người dùng',
      footer,
    });
    this.drawer = ref;
    this.saveMutation.reset();
    this.setEditing({ user });
    ref.closed.subscribe(() => {
      this.drawer = undefined;
      this.setEditing(null);
    });
  }

  save(command: SaveUserCommand): void {
    this.saveMutation.run(command);
  }

  /** Asks first, then locks an active account or reopens a locked or suspended one. */
  toggleLock(user: UserListItem): void {
    const locking = user.status === 'active';
    confirm(this.dialog, {
      title: locking ? `Khóa tài khoản ${user.name}?` : `Mở khóa ${user.name}?`,
      message: locking
        ? 'Người dùng bị đăng xuất và không thể đăng nhập. Lịch sử học tập được giữ nguyên.'
        : 'Người dùng có thể đăng nhập lại ngay.',
      confirmLabel: locking ? 'Khóa tài khoản' : 'Mở khóa',
      tone: locking ? 'danger' : 'primary',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.statusMutation.run({
          userId: user.id,
          status: locking ? 'locked' : 'active',
        }),
      );
  }

  resetPassword(user: UserListItem): void {
    this.resetMutation.run(user.id);
  }
}
