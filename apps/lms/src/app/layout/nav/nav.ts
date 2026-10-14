import type { Role } from '@lms/contracts';
import type { IconName } from '@lms/ui';

export interface NavItem {
  readonly href: string;
  readonly icon: IconName;
  readonly label: string;
  /** Count shown beside the label; the shell fills it from the server's nav counts. */
  readonly badge?: 'inbox';
}

export interface NavSection {
  readonly section: string;
  readonly items: readonly NavItem[];
}

const CONTENT: NavSection = {
  section: 'Nội dung',
  items: [
    {
      href: '/admin/catalog',
      icon: 'network',
      label: 'Lĩnh vực & chương trình',
    },
    { href: '/admin/courses', icon: 'book-open', label: 'Khóa học' },
    {
      href: '/admin/questions',
      icon: 'circle-help',
      label: 'Ngân hàng câu hỏi',
    },
    { href: '/admin/quizzes', icon: 'clipboard-check', label: 'Bài kiểm tra' },
    { href: '/admin/import', icon: 'upload', label: 'Nhập dữ liệu' },
  ],
};

/** The mockup's `NAV` (core/shell.js): every item has a real route behind it. */
export const NAV: Readonly<Record<Role, readonly NavSection[]>> = {
  learner: [
    {
      section: 'Học tập',
      items: [
        { href: '/learn', icon: 'house', label: 'Trang chủ học tập' },
        { href: '/catalog', icon: 'library', label: 'Danh mục khóa học' },
        { href: '/progress', icon: 'chart-column', label: 'Tiến độ của tôi' },
        { href: '/leaderboard', icon: 'trophy', label: 'Bảng xếp hạng' },
      ],
    },
    {
      section: 'Công cụ học',
      items: [
        { href: '/assistant', icon: 'sparkles', label: 'Trợ lý AI' },
        { href: '/flashcards', icon: 'layers', label: 'Flashcard ôn tập' },
        { href: '/saved', icon: 'bookmark', label: 'Đã lưu & ghi chú' },
        { href: '/certificates', icon: 'award', label: 'Chứng nhận' },
      ],
    },
  ],
  instructor: [
    {
      section: 'Giảng dạy',
      items: [
        { href: '/instructor', icon: 'house', label: 'Tổng quan giảng viên' },
        {
          href: '/instructor/inbox',
          icon: 'inbox',
          label: 'Hộp phản hồi',
          badge: 'inbox',
        },
      ],
    },
    CONTENT,
    {
      section: 'Theo dõi',
      items: [{ href: '/reports', icon: 'chart-column', label: 'Báo cáo' }],
    },
  ],
  admin: [
    {
      section: 'Quản trị',
      items: [{ href: '/admin', icon: 'house', label: 'Tổng quan' }],
    },
    CONTENT,
    {
      section: 'Tổ chức',
      items: [
        { href: '/admin/users', icon: 'users', label: 'Người dùng' },
        { href: '/admin/org', icon: 'building-2', label: 'Đơn vị & nhóm' },
        {
          href: '/admin/assignments',
          icon: 'calendar',
          label: 'Giao học & hạn',
        },
      ],
    },
    {
      section: 'Theo dõi',
      items: [
        { href: '/reports', icon: 'chart-column', label: 'Báo cáo' },
        {
          href: '/instructor/inbox',
          icon: 'inbox',
          label: 'Hộp phản hồi',
          badge: 'inbox',
        },
        {
          href: '/admin/system',
          icon: 'settings',
          label: 'Hệ thống & nhật ký',
        },
      ],
    },
  ],
  viewer: [
    {
      section: 'Báo cáo',
      items: [
        { href: '/reports', icon: 'chart-column', label: 'Tổng quan đào tạo' },
        { href: '/reports/learners', icon: 'users', label: 'Theo học viên' },
        { href: '/reports/courses', icon: 'book-open', label: 'Theo khóa học' },
        { href: '/reports/units', icon: 'building-2', label: 'Theo đơn vị' },
        { href: '/reports/competency', icon: 'target', label: 'Năng lực' },
      ],
    },
  ],
};

/**
 * The nav item the path belongs to: the longest href that equals the path or is a parent of it,
 * so `/admin/courses/new` marks "Khóa học" and not "Tổng quan" (`/admin`). `routerLinkActive`
 * cannot do this, which is why the sidebar computes it.
 */
export function activeHref(role: Role, path: string): string | null {
  const hrefs = NAV[role].flatMap((section) =>
    section.items.map((item) => item.href),
  );
  const matches = hrefs.filter(
    (href) => path === href || path.startsWith(`${href}/`),
  );
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}
