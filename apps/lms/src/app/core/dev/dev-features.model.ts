import type { HttpInterceptorFn } from '@angular/common/http';
import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

/**
 * Everything that exists only for the team: the migration board, the dev toolbar and the offline
 * simulation. The production build swaps `dev-features.ts` for a stub with nothing in
 * it (`fileReplacements` in `apps/lms/project.json`), so none of this reaches the bundle;
 * `npm run check:bundle` fails the build if it does.
 */
export interface DevFeatures {
  /** Internal routes, registered when `devTools` is true. */
  readonly routes: Routes;
  /** Loads the floating toolbar, or null when this build has none. */
  readonly toolbar: (() => Promise<Type<unknown>>) | null;
  /** Interceptors that simulate faults for the dev toolbar; they run first. */
  readonly interceptors: readonly HttpInterceptorFn[];
}
