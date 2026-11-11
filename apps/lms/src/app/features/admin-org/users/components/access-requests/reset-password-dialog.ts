import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  Component,
  DestroyRef,
  inject,
  type Injector,
  signal,
} from '@angular/core';
import { ACCESS_REQUEST_LIMITS, type AccessRequest } from '@lms/contracts';
import {
  Alert,
  Button,
  Field,
  Icon,
  IconButton,
  Input,
  Textarea,
} from '@lms/ui';
import { AccessRequestsStore } from '../../data-access/access-requests.store';
import { copyText } from '../../../../../core/browser/secure-context';

export interface ResetPasswordData {
  readonly request: AccessRequest;
  readonly titleId: string;
}

let nextId = 0;

/**
 * Resets the password of the account a forgot-password request points at. Two views in one dialog:
 * the confirmation (with the optional note), then the temporary password, shown once. The store
 * holds the password only while the dialog is open; closing it by any route clears it, so it is
 * gone from the DOM and from memory. A refusal shows inside the dialog and leaves it open.
 */
@Component({
  selector: 'app-reset-password-dialog',
  imports: [Alert, Button, Field, Icon, IconButton, Input, Textarea],
  host: { class: 'dialog' },
  template: `
    <div class="dialog__header">
      <h2 class="dialog__title" [id]="data.titleId">
        @if (store.temporaryPassword$()) {
          Mật khẩu tạm của {{ name }}
        } @else {
          Đặt lại mật khẩu của {{ name }}?
        }
      </h2>
      <button uiIconButton label="Đóng hộp thoại" (click)="close()">
        <ui-icon name="x" />
      </button>
    </div>
    @if (store.temporaryPassword$(); as password) {
      <div class="dialog__body">
        <p class="reset-note">
          Mật khẩu chỉ hiện một lần. Gửi cho {{ name }} qua kênh riêng; họ phải
          đổi mật khẩu ở lần đăng nhập đầu.
        </p>
        <div class="reset-password">
          <input
            uiInput
            readonly
            aria-label="Mật khẩu tạm"
            [type]="revealed() ? 'text' : 'password'"
            [value]="password"
          />
          <button
            uiIconButton
            [label]="revealed() ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
            [attr.aria-pressed]="revealed()"
            (click)="revealed.set(!revealed())"
          >
            <ui-icon [name]="revealed() ? 'eye-off' : 'eye'" />
          </button>
          <button
            uiIconButton
            [label]="copied() ? 'Đã sao chép' : 'Sao chép mật khẩu'"
            (click)="copy(password)"
          >
            <ui-icon [name]="copied() ? 'check' : 'copy'" />
          </button>
        </div>
      </div>
      <div class="dialog__footer">
        <button uiButton variant="primary" (click)="close()">Xong</button>
      </div>
    } @else {
      <div class="dialog__body">
        @if (store.resetPasswordError$(); as failure) {
          <ui-alert tone="danger" heading="Chưa đặt lại được mật khẩu">
            {{ failure.message }}
          </ui-alert>
        }
        <p class="reset-note">
          Tài khoản {{ data.request.staffCode }} sẽ có mật khẩu tạm mới, các
          phiên đang đăng nhập bị đăng xuất và người dùng phải đổi mật khẩu khi
          đăng nhập lại.
        </p>
        <ui-field label="Ghi chú (không bắt buộc)">
          <textarea
            uiTextarea
            cdkFocusInitial
            rows="3"
            [attr.maxlength]="limit"
            [value]="note()"
            (input)="note.set(textarea.value)"
            #textarea
          ></textarea>
        </ui-field>
      </div>
      <div class="dialog__footer">
        <button uiButton variant="ghost" (click)="close()">Hủy</button>
        <button
          uiButton
          variant="primary"
          [busy]="store.isResettingPassword$()"
          (click)="confirm()"
        >
          Đặt lại mật khẩu
        </button>
      </div>
    }
  `,
  styleUrl: './reset-password-dialog.scss',
})
export class ResetPasswordDialog {
  private readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly data = inject<ResetPasswordData>(DIALOG_DATA);
  protected readonly store = inject(AccessRequestsStore);

  protected readonly limit = ACCESS_REQUEST_LIMITS.note;
  protected readonly note = signal('');
  protected readonly revealed = signal(false);
  protected readonly copied = signal(false);
  protected readonly name =
    this.data.request.fullName || this.data.request.staffCode;

  constructor() {
    // Any way of closing (Xong, Hủy, Escape, backdrop, leaving the page) drops the password.
    inject(DestroyRef).onDestroy(() => this.store.clearPasswordReset());
  }

  protected confirm(): void {
    this.store.resetPassword(this.data.request.requestId, this.note());
  }

  protected async copy(password: string): Promise<void> {
    if (await copyText(password)) {
      this.copied.set(true);
    } else {
      // The clipboard can be blocked; the password stays visible to read out.
      this.revealed.set(true);
    }
  }

  protected close(): void {
    this.ref.close();
  }
}

/**
 * Opens the reset dialog for a pending forgot-password request. The store lives on the Người dùng
 * screen, so the dialog is given that screen's injector to find it.
 */
export function askPasswordReset(
  dialog: Dialog,
  request: AccessRequest,
  injector: Injector,
): void {
  const titleId = `reset-password-title-${++nextId}`;
  dialog.open<void, ResetPasswordData, ResetPasswordDialog>(
    ResetPasswordDialog,
    {
      data: { request, titleId },
      injector,
      role: 'dialog',
      ariaModal: true,
      ariaLabelledBy: titleId,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-pane',
    },
  );
}
