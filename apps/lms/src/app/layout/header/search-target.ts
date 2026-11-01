import type { FunctionCode } from '@lms/contracts';
import { FUNCTION_CODES, menuGroup } from '../../core/routing/screens';

/**
 * Where the header search sends a user (the mockup's `global-search` action): the search target of
 * the first function in the screen table that the user holds and that offers a list; null for no
 * query or when no function offers one.
 */
export function searchTarget(
  menus: readonly FunctionCode[],
  text: string,
): { path: string; query: Readonly<Record<string, string>> } | null {
  const q = text.trim();
  const menu = FUNCTION_CODES.find(
    (key) => menus.includes(key) && menuGroup(key).search,
  );
  if (!q || !menu) return null;
  const { screens, search } = menuGroup(menu);
  return {
    path: `/${search?.href ?? screens[0].path}`,
    query: { [search?.queryKey ?? 'q']: q },
  };
}

export function searchPlaceholder(menus: readonly FunctionCode[]): string {
  return menus.includes('COURSE_MANAGEMENT') ||
    menus.includes('USER_MANAGEMENT')
    ? 'Tìm khóa học, người dùng, câu hỏi…'
    : menus.includes('REPORTING') && !menus.includes('COURSE_LEARNING')
      ? 'Mã cán bộ học viên…'
      : 'Tìm khóa học, bài học…';
}
