import type { Role } from '@lms/contracts';
import { createAppRoutes } from '../../app.routes';
import { activeHref, NAV } from './nav';

const labels = (role: Role) =>
  NAV[role].map((s) => [s.section, s.items.map((i) => i.label)]);

describe('NAV', () => {
  it('lists the mockup sections and items for every role', () => {
    expect(labels('learner')).toEqual([
      [
        'Học tập',
        [
          'Trang chủ học tập',
          'Danh mục khóa học',
          'Tiến độ của tôi',
          'Bảng xếp hạng',
        ],
      ],
      [
        'Công cụ học',
        ['Trợ lý AI', 'Flashcard ôn tập', 'Đã lưu & ghi chú', 'Chứng nhận'],
      ],
    ]);
    expect(labels('instructor').map(([s]) => s)).toEqual([
      'Giảng dạy',
      'Nội dung',
      'Theo dõi',
    ]);
    expect(labels('admin').map(([s]) => s)).toEqual([
      'Quản trị',
      'Nội dung',
      'Tổ chức',
      'Theo dõi',
    ]);
    expect(labels('viewer')).toEqual([
      [
        'Báo cáo',
        [
          'Tổng quan đào tạo',
          'Theo học viên',
          'Theo khóa học',
          'Theo đơn vị',
          'Năng lực',
        ],
      ],
    ]);
  });

  it('puts the inbox count on the inbox item of instructors and admins only', () => {
    const withBadge = (role: Role) =>
      NAV[role]
        .flatMap((s) => s.items)
        .filter((i) => i.badge)
        .map((i) => i.href);
    expect(withBadge('instructor')).toEqual(['/instructor/inbox']);
    expect(withBadge('admin')).toEqual(['/instructor/inbox']);
    expect(withBadge('learner')).toEqual([]);
    expect(withBadge('viewer')).toEqual([]);
  });

  it('links only to routes that exist and that the role may open', () => {
    const defs = createAppRoutes({ devTools: false });
    const matches = (pattern: string, href: string) =>
      new RegExp(`^${pattern.replace(/:\w+/g, '[^/]+')}$`).test(href.slice(1));
    for (const role of ['learner', 'instructor', 'admin', 'viewer'] as const) {
      for (const item of NAV[role].flatMap((s) => s.items)) {
        const route = defs.find(
          (r) =>
            r.path !== undefined &&
            r.path !== '**' &&
            matches(r.path, item.href),
        );
        expect(route, `${role}: ${item.href}`).toBeDefined();
        const roles = (route?.data?.['roles'] ?? []) as Role[];
        expect(roles, `${role}: ${item.href}`).toContain(role);
      }
    }
  });
});

describe('activeHref', () => {
  it.each([
    ['admin', '/admin', '/admin'],
    ['admin', '/admin/courses', '/admin/courses'],
    ['admin', '/admin/courses/new', '/admin/courses'],
    ['admin', '/admin/courses/c1/edit', '/admin/courses'],
    ['admin', '/admin/quizzes/q1', '/admin/quizzes'],
    ['instructor', '/instructor/inbox', '/instructor/inbox'],
    ['instructor', '/instructor', '/instructor'],
    ['viewer', '/reports', '/reports'],
    ['viewer', '/reports/learners', '/reports/learners'],
    ['learner', '/learn', '/learn'],
    ['learner', '/administrator', null],
    ['learner', '/course/c1', null],
  ] as const)('%s at %s → %s', (role, path, expected) => {
    expect(activeHref(role, path)).toBe(expected);
  });
});
