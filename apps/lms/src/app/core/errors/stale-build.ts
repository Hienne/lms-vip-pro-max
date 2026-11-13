import { DOCUMENT } from '@angular/common';
import {
  inject,
  Injectable,
  InjectionToken,
  Injector,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import type { NavigationError } from '@angular/router';

export const STALE_BUILD_TITLE = 'Đã có phiên bản mới. Tải lại trang?';
export const RELOAD_LABEL = 'Tải lại';

/** The page's own reload, full-page navigation and native confirm, replaceable in specs. */
export interface PageLocation {
  reload(): void;
  assign(url: string): void;
  confirm(message: string): boolean;
}

export const PAGE_LOCATION = new InjectionToken<PageLocation>('PAGE_LOCATION', {
  providedIn: 'root',
  factory: () => {
    const view = inject(DOCUMENT).defaultView;
    return {
      reload: () => view?.location.reload(),
      assign: (url: string) => view?.location.assign(url),
      confirm: (message: string) => view?.confirm(message) ?? false,
    };
  },
});

// What browsers say when a lazy chunk of the old build is gone from the server after a deploy.
const STALE_CHUNK =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i;

/** Whether `error` is a lazy chunk of an older build that the server no longer has. */
export function isStaleBuildError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  return STALE_CHUNK.test(message);
}

/**
 * Offers the reload once per page. `StaleBuild` and the UI toaster are loaded only on this path,
 * so they stay out of the initial bundle. That chunk is itself a chunk of the old build, so it is
 * often gone too: the native confirm then asks instead. The flag lives here, in the initial
 * bundle, so a failed import can never offer again (its error would reach `AppErrorHandler`).
 */
@Injectable({ providedIn: 'root' })
export class ReloadOffer {
  private readonly location = inject(PAGE_LOCATION);
  private offered = false;

  offer(injector: Injector): void {
    if (this.offered) return;
    this.offered = true;
    import('./stale-build-offer').then(
      ({ StaleBuild }) => injector.get(StaleBuild).offerReload(),
      () => {
        if (this.location.confirm(STALE_BUILD_TITLE)) this.location.reload();
      },
    );
  }
}

export function offerReload(injector: Injector): void {
  injector.get(ReloadOffer).offer(injector);
}

/** For `withNavigationErrorHandler`: a lazy route of the old build offers the reload. */
export function offerReloadOnStaleNavigation(error: NavigationError): void {
  if (isStaleBuildError(error.error)) offerReload(inject(Injector));
}

/** Vite's own signal that a preload of the old build failed (the dev server and Vite builds). */
export function provideStaleBuildRecovery(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const injector = inject(Injector);
    inject(DOCUMENT).defaultView?.addEventListener(
      'vite:preloadError',
      (event) => {
        event.preventDefault();
        offerReload(injector);
      },
    );
  });
}
