import type { Params } from '@angular/router';

/**
 * The `next` query value when it is a path inside the app, else null. Anything that could leave
 * the app (`//host`, `https:`, a backslash) or loop back to the login page is ignored.
 */
export function readReturnTo(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  if (next.includes('\\') || next.split(/[?#]/)[0] === '/login') return null;
  return next;
}

/** The query params for `/login` that bring the visitor back to `url`; none when there is nowhere to return to. */
export function returnToParams(url: string | null | undefined): Params {
  const next = readReturnTo(url);
  return next && next !== '/' ? { next } : {};
}

/** Transient router info for the first page reached after an explicit sign-in. */
export const SIGN_IN_NAVIGATION = Symbol('sign-in');
