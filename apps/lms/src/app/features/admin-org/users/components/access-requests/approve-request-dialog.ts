import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { ACCESS_REQUEST_LIMITS, type AccessRequest } from '@lms/contracts';
import { Button, Field, Icon, IconButton, Textarea } from '@lms/ui';
import { filter, type Observable } from 'rxjs';

export interface ApproveRequestData {
  readonly request: AccessRequest;
  readonly titleId: string;
}

let nextId = 0;

/**
 * Confirms the approval of a registration and asks for the optional note. Shows what will be
 * created (name, staff code, unit, email). Closes with the note (empty when none) on confirm, and
 * with nothing on cancel, Escape or the backdrop.
 */
@Component({
  selector: 'app-approve-request-dialog',
  imports: [Button, Field, Icon, IconButton, Textarea],
  host: { class: 'dialog' },
  template: `
    <div class="dialog__header">
      <h2 class="dialog__title" [id]="data.titleId">
        Duyệt đăng ký của {{ data.request.fullName || data.request.staffCode }}?
      </h2>
      <button uiIconButton label="Đóng hộp thoại" (click)="cancel()">
        <ui-icon name="x" />
      </button>
    </div>
    <div class="dialog__body">
      <dl class="approve-summary">
        <dt>Mã cán bộ</dt>
        <dd>{{ data.request.staffCode }}</dd>
        <dt>Đơn vị</dt>
        <dd>{{ data.request.orgName || '—' }}</dd>
        @if (data.request.email) {
          <dt>Email</dt>
          <dd>{{ data.request.email }}</dd>
        }
      </dl>
      <p class="approve-note">
        Tài khoản được tạo với mật khẩu người đăng ký đã chọn, vai trò học viên.
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
      <button uiButton variant="ghost" (click)="cancel()">Hủy</button>
      <button uiButton variant="primary" (click)="confirm()">
        Duyệt yêu cầu
      </button>
    </div>
  `,
  styleUrl: './approve-request-dialog.scss',
})
export class ApproveRequestDialog {
  private readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly data = inject<ApproveRequestData>(DIALOG_DATA);

  protected readonly limit = ACCESS_REQUEST_LIMITS.note;
  protected readonly note = signal('');

  protected confirm(): void {
    this.ref.close(this.note().trim());
  }

  protected cancel(): void {
    this.ref.close();
  }
}

/**
 * Opens the approval dialog. The observable emits the note once on confirm (an empty string for
 * none) and completes without a value on cancel.
 */
export function askApproval(
  dialog: Dialog,
  request: AccessRequest,
): Observable<string> {
  const titleId = `approve-request-title-${++nextId}`;
  const ref = dialog.open<string, ApproveRequestData, ApproveRequestDialog>(
    ApproveRequestDialog,
    {
      data: { request, titleId },
      role: 'dialog',
      ariaModal: true,
      ariaLabelledBy: titleId,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-pane',
    },
  );
  return ref.closed.pipe(filter((note): note is string => note !== undefined));
}
