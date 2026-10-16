import type { Route } from '@angular/router';
import type { MenuKey } from '@lms/contracts';

export type Layout = 'app' | 'focus' | 'bare';

/** What the router, the shell and the guards read from a route's `data`. */
export interface RouteMeta {
  /** The menu that grants the screen; absent means any signed-in user. */
  readonly menu?: MenuKey;
  readonly layout: Layout;
  /** The mockup page this route will become; the placeholder names it. */
  readonly mockupPage: string;
}

/** Role home and not-found: registered beside the screen table (`screens.ts`). */
export const HOME_META: RouteMeta = {
  layout: 'app',
  mockupPage: 'home',
};
export const NOT_FOUND_META: RouteMeta = {
  layout: 'app',
  mockupPage: 'notFound',
};

/** The menu a route's `data` requires, or `undefined` when any signed-in user may enter. */
export function menuOf(data: Route['data']): MenuKey | undefined {
  const menu: unknown = data?.['menu'];
  return typeof menu === 'string' ? (menu as MenuKey) : undefined;
}
