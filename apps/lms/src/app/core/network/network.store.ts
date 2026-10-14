import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { fromEvent, map, merge } from 'rxjs';

/**
 * Whether the app thinks it is offline: the window `online` and `offline` events, plus the
 * simulation the banner and the dev toolbar switch (the mockup's `LMS.store.net.offline`).
 */
@Injectable({ providedIn: 'root' })
export class NetworkStore {
  private readonly state = { offline: signal(false) };

  readonly offline$ = this.state.offline.asReadonly();

  constructor() {
    const win = inject(DOCUMENT).defaultView;
    if (!win) return;
    this.setOffline(!win.navigator.onLine);
    const subscription = merge(
      fromEvent(win, 'online').pipe(map(() => false)),
      fromEvent(win, 'offline').pipe(map(() => true)),
    ).subscribe((offline) => this.setOffline(offline));
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  private setOffline(offline: boolean): void {
    this.state.offline.set(offline);
  }

  goOffline(): void {
    this.setOffline(true);
  }

  goOnline(): void {
    this.setOffline(false);
  }
}
