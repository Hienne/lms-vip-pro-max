import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import {
  DestroyRef,
  Directive,
  effect,
  inject,
  input,
  output,
  TemplateRef,
  untracked,
} from '@angular/core';
import {
  type Drawer,
  type DrawerContext,
  type DrawerSide,
  openLiveDrawer,
} from './drawer';

/**
 * Shows the `<ng-template>` it sits on in a side drawer while `uiDrawer` is true, so the drawer
 * is derived from state and never opened by a command. The template is the body; `close` is
 * available as `let-close="close"`.
 *
 * While `uiDrawerBusy` is true every way the user can close it is blocked, but the state is not:
 * `uiDrawer` turning false still closes it.
 *
 * `uiDrawerDismiss` fires only when the user closes it (Esc, backdrop, the close button or
 * `close()`), never when `uiDrawer` turns false or the directive is destroyed: map it to the
 * command that clears the state `uiDrawer` reads.
 *
 * `<ng-template [uiDrawer]="editing()" uiDrawerTitle="Sửa vai trò" (uiDrawerDismiss)="cancel()">`
 */
@Directive({ selector: 'ng-template[uiDrawer]' })
export class DrawerOutlet {
  private readonly dialog = inject(Dialog);
  private readonly body = inject<TemplateRef<DrawerContext>>(TemplateRef);

  /** The drawer is open while this is true. */
  readonly uiDrawer = input.required<boolean>();
  /** Heading of the drawer and its accessible name. */
  readonly uiDrawerTitle = input.required<string>();
  /** Actions pinned under the body; there is no default footer. */
  readonly uiDrawerFooter = input<TemplateRef<DrawerContext>>();
  /** Which edge it slides from, read when it opens. Defaults to `end`. */
  readonly uiDrawerSide = input<DrawerSide>();
  /** Compact centered dialog for short forms; read when opened. */
  readonly uiDrawerVariant = input<'drawer' | 'dialog'>('drawer');
  /** Wider drawer for forms with paired fields; read when opened. */
  readonly uiDrawerSize = input<'md' | 'lg'>('md');
  /** While true the user cannot close the drawer and an overlay covers its body and footer. */
  readonly uiDrawerBusy = input(false);
  /** Text of the busy overlay, read by screen readers. The library ships no default copy. */
  readonly uiDrawerBusyLabel = input<string>();
  /**
   * While true the user's ways of closing (Esc, backdrop, the close button, `close()`) do not close
   * the drawer: they emit `uiDrawerCloseRequest` and the page answers by clearing the state
   * `uiDrawer` reads, or by staying.
   */
  readonly uiDrawerGuard = input(false);
  /** The user tried to close the drawer while `uiDrawerGuard` is true. */
  readonly uiDrawerCloseRequest = output<void>();
  /** The user closed the drawer. */
  readonly uiDrawerDismiss = output<void>();

  /** The open drawer; cleared before a close that the state asked for, so it is not a dismissal. */
  private ref?: DialogRef<void, Drawer>;

  constructor() {
    effect(() => {
      const open = this.uiDrawer();
      untracked(() => (open ? this.show() : this.hide()));
    });
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  private show(): void {
    if (this.ref) return;
    const ref = openLiveDrawer(
      this.dialog,
      this.body,
      this.uiDrawerSide(),
      {
        title: this.uiDrawerTitle,
        footer: this.uiDrawerFooter,
        busy: this.uiDrawerBusy,
        busyLabel: this.uiDrawerBusyLabel,
        guarded: this.uiDrawerGuard,
        closeRequested: () => this.uiDrawerCloseRequest.emit(),
      },
      this.uiDrawerVariant(),
      this.uiDrawerSize(),
    );
    this.ref = ref;
    ref.closed.subscribe(() => {
      if (this.ref !== ref) return;
      this.ref = undefined;
      this.uiDrawerDismiss.emit();
    });
  }

  private hide(): void {
    const ref = this.ref;
    this.ref = undefined;
    ref?.close();
  }
}
