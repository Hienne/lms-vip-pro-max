/**
 * The `next` query value when it is a path inside the app, else null. Guards put the page the
 * visitor asked for there; anything that could leave the app (`//host`, `https:`) is ignored.
 */
export function internalPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  if (next.includes('\\') || next.split(/[?#]/)[0] === '/login') return null;
  return next;
}
