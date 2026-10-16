import type { MenuKey } from '@lms/contracts';
import { MENU_KEYS, menuGroup } from '../../core/routing/screens';

/**
 * Where the header search sends a user (the mockup's `global-search` action): the search target of
 * the first menu in the screen table their menus hold; null for no query or when no menu offers a list.
 */
export function searchTarget(
  menus: readonly MenuKey[],
  text: string,
): { path: string; query: { q: string } } | null {
  const q = text.trim();
  const menu = MENU_KEYS.find(
    (key) => menus.includes(key) && menuGroup(key).search,
  );
  if (!q || !menu) return null;
  const { screens, search } = menuGroup(menu);
  return { path: `/${search?.href ?? screens[0].path}`, query: { q } };
}

export function searchPlaceholder(menus: readonly MenuKey[]): string {
  return menus.includes('content.courses') || menus.includes('admin.users')
    ? 'Tìm khóa học, người dùng, câu hỏi…'
    : 'Tìm khóa học, bài học…';
}
