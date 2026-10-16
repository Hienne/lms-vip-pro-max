import type { MenuKey } from '@lms/contracts';
import { profileFixtures } from '@lms/mocks';
import { allSections, menuLabel, navFor } from './menu-catalog';

/** Every menu in sidebar order: key, entry href, icon, label, section, whether it carries the inbox badge. */
const MENUS = [
  ['learn.home', '/learn', 'house', 'Trang chủ học tập', 'Học tập'],
  ['learn.catalog', '/catalog', 'library', 'Danh mục khóa học', 'Học tập'],
  ['learn.progress', '/progress', 'chart-column', 'Tiến độ của tôi', 'Học tập'],
  ['learn.leaderboard', '/leaderboard', 'trophy', 'Bảng xếp hạng', 'Học tập'],
  ['learn.assistant', '/assistant', 'sparkles', 'Trợ lý AI', 'Công cụ học'],
  [
    'learn.flashcards',
    '/flashcards',
    'layers',
    'Flashcard ôn tập',
    'Công cụ học',
  ],
  ['learn.saved', '/saved', 'bookmark', 'Đã lưu & ghi chú', 'Công cụ học'],
  ['learn.certificates', '/certificates', 'award', 'Chứng nhận', 'Công cụ học'],
  ['teach.home', '/instructor', 'house', 'Tổng quan giảng viên', 'Giảng dạy'],
  ['admin.home', '/admin', 'house', 'Tổng quan', 'Quản trị'],
  [
    'content.catalog',
    '/admin/catalog',
    'network',
    'Lĩnh vực & chương trình',
    'Nội dung',
  ],
  ['content.courses', '/admin/courses', 'book-open', 'Khóa học', 'Nội dung'],
  [
    'content.questions',
    '/admin/questions',
    'circle-help',
    'Ngân hàng câu hỏi',
    'Nội dung',
  ],
  [
    'content.quizzes',
    '/admin/quizzes',
    'clipboard-check',
    'Bài kiểm tra',
    'Nội dung',
  ],
  ['content.import', '/admin/import', 'upload', 'Nhập dữ liệu', 'Nội dung'],
  ['admin.users', '/admin/users', 'users', 'Người dùng', 'Tổ chức'],
  ['admin.org', '/admin/org', 'building-2', 'Đơn vị & nhóm', 'Tổ chức'],
  ['admin.roles', '/admin/roles', 'shield', 'Vai trò & phân quyền', 'Tổ chức'],
  [
    'admin.assignments',
    '/admin/assignments',
    'calendar',
    'Giao học & hạn',
    'Tổ chức',
  ],
  ['reports', '/reports', 'chart-column', 'Báo cáo', 'Theo dõi'],
  [
    'teach.inbox',
    '/instructor/inbox',
    'inbox',
    'Hộp phản hồi',
    'Theo dõi',
    true,
  ],
  [
    'admin.system',
    '/admin/system',
    'settings',
    'Hệ thống & nhật ký',
    'Theo dõi',
  ],
] as const;

describe('menu catalog', () => {
  it('lists every menu with its entry href, icon, label and section', () => {
    const items = allSections().flatMap((section) =>
      section.items.map((item) => [
        item.key,
        item.href,
        item.icon,
        item.label,
        item.section,
        ...(item.badge ? [true] : []),
      ]),
    );
    expect(items).toEqual(MENUS.map((row) => [...row]));
    expect(items).toHaveLength(22);
  });

  it('groups consecutive menus of one section and keeps the order of the table', () => {
    expect(allSections().map((section) => section.section)).toEqual([
      'Học tập',
      'Công cụ học',
      'Giảng dạy',
      'Quản trị',
      'Nội dung',
      'Tổ chức',
      'Theo dõi',
    ]);
  });

  it('shows a role only the menus it holds, grouped by section', () => {
    const sections = navFor(profileFixtures['instructor'].menus);
    expect(
      sections.map((s) => [s.section, s.items.map((item) => item.key)]),
    ).toEqual([
      ['Giảng dạy', ['teach.home']],
      [
        'Nội dung',
        [
          'content.catalog',
          'content.courses',
          'content.questions',
          'content.quizzes',
          'content.import',
        ],
      ],
      ['Theo dõi', ['reports', 'teach.inbox']],
    ]);
  });

  it('follows the table order, not the order of the menus granted', () => {
    const menus: MenuKey[] = ['reports', 'learn.catalog', 'learn.home'];
    expect(
      navFor(menus).flatMap((section) => section.items.map((i) => i.key)),
    ).toEqual(['learn.home', 'learn.catalog', 'reports']);
  });

  it.each([
    ['admin.home', 'Tổng quan'],
    ['content.import', 'Nhập dữ liệu'],
    ['admin.assignments', 'Giao học & hạn'],
    ['reports', 'Báo cáo'],
  ] as const)('keeps the sidebar wording of %s', (key, label) => {
    expect(menuLabel(key)).toBe(label);
  });

  it('labels the other menus with the title of their first screen', () => {
    expect(menuLabel('learn.catalog')).toBe('Danh mục khóa học');
    expect(menuLabel('admin.users')).toBe('Người dùng');
  });
});
