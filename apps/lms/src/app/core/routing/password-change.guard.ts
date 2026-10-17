import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { SessionStore } from '../session/session.store';
import { isPasswordChange } from './route-table';

/**
 * A user who signed in with a temporary password may open the password change and nothing else:
 * the backend refuses every other call with IDENTITY-PASSWORD_CHANGE_REQUIRED, so any other
 * screen goes to `/change-password` instead of loading and failing. Everyone else passes.
 */
export const passwordChangeGuard: CanMatchFn = async (route) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  await session.whenReady();
  if (!session.mustChangePassword$() || isPasswordChange(route.data)) {
    return true;
  }
  return router.parseUrl('/change-password');
};
