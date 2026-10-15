import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, rxResource } from '@angular/core/rxjs-interop';
import type {
  AccountStatus,
  SaveUserCommand,
  UserListItem,
} from '@lms/contracts';
import { confirm, openDrawer, Toaster, type DrawerContext } from '@lms/ui';
import type { TemplateRef } from '@angular/core';
import { filter, tap } from 'rxjs';
import { toAppError } from '../../../core/errors/app-error';
import { SessionStore } from '../../../core/session/session.store';
import { AdminOrgApi } from './admin-org.api';

type StatusRequest = {
  readonly userId: string;
  readonly status: AccountStatus;
};

/**
 * The commands on one user that the users list and the user page share: the add/edit drawer, lock
 * and unlock, and the password reset. Each page provides its own instance. `changes$` counts the
 * accepted mutations; the page's own data resource reads it in `params` and so reloads, because
 * the server, not the response of a mutation, is the source of truth (Prism is stateless).
 */
@Injectable()
export class UserEditorStore {
  private readonly api = inject(AdminOrgApi);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly toaster = inject(Toaster);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    editing: signal<{ readonly user: UserListItem | null } | null>(null),
    saveRequest: signal<SaveUserCommand | undefined>(undefined),
    statusRequest: signal<StatusRequest | undefined>(undefined),
    resetRequest: signal<{ readonly userId: string } | undefined>(undefined),
    changes: signal(0),
  };

  /** The CDK handle of the open drawer: an imperative UI object, not state. */
  private drawer?: { close(): void };

  private readonly metaResource = rxResource({
    stream: () => this.api.adminMeta(),
  });

  private readonly saveResource = rxResource({
    params: () => this.state.saveRequest(),
    stream: ({ params: command }) =>
      this.api.saveUser(command).pipe(
        tap(() => {
          this.drawer?.close();
          this.setChanges(this.state.changes() + 1);
          this.toaster.success(
            command.id ? 'Đã cập nhật người dùng' : 'Đã thêm người dùng',
          );
        }),
      ),
  });

  private readonly statusResource = rxResource({
    params: () => this.state.statusRequest(),
    stream: ({ params: request }) =>
      this.api.setUserStatus(request.userId, { status: request.status }).pipe(
        tap({
          next: () => {
            this.setChanges(this.state.changes() + 1);
            this.toaster.success(
              request.status === 'locked'
                ? 'Đã khóa tài khoản'
                : 'Đã mở khóa tài khoản',
            );
          },
          error: (error: unknown) =>
            this.toaster.error(toAppError(error).message),
        }),
      ),
  });

  private readonly resetResource = rxResource({
    params: () => this.state.resetRequest(),
    stream: ({ params: request }) =>
      this.api.resetPassword(request.userId).pipe(
        tap({
          next: (result) =>
            this.toaster.success(
              'Đã gửi liên kết đặt lại mật khẩu',
              result.sentTo,
            ),
          error: (error: unknown) =>
            this.toaster.error(toAppError(error).message),
        }),
      ),
  });

  readonly me$ = this.session.user$;
  readonly editing$ = this.state.editing.asReadonly();
  readonly changes$ = this.state.changes.asReadonly();

  readonly meta$ = computed(() =>
    this.metaResource.hasValue() ? this.metaResource.value() : undefined,
  );
  readonly metaError$ = computed(() =>
    this.metaResource.error()
      ? toAppError(this.metaResource.error())
      : undefined,
  );
  readonly isSaving$ = this.saveResource.isLoading;
  readonly saveError$ = computed(() =>
    this.saveResource.error()
      ? toAppError(this.saveResource.error())
      : undefined,
  );
  readonly isResetting$ = this.resetResource.isLoading;
  readonly isChangingStatus$ = this.statusResource.isLoading;

  private setEditing(editing: { readonly user: UserListItem | null } | null) {
    this.state.editing.set(editing);
  }

  private setSaveRequest(command: SaveUserCommand | undefined): void {
    this.state.saveRequest.set(command);
  }

  private setStatusRequest(request: StatusRequest | undefined): void {
    this.state.statusRequest.set(request);
  }

  private setResetRequest(
    request: { readonly userId: string } | undefined,
  ): void {
    this.state.resetRequest.set(request);
  }

  private setChanges(count: number): void {
    this.state.changes.set(count);
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
    this.setSaveRequest(undefined);
    this.setEditing({ user });
    ref.closed.subscribe(() => {
      this.drawer = undefined;
      this.setEditing(null);
    });
  }

  save(command: SaveUserCommand): void {
    this.setSaveRequest({ ...command });
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
        this.setStatusRequest({
          userId: user.id,
          status: locking ? 'locked' : 'active',
        }),
      );
  }

  resetPassword(user: UserListItem): void {
    this.setResetRequest({ userId: user.id });
  }
}
