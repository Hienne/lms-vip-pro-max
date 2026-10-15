import type { Route } from '@angular/router';
import type { MenuKey } from '@lms/contracts';

export type Layout = 'app' | 'focus' | 'bare';

/** What the router, the shell and the guards read from a route's `data`. */
export interface RouteMeta {
  /** The menu that grants the screen; absent means any signed-in user. */
  readonly menu?: MenuKey;
  readonly layout: Layout;
  /** The mockup page this route will become; the placeholder names it. */
  readonly mockupPage: string;
}

export interface RouteDef {
  /** Angular path, without a leading slash. */
  readonly path: string;
  readonly mockupPage: string;
  /** Static page title; screens with a data-dependent title replace it when migrated. */
  readonly title: string;
  readonly menu?: MenuKey;
  readonly layout?: Layout;
  /** Reachable without signing in. */
  readonly public?: boolean;
  /** Only for visitors: a signed-in user is sent to their home (the login page). */
  readonly guestOnly?: boolean;
}

/**
 * The mockup's `routes[]` (core/router.js), the single source for navigation and menu checks.
 * `/` (role home) and `/design-system` have their own routes in `app.routes.ts`.
 */
export const ROUTE_DEFS: readonly RouteDef[] = [
  {
    path: 'login',
    mockupPage: 'login',
    title: 'Đăng nhập',
    layout: 'bare',
    public: true,
    guestOnly: true,
  },
  {
    path: 'learn',
    mockupPage: 'dashboard',
    title: 'Trang chủ học tập',
    menu: 'learn.home',
  },
  {
    path: 'catalog',
    mockupPage: 'catalog',
    title: 'Danh mục khóa học',
    menu: 'learn.catalog',
  },
  {
    path: 'course/:id',
    mockupPage: 'course',
    title: 'Chi tiết khóa học',
    menu: 'learn.catalog',
  },
  {
    path: 'lesson/:courseId/:lessonId',
    mockupPage: 'lesson',
    title: 'Bài học',
    menu: 'learn.catalog',
    layout: 'focus',
  },
  {
    path: 'quiz/:id',
    mockupPage: 'quizIntro',
    title: 'Bài kiểm tra',
    menu: 'learn.catalog',
  },
  {
    path: 'quiz/:id/take',
    mockupPage: 'quizTake',
    title: 'Làm bài kiểm tra',
    menu: 'learn.catalog',
    layout: 'focus',
  },
  {
    path: 'quiz/:id/result/:attemptId',
    mockupPage: 'quizResult',
    title: 'Kết quả bài kiểm tra',
  },
  {
    path: 'quiz/:id/attempts',
    mockupPage: 'quizAttempts',
    title: 'Lịch sử thi',
    menu: 'learn.catalog',
  },
  {
    path: 'progress',
    mockupPage: 'progress',
    title: 'Tiến độ của tôi',
    menu: 'learn.progress',
  },
  {
    path: 'leaderboard',
    mockupPage: 'leaderboard',
    title: 'Bảng xếp hạng',
    menu: 'learn.leaderboard',
  },
  {
    path: 'certificates',
    mockupPage: 'certificates',
    title: 'Chứng nhận',
    menu: 'learn.certificates',
  },
  {
    path: 'certificate/:id',
    mockupPage: 'certificate',
    title: 'Chứng nhận',
    menu: 'learn.certificates',
  },
  {
    path: 'saved',
    mockupPage: 'saved',
    title: 'Đã lưu & ghi chú',
    menu: 'learn.saved',
  },
  {
    path: 'flashcards',
    mockupPage: 'flashcards',
    title: 'Flashcard ôn tập',
    menu: 'learn.flashcards',
  },
  {
    path: 'assistant',
    mockupPage: 'assistant',
    title: 'Trợ lý AI',
    menu: 'learn.assistant',
  },
  {
    path: 'notifications',
    mockupPage: 'notifications',
    title: 'Thông báo',
  },
  {
    path: 'profile',
    mockupPage: 'profile',
    title: 'Hồ sơ cá nhân',
  },
  {
    path: 'instructor',
    mockupPage: 'instructor',
    title: 'Tổng quan giảng viên',
    menu: 'teach.home',
  },
  {
    path: 'instructor/inbox',
    mockupPage: 'inbox',
    title: 'Hộp phản hồi',
    menu: 'teach.inbox',
  },
  {
    path: 'admin',
    mockupPage: 'adminHome',
    title: 'Tổng quan quản trị',
    menu: 'admin.home',
  },
  {
    path: 'admin/catalog',
    mockupPage: 'adminCatalog',
    title: 'Lĩnh vực & chương trình',
    menu: 'content.catalog',
  },
  {
    path: 'admin/courses',
    mockupPage: 'adminCourses',
    title: 'Khóa học',
    menu: 'content.courses',
  },
  {
    path: 'admin/courses/new',
    mockupPage: 'courseWizard',
    title: 'Tạo khóa học mới',
    menu: 'content.courses',
  },
  {
    path: 'admin/courses/:id/edit',
    mockupPage: 'courseWizard',
    title: 'Sửa khóa học',
    menu: 'content.courses',
  },
  {
    path: 'admin/questions',
    mockupPage: 'questions',
    title: 'Ngân hàng câu hỏi',
    menu: 'content.questions',
  },
  {
    path: 'admin/quizzes',
    mockupPage: 'quizzes',
    title: 'Bài kiểm tra',
    menu: 'content.quizzes',
  },
  {
    path: 'admin/quizzes/:id',
    mockupPage: 'quizConfig',
    title: 'Cấu hình bài kiểm tra',
    menu: 'content.quizzes',
  },
  {
    path: 'admin/import',
    mockupPage: 'import',
    title: 'Nhập dữ liệu hàng loạt',
    menu: 'content.import',
  },
  {
    path: 'admin/users',
    mockupPage: 'users',
    title: 'Người dùng',
    menu: 'admin.users',
  },
  {
    path: 'admin/users/:id',
    mockupPage: 'userDetail',
    title: 'Người dùng',
    menu: 'admin.users',
  },
  {
    path: 'admin/org',
    mockupPage: 'org',
    title: 'Đơn vị & nhóm',
    menu: 'admin.org',
  },
  {
    path: 'admin/roles',
    mockupPage: 'roles',
    title: 'Vai trò & phân quyền',
    menu: 'admin.roles',
  },
  {
    path: 'admin/assignments',
    mockupPage: 'assignments',
    title: 'Giao học & hạn hoàn thành',
    menu: 'admin.assignments',
  },
  {
    path: 'admin/system',
    mockupPage: 'system',
    title: 'Hệ thống & nhật ký',
    menu: 'admin.system',
  },
  {
    path: 'reports',
    mockupPage: 'reports',
    title: 'Báo cáo đào tạo',
    menu: 'reports',
  },
  {
    path: 'reports/:dim',
    mockupPage: 'reportDetail',
    title: 'Báo cáo',
    menu: 'reports',
  },
  { path: '403', mockupPage: 'forbidden', title: 'Không đủ quyền' },
];

/** Role home and not-found: registered beside the table. */
export const HOME_META: RouteMeta = {
  layout: 'app',
  mockupPage: 'home',
};
export const NOT_FOUND_META: RouteMeta = {
  layout: 'app',
  mockupPage: 'notFound',
};

export function metaOf(def: RouteDef): RouteMeta {
  return {
    ...(def.menu ? { menu: def.menu } : {}),
    layout: def.layout ?? 'app',
    mockupPage: def.mockupPage,
  };
}

/** The menu a route's `data` requires, or `undefined` when any signed-in user may enter. */
export function menuOf(data: Route['data']): MenuKey | undefined {
  const menu: unknown = data?.['menu'];
  return typeof menu === 'string' ? (menu as MenuKey) : undefined;
}
