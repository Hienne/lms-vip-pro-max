import { inject } from '@angular/core';
import { type CanMatchFn, RedirectCommand, Router } from '@angular/router';
import type { Role } from '@lms/contracts';
import { SessionStore } from '../session/session.store';
import type { ForbiddenState } from './forbidden-state';

/** A signed-in user outside the route's `data.roles` goes to `/403`, told which roles may enter. */
export const roleGuard: CanMatchFn = async (route, segments) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  await session.whenReady();
  const allowed = route.data?.['roles'] as readonly Role[] | undefined;
  const role = session.role$();
  if (!allowed || !role || allowed.includes(role)) return true;
  const state: ForbiddenState = {
    path: `/${segments.map((s) => s.path).join('/')}`,
    roles: allowed,
  };
  return new RedirectCommand(router.parseUrl('/403'), { state });
};
