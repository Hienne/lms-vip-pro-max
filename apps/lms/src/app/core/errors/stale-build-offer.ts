import { inject, Injectable } from '@angular/core';
import { Toaster } from '@lms/ui';
import { PAGE_LOCATION } from './stale-build';

export const STALE_BUILD_TITLE = 'Đã có phiên bản mới. Tải lại trang?';
export const RELOAD_LABEL = 'Tải lại';

/**
 * A tab opened before a deploy asks for chunks that no longer exist. Instead of a silent dead
 * click, the user is offered a reload, once per page. Loaded lazily through `offerReload`.
 */
@Injectable({ providedIn: 'root' })
export class StaleBuild {
  private readonly toaster = inject(Toaster);
  private readonly location = inject(PAGE_LOCATION);
  private offered = false;

  offerReload(): void {
    if (this.offered) return;
    this.offered = true;
    this.toaster.offer(STALE_BUILD_TITLE, {
      label: RELOAD_LABEL,
      run: () => this.location.reload(),
    });
  }
}
