import type { MenuKey } from '@lms/contracts';

/** The lists the header search can fill, best match first: what the user's menus open. */
const SEARCH_PATHS: readonly (readonly [MenuKey, string])[] = [
  ['learn.catalog', '/catalog'],
  ['content.courses', '/admin/courses'],
  ['reports', '/reports/learners'],
];

/**
 * Where the header search sends a user (the mockup's `global-search` action): the first list their
 * menus open; null for no query or when no menu offers a list.
 */
export function searchTarget(
  menus: readonly MenuKey[],
  text: string,
): { path: string; query: { q: string } } | null {
  const q = text.trim();
  const path = SEARCH_PATHS.find(([menu]) => menus.includes(menu))?.[1];
  return q && path ? { path, query: { q } } : null;
}

export function searchPlaceholder(menus: readonly MenuKey[]): string {
  return menus.includes('content.courses') || menus.includes('admin.users')
    ? 'Tìm khóa học, người dùng, câu hỏi…'
    : 'Tìm khóa học, bài học…';
}
