import type { Route } from '@angular/router';
import type { FunctionCode } from '@lms/contracts';

export type Layout = 'app' | 'focus' | 'bare';

/** What the router, the shell and the guards read from a route's `data`. */
export interface RouteMeta {
  /** The backend function that grants the screen; absent means any signed-in user. */
  readonly menu?: FunctionCode;
  /** The one screen a user with a temporary password may open (see `passwordChangeGuard`). */
  readonly passwordChange?: boolean;
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

/** The function code a route's `data` requires, or `undefined` when any signed-in user may enter. */
export function menuOf(data: Route['data']): FunctionCode | undefined {
  const menu: unknown = data?.['menu'];
  return typeof menu === 'string' ? (menu as FunctionCode) : undefined;
}

/** True for the screen a user with a temporary password is limited to. */
export function isPasswordChange(data: Route['data']): boolean {
  return data?.['passwordChange'] === true;
}
