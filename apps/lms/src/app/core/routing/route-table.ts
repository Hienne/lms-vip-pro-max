import type { Route } from '@angular/router';
import {
  FunctionCodeSchema,
  type AnyEndpoint,
  type FunctionCode,
} from '@lms/contracts';

/**
 * The frame around a screen. `workspace` is the app frame with a page that fills the viewport
 * under the header and scrolls inside its own regions (the assistant's chat and panel), so the
 * window itself never scrolls.
 */
export type Layout = 'app' | 'workspace' | 'focus' | 'bare';

/** What the router, the shell and the guards read from a route's `data`. */
export interface RouteMeta {
  /** The backend function that grants the screen; absent means any signed-in user. */
  readonly menu?: FunctionCode;
  readonly requires?: readonly AnyEndpoint[];
  /** The one screen a user with a temporary password may open (see `passwordChangeGuard`). */
  readonly passwordChange?: boolean;
  readonly layout: Layout;
  /** A screen shared by a create and an edit route learns which one it is from this. */
  readonly mode?: 'create';
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
  const parsed = FunctionCodeSchema.safeParse(menu);
  return parsed.success ? parsed.data : undefined;
}

/** True for the screen a user with a temporary password is limited to. */
export function isPasswordChange(data: Route['data']): boolean {
  return data?.['passwordChange'] === true;
}
