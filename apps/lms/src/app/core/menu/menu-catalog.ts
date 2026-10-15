import type { MenuKey } from '@lms/contracts';
import type { IconName } from '@lms/ui';

export interface MenuItem {
  readonly key: MenuKey;
  readonly href: string;
  readonly icon: IconName;
  readonly label: string;
  readonly section: string;
  /** Count shown beside the label; the shell fills it from the server's nav counts. */
  readonly badge?: 'inbox';
}

/**
 * Every menu a role can grant, in sidebar order. The mockup's `NAV` (core/shell.js) was one list
 * per fixed role; here a role is a set of these keys and the sidebar shows the ones it holds.
 * Each key is one sidebar entry and covers the sub-routes listed in `route-table.ts`.
 */
export const MENU_CATALOG: readonly MenuItem[] = [
  {
    key: 'learn.home',
    href: '/learn',
    icon: 'house',
    label: 'Trang chủ học tập',
    section: 'Học tập',
  },
  {
    key: 'learn.catalog',
    href: '/catalog',
    icon: 'library',
    label: 'Danh mục khóa học',
    section: 'Học tập',
  },
  {
    key: 'learn.progress',
    href: '/progress',
    icon: 'chart-column',
    label: 'Tiến độ của tôi',
    section: 'Học tập',
  },
  {
    key: 'learn.leaderboard',
    href: '/leaderboard',
    icon: 'trophy',
    label: 'Bảng xếp hạng',
    section: 'Học tập',
  },
  {
    key: 'learn.assistant',
    href: '/assistant',
    icon: 'sparkles',
    label: 'Trợ lý AI',
    section: 'Công cụ học',
  },
  {
    key: 'learn.flashcards',
    href: '/flashcards',
    icon: 'layers',
    label: 'Flashcard ôn tập',
    section: 'Công cụ học',
  },
  {
    key: 'learn.saved',
    href: '/saved',
    icon: 'bookmark',
    label: 'Đã lưu & ghi chú',
    section: 'Công cụ học',
  },
  {
    key: 'learn.certificates',
    href: '/certificates',
    icon: 'award',
    label: 'Chứng nhận',
    section: 'Công cụ học',
  },
  {
    key: 'teach.home',
    href: '/instructor',
    icon: 'house',
    label: 'Tổng quan giảng viên',
    section: 'Giảng dạy',
  },
  {
    key: 'admin.home',
    href: '/admin',
    icon: 'house',
    label: 'Tổng quan',
    section: 'Quản trị',
  },
  {
    key: 'content.catalog',
    href: '/admin/catalog',
    icon: 'network',
    label: 'Lĩnh vực & chương trình',
    section: 'Nội dung',
  },
  {
    key: 'content.courses',
    href: '/admin/courses',
    icon: 'book-open',
    label: 'Khóa học',
    section: 'Nội dung',
  },
  {
    key: 'content.questions',
    href: '/admin/questions',
    icon: 'circle-help',
    label: 'Ngân hàng câu hỏi',
    section: 'Nội dung',
  },
  {
    key: 'content.quizzes',
    href: '/admin/quizzes',
    icon: 'clipboard-check',
    label: 'Bài kiểm tra',
    section: 'Nội dung',
  },
  {
    key: 'content.import',
    href: '/admin/import',
    icon: 'upload',
    label: 'Nhập dữ liệu',
    section: 'Nội dung',
  },
  {
    key: 'admin.users',
    href: '/admin/users',
    icon: 'users',
    label: 'Người dùng',
    section: 'Tổ chức',
  },
  {
    key: 'admin.org',
    href: '/admin/org',
    icon: 'building-2',
    label: 'Đơn vị & nhóm',
    section: 'Tổ chức',
  },
  {
    key: 'admin.roles',
    href: '/admin/roles',
    icon: 'shield',
    label: 'Vai trò & phân quyền',
    section: 'Tổ chức',
  },
  {
    key: 'admin.assignments',
    href: '/admin/assignments',
    icon: 'calendar',
    label: 'Giao học & hạn',
    section: 'Tổ chức',
  },
  {
    key: 'reports',
    href: '/reports',
    icon: 'chart-column',
    label: 'Báo cáo',
    section: 'Theo dõi',
  },
  {
    key: 'teach.inbox',
    href: '/instructor/inbox',
    icon: 'inbox',
    label: 'Hộp phản hồi',
    section: 'Theo dõi',
    badge: 'inbox',
  },
  {
    key: 'admin.system',
    href: '/admin/system',
    icon: 'settings',
    label: 'Hệ thống & nhật ký',
    section: 'Theo dõi',
  },
];

export interface NavSection {
  readonly section: string;
  readonly items: readonly MenuItem[];
}

/** The sidebar of a user: the catalog entries their role grants, grouped by section in order. */
export function navFor(menus: readonly MenuKey[]): readonly NavSection[] {
  const sections: { section: string; items: MenuItem[] }[] = [];
  for (const item of MENU_CATALOG) {
    if (!menus.includes(item.key)) continue;
    const last = sections[sections.length - 1];
    if (last?.section === item.section) last.items.push(item);
    else sections.push({ section: item.section, items: [item] });
  }
  return sections;
}

/** The catalog entries grouped by section, for choosing menus in the role form. */
export function allSections(): readonly NavSection[] {
  return navFor(MENU_CATALOG.map((item) => item.key));
}

export function menuLabel(key: MenuKey): string {
  return MENU_CATALOG.find((item) => item.key === key)?.label ?? key;
}

/**
 * The nav item the path belongs to: the longest href that equals the path or is a parent of it,
 * so `/admin/courses/new` marks "Khóa học" and not "Tổng quan" (`/admin`). `routerLinkActive`
 * cannot do this, which is why the sidebar computes it.
 */
export function activeHref(
  menus: readonly MenuKey[],
  path: string,
): string | null {
  const matches = navFor(menus)
    .flatMap((section) => section.items.map((item) => item.href))
    .filter((href) => path === href || path.startsWith(`${href}/`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}
