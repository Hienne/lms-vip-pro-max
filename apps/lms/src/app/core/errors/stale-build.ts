import { DOCUMENT } from '@angular/common';
import {
  inject,
  Injectable,
  InjectionToken,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import type { NavigationError } from '@angular/router';
import { Toaster } from '@lms/ui';

/** The page's own reload and full-page navigation, replaceable in specs. */
export interface PageLocation {
  reload(): void;
  assign(url: string): void;
}

export const PAGE_LOCATION = new InjectionToken<PageLocation>('PAGE_LOCATION', {
  providedIn: 'root',
  factory: () => {
    const location = inject(DOCUMENT).defaultView?.location;
    return {
      reload: () => location?.reload(),
      assign: (url: string) => location?.assign(url),
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

export const STALE_BUILD_TITLE = 'Đã có phiên bản mới. Tải lại trang?';
export const RELOAD_LABEL = 'Tải lại';

/**
 * A tab opened before a deploy asks for chunks that no longer exist. Instead of a silent dead
 * click, the user is offered a reload, once per page.
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

/** For `withNavigationErrorHandler`: a lazy route of the old build offers the reload. */
export function offerReloadOnStaleNavigation(error: NavigationError): void {
  if (isStaleBuildError(error.error)) inject(StaleBuild).offerReload();
}

/** Vite's own signal that a preload of the old build failed. */
export function provideStaleBuildRecovery(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const staleBuild = inject(StaleBuild);
    inject(DOCUMENT).defaultView?.addEventListener(
      'vite:preloadError',
      (event) => {
        event.preventDefault();
        staleBuild.offerReload();
      },
    );
  });
}
