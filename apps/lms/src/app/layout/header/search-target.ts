import type { Role } from '@lms/contracts';

const SEARCH_PATH: Record<Role, string> = {
  learner: '/catalog',
  viewer: '/reports/learners',
  instructor: '/admin/courses',
  admin: '/admin/courses',
};

/** Where the header search sends a role (the mockup's `global-search` action); null for no query. */
export function searchTarget(
  role: Role,
  text: string,
): { path: string; query: { q: string } } | null {
  const q = text.trim();
  return q ? { path: SEARCH_PATH[role], query: { q } } : null;
}

export function searchPlaceholder(role: Role): string {
  return role === 'learner'
    ? 'Tìm khóa học, bài học…'
    : 'Tìm khóa học, người dùng, câu hỏi…';
}
