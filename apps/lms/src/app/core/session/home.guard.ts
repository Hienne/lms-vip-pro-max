import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session.store';

/** `/` lands on the home the server chose for the role; an anonymous visitor goes to the login page. */
export const homeGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  await session.whenReady();
  return router.parseUrl(session.homePath$() ?? '/login');
};
