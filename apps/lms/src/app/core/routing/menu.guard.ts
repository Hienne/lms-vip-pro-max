import { inject } from '@angular/core';
import { type CanMatchFn, RedirectCommand, Router } from '@angular/router';
import { SessionStore } from '../session/session.store';
import type { ForbiddenState } from './forbidden-state';
import { menuOf } from './route-table';

/**
 * A signed-in user whose role does not grant the route's `data.menu` goes to `/403`, told which
 * menu the page belongs to. A route without a menu is open to every signed-in user. Access is per
 * screen: holding the menu allows everything on it, so there is no finer check.
 */
export const menuGuard: CanMatchFn = async (route, segments) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  await session.whenReady();
  const menu = menuOf(route.data);
  if (!menu || !session.isSignedIn$() || session.menus$().includes(menu)) {
    return true;
  }
  const state: ForbiddenState = {
    path: `/${segments.map((s) => s.path).join('/')}`,
    menu,
  };
  return new RedirectCommand(router.parseUrl('/403'), { state });
};
