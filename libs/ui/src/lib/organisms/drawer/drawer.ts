import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { createGlobalPositionStrategy } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, Injector, type TemplateRef } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import { IconButton } from '../../atoms/icon-button/icon-button.directive';

/** What the body and footer templates receive: `let-close="close"` closes the drawer. */
export type DrawerContext = { close: () => void };

export type DrawerSide = 'start' | 'end';

export type DrawerOptions = {
  /** Heading of the drawer; it is also the dialog's accessible name. */
  title: string;
  /** Which edge it slides from; follows the text direction. Defaults to `end`. */
  side?: DrawerSide;
  /** Actions pinned under the body. */
  footer?: TemplateRef<DrawerContext>;
};

type DrawerData = {
  title: string;
  titleId: string;
  body: TemplateRef<DrawerContext>;
  footer: TemplateRef<DrawerContext> | undefined;
};

let nextId = 0;

/**
 * The shell of a side panel: header with the title and a close button, a scrolling body and an
 * optional footer. It is rendered by {@link openDrawer} inside a CDK dialog, which traps focus,
 * closes on Escape and on a backdrop click, and gives focus back to the opener.
 */
@Component({
  selector: 'ui-drawer',
  imports: [Icon, IconButton, NgTemplateOutlet],
  host: { class: 'drawer' },
  templateUrl: './drawer.html',
})
export class Drawer {
  private readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly data = inject<DrawerData>(DIALOG_DATA);

  protected readonly context: DrawerContext = { close: () => this.close() };

  protected close(): void {
    this.ref.close();
  }
}

/**
 * Opens `body` in a drawer that slides in from the `side` edge (full width on narrow screens).
 * The returned `DialogRef` closes it and reports when it was closed.
 */
export function openDrawer(
  dialog: Dialog,
  body: TemplateRef<DrawerContext>,
  options: DrawerOptions,
): DialogRef<void, Drawer> {
  const side = options.side ?? 'end';
  const position = createGlobalPositionStrategy(Injector.NULL);
  const data: DrawerData = {
    title: options.title,
    titleId: `ui-drawer-title-${++nextId}`,
    body,
    footer: options.footer,
  };
  return dialog.open<void, DrawerData, Drawer>(Drawer, {
    data,
    role: 'dialog',
    ariaModal: true,
    ariaLabelledBy: data.titleId,
    backdropClass: 'dialog-backdrop',
    panelClass: ['drawer-pane', `drawer-pane--${side}`],
    maxWidth: '100vw',
    positionStrategy:
      side === 'start' ? position.start('0') : position.end('0'),
  });
}
