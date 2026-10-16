import { Injectable, signal } from '@angular/core';
import type { DrawerSide } from '@lms/ui';

/** Which drawer of the demo is open: the side it slides from, or none. */
@Injectable()
export class DrawerDemoStore {
  private readonly state = {
    openSide: signal<DrawerSide | null>(null),
  };

  readonly openSide$ = this.state.openSide.asReadonly();

  private setOpenSide(side: DrawerSide | null): void {
    this.state.openSide.set(side);
  }

  open(side: DrawerSide): void {
    this.setOpenSide(side);
  }

  close(): void {
    this.setOpenSide(null);
  }
}
