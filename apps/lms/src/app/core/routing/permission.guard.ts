import { inject } from '@angular/core';
import { type CanMatchFn, RedirectCommand, Router } from '@angular/router';
import type { Permission } from '@lms/contracts';
import { hasPermissions } from '../permissions/has-permissions';
import { SessionStore } from '../session/session.store';

/** Lets the route through only when the server granted every listed permission. */
export function permissionGuard(
  ...required: readonly Permission[]
): CanMatchFn {
  return async () => {
    const session = inject(SessionStore);
    const router = inject(Router);
    await session.whenReady();
    if (hasPermissions(session.perms$(), required)) return true;
    return new RedirectCommand(router.parseUrl('/403'));
  };
}
