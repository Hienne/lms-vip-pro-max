import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { HOME } from './role-home';
import { SessionStore } from './session.store';

/** The login page is for visitors: a signed-in user is sent to their home instead. */
export const guestGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  await session.whenReady();
  const role = session.role$();
  return role ? router.parseUrl(HOME[role]) : true;
};
