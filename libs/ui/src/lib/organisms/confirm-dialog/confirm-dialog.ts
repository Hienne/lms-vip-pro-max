import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { defer, map, type Observable } from 'rxjs';
import { Button } from '../../atoms/button/button.directive';
import { Checkbox } from '../../atoms/checkbox/checkbox.directive';
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
  /**
   * A statement the user must tick before confirming, such as "Tôi đã rà soát nội dung". The
   * confirm button stays disabled until it is ticked.
   */
  acknowledge?: string;
  /**
   * The close icon, Escape and the backdrop answer `undefined` instead of `false`, so the caller can
   * tell "never mind, go back" from the cancel button's "no". Set by {@link choose}.
   */
  distinctClose?: boolean;
};

type ConfirmData = Required<Omit<ConfirmOptions, 'acknowledge'>> &
  Pick<ConfirmOptions, 'acknowledge'> & {
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
  imports: [Button, Checkbox, Icon, IconButton],
  host: { class: 'dialog' },
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  private readonly ref = inject<DialogRef<boolean | undefined>>(DialogRef);
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);

  protected readonly danger = computed(() => this.data.tone === 'danger');
  protected readonly acknowledged = signal(false);
  protected readonly canConfirm = computed(
    () => !this.data.acknowledge || this.acknowledged(),
  );

  protected tick(event: Event): void {
    this.acknowledged.set((event.target as HTMLInputElement).checked);
  }

  protected close(result: boolean | undefined): void {
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
  return open(dialog, options).pipe(map((result) => result === true));
}

/**
 * Like {@link confirm} with three answers: `true` on the confirm button, `false` on the cancel
 * button, and `undefined` on the close icon, Escape or the backdrop ("go back").
 */
export function choose(
  dialog: Dialog,
  options: ConfirmOptions,
): Observable<boolean | undefined> {
  return open(dialog, { ...options, distinctClose: true });
}

function open(
  dialog: Dialog,
  options: ConfirmOptions,
): Observable<boolean | undefined> {
  return defer(() => {
    const id = ++nextId;
    const data: ConfirmData = {
      confirmLabel: 'Xác nhận',
      cancelLabel: 'Hủy',
      tone: 'primary',
      distinctClose: false,
      ...options,
      titleId: `ui-confirm-title-${id}`,
      messageId: `ui-confirm-message-${id}`,
    };
    const ref = dialog.open<boolean | undefined, ConfirmData, ConfirmDialog>(
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
    return ref.closed.pipe(
      map((result) =>
        typeof result === 'boolean' || data.distinctClose ? result : false,
      ),
    );
  });
}
