import { computed, Injectable, signal } from '@angular/core';
import type { DrawerSide } from '@lms/ui';

/** Which drawer of the demo is open: the side it slides from, or none. */
@Injectable()
export class DrawerDemoStore {
  private readonly state = {
    openSide: signal<DrawerSide | 'dialog' | null>(null),
  };

  readonly openSide$ = this.state.openSide.asReadonly();

  readonly side$ = computed(() =>
    this.openSide$() === 'start' ? 'start' : 'end',
  );
  readonly variant$ = computed(() =>
    this.openSide$() === 'dialog' ? 'dialog' : 'drawer',
  );

  private setOpenSide(side: DrawerSide | 'dialog' | null): void {
    this.state.openSide.set(side);
  }

  open(side: DrawerSide | 'dialog'): void {
    this.setOpenSide(side);
  }

  close(): void {
    this.setOpenSide(null);
  }
}
