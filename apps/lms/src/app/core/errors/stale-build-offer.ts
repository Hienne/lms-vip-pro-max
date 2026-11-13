import { inject, Injectable } from '@angular/core';
import { Toaster } from '@lms/ui';
import { PAGE_LOCATION, RELOAD_LABEL, STALE_BUILD_TITLE } from './stale-build';

/**
 * A tab opened before a deploy asks for chunks that no longer exist. Instead of a silent dead
 * click, the user is offered a reload. Loaded lazily through `ReloadOffer`, which offers once.
 */
@Injectable({ providedIn: 'root' })
export class StaleBuild {
  private readonly toaster = inject(Toaster);
  private readonly location = inject(PAGE_LOCATION);

  offerReload(): void {
    this.toaster.offer(STALE_BUILD_TITLE, {
      label: RELOAD_LABEL,
      run: () => this.location.reload(),
    });
  }
}
