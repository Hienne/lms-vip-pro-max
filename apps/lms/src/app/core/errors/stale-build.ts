import { DOCUMENT } from '@angular/common';
import {
  inject,
  InjectionToken,
  Injector,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import type { NavigationError } from '@angular/router';

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

/**
 * Offers the reload. `StaleBuild` and the UI toaster are loaded only on this path, so they stay
 * out of the initial bundle (as `SessionExpiry` does). A chunk of the new build loads fine: only
 * the old build's chunks are gone.
 */
export function offerReload(injector: Injector): void {
  void import('./stale-build-offer').then(({ StaleBuild }) =>
    injector.get(StaleBuild).offerReload(),
  );
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
