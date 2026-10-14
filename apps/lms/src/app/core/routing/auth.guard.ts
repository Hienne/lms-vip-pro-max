import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { SessionStore } from '../session/session.store';

/** Anonymous visitors go to `/login?next=<url they asked for>`. */
export const authGuard: CanMatchFn = async () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  await session.whenReady();
  if (session.isSignedIn$()) return true;
  const requested = router.getCurrentNavigation()?.extractedUrl.toString();
  return router.createUrlTree(['/login'], {
    queryParams: requested && requested !== '/' ? { next: requested } : {},
  });
};
