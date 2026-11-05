import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { ACCESS_REQUEST_LIMITS } from '@lms/contracts';
import { Button, Field, Icon, IconButton, Textarea } from '@lms/ui';
import { filter, type Observable } from 'rxjs';

export interface RejectRequestData {
  /** The sender, named in the title. */
  readonly name: string;
  readonly titleId: string;
}

let nextId = 0;

/**
 * Asks for the optional note of a rejection. Closes with the note (empty when none was typed) on
 * confirm, and with nothing on cancel, Escape or the backdrop. The title names what is being
 * confirmed; there is no icon.
 */
@Component({
  selector: 'app-reject-request-dialog',
  imports: [Button, Field, Icon, IconButton, Textarea],
  host: { class: 'dialog' },
  template: `
    <div class="dialog__header">
      <h2 class="dialog__title" [id]="data.titleId">
        Từ chối yêu cầu của {{ data.name }}?
      </h2>
      <button uiIconButton label="Đóng hộp thoại" (click)="cancel()">
        <ui-icon name="x" />
      </button>
    </div>
    <div class="dialog__body">
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
      <button uiButton variant="danger" (click)="confirm()">
        Từ chối yêu cầu
      </button>
    </div>
  `,
})
export class RejectRequestDialog {
  private readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly data = inject<RejectRequestData>(DIALOG_DATA);

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
 * Opens the rejection dialog. The observable emits the note once on confirm (an empty string for
 * none) and completes without a value on cancel.
 */
export function askRejectionNote(
  dialog: Dialog,
  name: string,
): Observable<string> {
  const titleId = `reject-request-title-${++nextId}`;
  const ref = dialog.open<string, RejectRequestData, RejectRequestDialog>(
    RejectRequestDialog,
    {
      data: { name, titleId },
      role: 'dialog',
      ariaModal: true,
      ariaLabelledBy: titleId,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-pane',
    },
  );
  return ref.closed.pipe(filter((note): note is string => note !== undefined));
}
