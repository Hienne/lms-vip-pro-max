import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { createGlobalPositionStrategy } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  effect,
  inject,
  Injector,
  signal,
  type Signal,
  type TemplateRef,
} from '@angular/core';
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

/** The parts of an open drawer that may change while it is open. */
export type DrawerLive = {
  title: Signal<string>;
  footer: Signal<TemplateRef<DrawerContext> | undefined>;
  /** While true the user cannot close the drawer and an overlay covers the body and footer. */
  busy: Signal<boolean>;
  busyLabel: Signal<string | undefined>;
};

type DrawerData = DrawerLive & {
  titleId: string;
  body: TemplateRef<DrawerContext>;
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
  host: { class: 'drawer', '[attr.aria-busy]': 'data.busy() ? "true" : null' },
  templateUrl: './drawer.html',
})
export class Drawer {
  private readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly data = inject<DrawerData>(DIALOG_DATA);

  protected readonly context: DrawerContext = { close: () => this.close() };

  constructor() {
    // `disableClose` blocks Escape and the backdrop only; the close button and `close()` are
    // guarded below.
    effect(() => {
      this.ref.disableClose = this.data.busy();
    });
  }

  protected close(): void {
    if (this.data.busy()) return;
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
  return openLiveDrawer(dialog, body, options.side, {
    title: signal(options.title),
    footer: signal(options.footer),
    busy: signal(false),
    busyLabel: signal(undefined),
  });
}

/** {@link openDrawer} with a title and footer that follow signals while the drawer is open. */
export function openLiveDrawer(
  dialog: Dialog,
  body: TemplateRef<DrawerContext>,
  sideOption: DrawerSide | undefined,
  live: DrawerLive,
): DialogRef<void, Drawer> {
  const side = sideOption ?? 'end';
  const position = createGlobalPositionStrategy(Injector.NULL);
  const data: DrawerData = {
    ...live,
    titleId: `ui-drawer-title-${++nextId}`,
    body,
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
