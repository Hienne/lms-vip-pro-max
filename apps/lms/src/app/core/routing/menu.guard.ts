import { inject } from '@angular/core';
import { type CanMatchFn, RedirectCommand, Router } from '@angular/router';
import { SessionStore } from '../session/session.store';
import type { ForbiddenState } from './forbidden-state';
import { menuOf } from './route-table';
import { EndpointClient } from '../http/endpoint-client';
import type { RouteMeta } from './route-table';

/**
 * A signed-in user whose role does not grant the route's `data.menu` goes to `/403`, told which
 * menu the page belongs to. Secondary routes reuse that menu without a sidebar entry. Missing
 * mock-only integrations are not reachable in a backend-only build. Java checks every operation.
 */
export const menuGuard: CanMatchFn = async (route, segments) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const client = inject(EndpointClient);
  await session.whenReady();
  const menu = menuOf(route.data);
  const requires =
    (route.data as Partial<RouteMeta> | undefined)?.requires ?? [];
  if (
    !session.isSignedIn$() ||
    ((!menu || session.menus$().includes(menu)) &&
      requires.every((endpoint) => client.isServed(endpoint)))
  ) {
    return true;
  }
  const state: ForbiddenState | undefined = menu
    ? {
        path: `/${segments.map((s) => s.path).join('/')}`,
        menu,
      }
    : undefined;
  return new RedirectCommand(router.parseUrl('/403'), { state });
};
