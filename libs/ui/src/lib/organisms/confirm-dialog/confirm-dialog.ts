import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { defer, map, type Observable } from 'rxjs';
import { Button } from '../../atoms/button/button.directive';
import { Icon } from '../../atoms/icon/icon';
import { IconButton } from '../../atoms/icon-button/icon-button.directive';

export type ConfirmTone = 'primary' | 'warning' | 'danger';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` swaps the confirm button for the danger one. */
  tone?: ConfirmTone;
};

type ConfirmData = Required<ConfirmOptions> & {
  titleId: string;
  messageId: string;
};

let nextId = 0;

/**
 * The shell of a confirmation dialog, rendered by {@link confirm} inside a CDK dialog. The title
 * says what is being confirmed (no icon) and labels the dialog and the message describes it (ids are wired through the dialog config).
 * Confirm closes with `true`; the cancel button and the close icon with `false`; Escape and the
 * backdrop are handled by the CDK dialog.
 */
@Component({
  selector: 'ui-confirm-dialog',
  imports: [Button, Icon, IconButton],
  host: { class: 'dialog' },
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);

  protected readonly danger = computed(() => this.data.tone === 'danger');

  protected close(result: boolean): void {
    this.ref.close(result);
  }
}

/**
 * Asks the user to confirm an action. The returned observable is cold: the dialog opens on
 * subscribe and emits once, `true` on confirm and `false` on cancel, Escape or backdrop click.
 * Focus is trapped while open and goes back to the element that had it before.
 */
export function confirm(
  dialog: Dialog,
  options: ConfirmOptions,
): Observable<boolean> {
  return defer(() => {
    const id = ++nextId;
    const data: ConfirmData = {
      confirmLabel: 'Xác nhận',
      cancelLabel: 'Hủy',
      tone: 'primary',
      ...options,
      titleId: `ui-confirm-title-${id}`,
      messageId: `ui-confirm-message-${id}`,
    };
    const ref = dialog.open<boolean, ConfirmData, ConfirmDialog>(
      ConfirmDialog,
      {
        data,
        role: 'alertdialog',
        ariaModal: true,
        ariaLabelledBy: data.titleId,
        ariaDescribedBy: data.messageId,
        backdropClass: 'dialog-backdrop',
        panelClass: 'dialog-pane',
      },
    );
    return ref.closed.pipe(map((result) => result === true));
  });
}
