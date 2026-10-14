import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { HOME } from './role-home';
import { SessionStore } from './session.store';

/** `/` lands on the role's home; an anonymous visitor goes to the login page. */
export const homeGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  await session.whenReady();
  const role = session.role$();
  return router.parseUrl(role ? HOME[role] : '/login');
};
