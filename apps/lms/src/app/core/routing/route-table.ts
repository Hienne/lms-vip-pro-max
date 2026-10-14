import type { Role } from '@lms/contracts';

export type Layout = 'app' | 'focus' | 'bare';

/** What the router, the shell and the guards read from a route's `data`. */
export interface RouteMeta {
  /** Roles allowed in; absent means any signed-in user. */
  readonly roles?: readonly Role[];
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
  readonly roles?: readonly Role[];
  readonly layout?: Layout;
  /** Reachable without signing in. */
  readonly public?: boolean;
}

const ALL: readonly Role[] = ['learner', 'instructor', 'admin', 'viewer'];
const LEARNER: readonly Role[] = ['learner'];
const ADMIN: readonly Role[] = ['admin'];
const CONTENT: readonly Role[] = ['admin', 'instructor'];
const REPORTS: readonly Role[] = ['admin', 'viewer', 'instructor'];

/**
 * The mockup's `routes[]` (core/router.js), the single source for navigation and role checks.
 * `/` (role home) and `/design-system` have their own routes in `app.routes.ts`.
 */
export const ROUTE_DEFS: readonly RouteDef[] = [
  {
    path: 'login',
    mockupPage: 'login',
    title: 'Đăng nhập',
    layout: 'bare',
    public: true,
  },
  {
    path: 'learn',
    mockupPage: 'dashboard',
    title: 'Trang chủ học tập',
    roles: LEARNER,
  },
  {
    path: 'catalog',
    mockupPage: 'catalog',
    title: 'Danh mục khóa học',
    roles: LEARNER,
  },
  {
    path: 'course/:id',
    mockupPage: 'course',
    title: 'Chi tiết khóa học',
    roles: LEARNER,
  },
  {
    path: 'lesson/:courseId/:lessonId',
    mockupPage: 'lesson',
    title: 'Bài học',
    roles: LEARNER,
    layout: 'focus',
  },
  {
    path: 'quiz/:id',
    mockupPage: 'quizIntro',
    title: 'Bài kiểm tra',
    roles: LEARNER,
  },
  {
    path: 'quiz/:id/take',
    mockupPage: 'quizTake',
    title: 'Làm bài kiểm tra',
    roles: LEARNER,
    layout: 'focus',
  },
  {
    path: 'quiz/:id/result/:attemptId',
    mockupPage: 'quizResult',
    title: 'Kết quả bài kiểm tra',
    roles: ALL,
  },
  {
    path: 'quiz/:id/attempts',
    mockupPage: 'quizAttempts',
    title: 'Lịch sử thi',
    roles: LEARNER,
  },
  {
    path: 'progress',
    mockupPage: 'progress',
    title: 'Tiến độ của tôi',
    roles: LEARNER,
  },
  {
    path: 'leaderboard',
    mockupPage: 'leaderboard',
    title: 'Bảng xếp hạng',
    roles: LEARNER,
  },
  {
    path: 'certificates',
    mockupPage: 'certificates',
    title: 'Chứng nhận',
    roles: LEARNER,
  },
  {
    path: 'certificate/:id',
    mockupPage: 'certificate',
    title: 'Chứng nhận',
    roles: LEARNER,
  },
  {
    path: 'saved',
    mockupPage: 'saved',
    title: 'Đã lưu & ghi chú',
    roles: LEARNER,
  },
  {
    path: 'flashcards',
    mockupPage: 'flashcards',
    title: 'Flashcard ôn tập',
    roles: LEARNER,
  },
  {
    path: 'assistant',
    mockupPage: 'assistant',
    title: 'Trợ lý AI',
    roles: LEARNER,
  },
  {
    path: 'notifications',
    mockupPage: 'notifications',
    title: 'Thông báo',
    roles: ALL,
  },
  {
    path: 'profile',
    mockupPage: 'profile',
    title: 'Hồ sơ cá nhân',
    roles: ALL,
  },
  {
    path: 'instructor',
    mockupPage: 'instructor',
    title: 'Tổng quan giảng viên',
    roles: ['instructor', 'admin'],
  },
  {
    path: 'instructor/inbox',
    mockupPage: 'inbox',
    title: 'Hộp phản hồi',
    roles: ['instructor', 'admin'],
  },
  {
    path: 'admin',
    mockupPage: 'adminHome',
    title: 'Tổng quan quản trị',
    roles: ADMIN,
  },
  {
    path: 'admin/catalog',
    mockupPage: 'adminCatalog',
    title: 'Lĩnh vực & chương trình',
    roles: CONTENT,
  },
  {
    path: 'admin/courses',
    mockupPage: 'adminCourses',
    title: 'Khóa học',
    roles: CONTENT,
  },
  {
    path: 'admin/courses/new',
    mockupPage: 'courseWizard',
    title: 'Tạo khóa học mới',
    roles: CONTENT,
  },
  {
    path: 'admin/courses/:id/edit',
    mockupPage: 'courseWizard',
    title: 'Sửa khóa học',
    roles: CONTENT,
  },
  {
    path: 'admin/questions',
    mockupPage: 'questions',
    title: 'Ngân hàng câu hỏi',
    roles: CONTENT,
  },
  {
    path: 'admin/quizzes',
    mockupPage: 'quizzes',
    title: 'Bài kiểm tra',
    roles: CONTENT,
  },
  {
    path: 'admin/quizzes/:id',
    mockupPage: 'quizConfig',
    title: 'Cấu hình bài kiểm tra',
    roles: CONTENT,
  },
  {
    path: 'admin/import',
    mockupPage: 'import',
    title: 'Nhập dữ liệu hàng loạt',
    roles: CONTENT,
  },
  {
    path: 'admin/users',
    mockupPage: 'users',
    title: 'Người dùng',
    roles: ADMIN,
  },
  {
    path: 'admin/users/:id',
    mockupPage: 'userDetail',
    title: 'Người dùng',
    roles: ADMIN,
  },
  {
    path: 'admin/org',
    mockupPage: 'org',
    title: 'Đơn vị & nhóm',
    roles: ADMIN,
  },
  {
    path: 'admin/assignments',
    mockupPage: 'assignments',
    title: 'Giao học & hạn hoàn thành',
    roles: ADMIN,
  },
  {
    path: 'admin/system',
    mockupPage: 'system',
    title: 'Hệ thống & nhật ký',
    roles: ADMIN,
  },
  {
    path: 'reports',
    mockupPage: 'reports',
    title: 'Báo cáo đào tạo',
    roles: REPORTS,
  },
  {
    path: 'reports/:dim',
    mockupPage: 'reportDetail',
    title: 'Báo cáo',
    roles: REPORTS,
  },
  { path: '403', mockupPage: 'forbidden', title: 'Không đủ quyền', roles: ALL },
];

/** Role home and not-found: registered beside the table. */
export const HOME_META: RouteMeta = {
  roles: ALL,
  layout: 'app',
  mockupPage: 'home',
};
export const NOT_FOUND_META: RouteMeta = {
  layout: 'app',
  mockupPage: 'notFound',
};

export function metaOf(def: RouteDef): RouteMeta {
  return {
    ...(def.roles ? { roles: def.roles } : {}),
    layout: def.layout ?? 'app',
    mockupPage: def.mockupPage,
  };
}
