import type { Route } from '@angular/router';
import {
  adminOrgEndpoints,
  type AnyEndpoint,
  type FunctionCode,
} from '@lms/contracts';
import type { IconName } from '@lms/ui';
import type { Layout, RouteMeta } from './route-table';

/** Lazy `import()` of a screen's route component: the one place core names feature code. */
type ScreenLoad = NonNullable<Route['loadComponent']>;

export interface Screen {
  /** Angular path, without a leading slash. */
  readonly path: string;
  /** Static page title; screens with a data-dependent title replace it when migrated. */
  readonly title: string;
  /** The mockup page this route will become; the placeholder names it. */
  readonly mockupPage: string;
  readonly layout?: Layout;
  /**
   * Stays reachable for a user who must change a temporary password; every other screen is
   * closed to them (the backend refuses its calls with IDENTITY-PASSWORD_CHANGE_REQUIRED).
   */
  readonly passwordChange?: boolean;
  /** Reachable without signing in. */
  readonly public?: boolean;
  /** Only for visitors: a signed-in user is sent to their home (the login page). */
  readonly guestOnly?: boolean;
  /** The migrated component; absent means the route placeholder. */
  readonly load?: ScreenLoad;
}

export interface MenuNav {
  readonly icon: IconName;
  readonly section: string;
  /** Count shown beside the label; the shell fills it from the server's nav counts. */
  readonly badge?: 'inbox';
}

/** A list the header search can fill: the menu's entry screen, or `href` for a parametrised one. */
export interface MenuSearch {
  /** Path without a leading slash; must match a screen of the same group. */
  readonly href?: string;
}

export interface MenuGroup {
  readonly nav: MenuNav;
  readonly search?: MenuSearch;
  /**
   * Endpoints the group's screens cannot work without. While any is not served in this build
   * (`EndpointClient.isServed`), the function is left out of the user's menus.
   */
  readonly requires?: readonly AnyEndpoint[];
  /** The first screen is the menu's entry route: the sidebar links to it. */
  readonly screens: readonly [Screen, ...Screen[]];
}

/**
 * Every screen with a path, declared once. A screen of a **menu group** is opened by the backend
 * function it is written under (`functions.code`, which `/me` lists for the signed-in user); the
 * first screen of a group is where the sidebar links to. Group order here is not the sidebar
 * order: the sidebar follows the backend's `sortNo`. The **open** screens belong to no function:
 * any signed-in user may open them, and they are not in the sidebar. The mockup's `routes[]`
 * (core/router.js) is the spec. `/` (role home), `/design-system`, the dev routes and the
 * not-found route have their own entries in `app.routes.ts`.
 */
export const SCREEN_TABLE = {
  menus: {
    PROFILE: {
      nav: { icon: 'user', section: 'Tài khoản' },
      screens: [
        {
          path: 'profile',
          title: 'Hồ sơ cá nhân',
          mockupPage: 'profile',
          load: () =>
            import('../../features/account/profile/profile').then(
              (m) => m.Profile,
            ),
        },
      ],
    },
    COURSE_LEARNING: {
      nav: { icon: 'library', section: 'Học tập' },
      search: { href: 'catalog' },
      screens: [
        {
          path: 'learn',
          title: 'Trang chủ học tập',
          mockupPage: 'dashboard',
        },
        {
          path: 'course/:id',
          title: 'Chi tiết khóa học',
          mockupPage: 'course',
          load: () =>
            import('../../features/learning/course/course').then(
              (m) => m.Course,
            ),
        },
        {
          path: 'lesson/:courseId/:lessonId',
          title: 'Bài học',
          mockupPage: 'lesson',
          layout: 'focus',
        },
      ],
    },
    LEARNING_PROGRESS: {
      nav: { icon: 'chart-column', section: 'Học tập' },
      screens: [
        {
          path: 'progress',
          title: 'Tiến độ của tôi',
          mockupPage: 'progress',
        },
      ],
    },
    QUIZ_TAKING: {
      nav: { icon: 'notebook-pen', section: 'Học tập' },
      screens: [
        {
          path: 'quiz',
          title: 'Làm bài kiểm tra',
          mockupPage: 'quizHub',
        },
        {
          path: 'quiz/:id',
          title: 'Bài kiểm tra',
          mockupPage: 'quizIntro',
        },
        {
          path: 'quiz/:id/take',
          title: 'Làm bài kiểm tra',
          mockupPage: 'quizTake',
          layout: 'focus',
        },
        {
          path: 'quiz/:id/attempts',
          title: 'Lịch sử thi',
          mockupPage: 'quizAttempts',
        },
        {
          path: 'quiz/:id/result/:attemptId',
          title: 'Kết quả bài kiểm tra',
          mockupPage: 'quizResult',
        },
      ],
    },
    COURSE_MANAGEMENT: {
      nav: { icon: 'book-open', section: 'Nội dung' },
      search: {},
      screens: [
        {
          path: 'admin/courses',
          title: 'Khóa học',
          mockupPage: 'adminCourses',
          load: () =>
            import('../../features/admin-content/courses/courses').then(
              (m) => m.Courses,
            ),
        },
        {
          path: 'admin/courses/new',
          title: 'Tạo khóa học mới',
          mockupPage: 'courseWizard',
          load: () =>
            import('../../features/admin-content/course-new/course-new').then(
              (m) => m.CourseNew,
            ),
        },
        {
          path: 'admin/courses/:id/edit',
          title: 'Sửa khóa học',
          mockupPage: 'courseWizard',
          load: () =>
            import(
              '../../features/admin-content/course-editor/course-editor'
            ).then((m) => m.CourseEditor),
        },
      ],
    },
    LESSON_MANAGEMENT: {
      nav: { icon: 'file-text', section: 'Nội dung' },
      screens: [
        {
          path: 'admin/lessons',
          title: 'Quản lý bài giảng',
          mockupPage: 'lessons',
        },
      ],
    },
    QUESTION_BANK: {
      nav: { icon: 'circle-help', section: 'Nội dung' },
      screens: [
        {
          path: 'admin/questions',
          title: 'Ngân hàng câu hỏi',
          mockupPage: 'questions',
        },
      ],
    },
    QUIZ_MANAGEMENT: {
      nav: { icon: 'clipboard-check', section: 'Nội dung' },
      screens: [
        {
          path: 'admin/quizzes',
          title: 'Bài kiểm tra',
          mockupPage: 'quizzes',
        },
        {
          path: 'admin/quizzes/:id',
          title: 'Cấu hình bài kiểm tra',
          mockupPage: 'quizConfig',
        },
      ],
    },
    USER_MANAGEMENT: {
      nav: { icon: 'users', section: 'Tổ chức' },
      screens: [
        {
          path: 'admin/users',
          title: 'Người dùng',
          mockupPage: 'users',
          load: () =>
            import('../../features/admin-org/users/users').then((m) => m.Users),
        },
        {
          path: 'admin/users/:id',
          title: 'Người dùng',
          mockupPage: 'userDetail',
          load: () =>
            import('../../features/admin-org/user-detail/user-detail').then(
              (m) => m.UserDetail,
            ),
        },
      ],
    },
    ORGANIZATION_MANAGEMENT: {
      nav: { icon: 'building-2', section: 'Tổ chức' },
      screens: [
        {
          path: 'admin/org',
          title: 'Đơn vị & nhóm',
          mockupPage: 'org',
          load: () =>
            import('../../features/admin-org/org/org').then((m) => m.Org),
        },
      ],
    },
    ROLE_MANAGEMENT: {
      nav: { icon: 'shield', section: 'Tổ chức' },
      requires: [
        adminOrgEndpoints.roles,
        adminOrgEndpoints.saveRole,
        adminOrgEndpoints.deleteRole,
      ],
      screens: [
        {
          path: 'admin/roles',
          title: 'Vai trò & phân quyền',
          mockupPage: 'roles',
          load: () =>
            import('../../features/admin-org/roles/roles').then((m) => m.Roles),
        },
      ],
    },
    COURSE_ASSIGNMENT: {
      nav: { icon: 'calendar', section: 'Tổ chức' },
      screens: [
        {
          path: 'admin/assignments',
          title: 'Giao học & hạn hoàn thành',
          mockupPage: 'assignments',
          load: () =>
            import('../../features/admin-org/assignments/assignments').then(
              (m) => m.Assignments,
            ),
        },
      ],
    },
    REPORTING: {
      nav: { icon: 'chart-column', section: 'Theo dõi' },
      search: { href: 'reports/learners' },
      screens: [
        {
          path: 'reports',
          title: 'Báo cáo đào tạo',
          mockupPage: 'reports',
        },
        {
          path: 'reports/:dim',
          title: 'Báo cáo',
          mockupPage: 'reportDetail',
        },
      ],
    },
    SYSTEM_AUDIT: {
      nav: { icon: 'settings', section: 'Theo dõi' },
      screens: [
        {
          path: 'admin/system',
          title: 'Hệ thống & nhật ký',
          mockupPage: 'system',
        },
      ],
    },
    KNOWLEDGE_HUB: {
      nav: { icon: 'graduation-cap', section: 'Công cụ học' },
      screens: [
        {
          path: 'knowledge',
          title: 'Kho tri thức',
          mockupPage: 'knowledge',
        },
      ],
    },
    AI_ASSISTANT: {
      nav: { icon: 'sparkles', section: 'Công cụ học' },
      screens: [
        {
          path: 'assistant',
          title: 'Trợ lý AI',
          mockupPage: 'assistant',
          layout: 'workspace',
          load: () =>
            import('../../features/study-tools/assistant/assistant').then(
              (m) => m.Assistant,
            ),
        },
      ],
    },
    ISSUE_HUB: {
      nav: { icon: 'message-square', section: 'Công cụ học' },
      screens: [
        {
          path: 'issues',
          title: 'Tra cứu sự cố',
          mockupPage: 'issues',
        },
      ],
    },
  },
  /**
   * Screens of the mockup that no backend function covers: any signed-in user may open them, the
   * guards never block them and the sidebar does not list them (login is public, the password
   * change is the one screen a user with a temporary password may use).
   */
  open: [
    {
      path: 'login',
      title: 'Đăng nhập',
      mockupPage: 'login',
      layout: 'bare',
      public: true,
      guestOnly: true,
      load: () =>
        import('../../features/auth/login/login').then((m) => m.Login),
    },
    {
      path: 'change-password',
      title: 'Đổi mật khẩu',
      mockupPage: 'changePassword',
      layout: 'bare',
      passwordChange: true,
      load: () =>
        import('../../features/auth/change-password/change-password').then(
          (m) => m.ChangePassword,
        ),
    },
    {
      path: 'catalog',
      title: 'Danh mục khóa học',
      mockupPage: 'catalog',
      load: () =>
        import('../../features/learning/catalog/catalog').then(
          (m) => m.Catalog,
        ),
    },
    {
      path: 'admin/catalog',
      title: 'Lĩnh vực & chương trình',
      mockupPage: 'adminCatalog',
      load: () =>
        import(
          '../../features/admin-content/training-catalog/training-catalog'
        ).then((m) => m.TrainingCatalog),
    },
    { path: 'leaderboard', title: 'Bảng xếp hạng', mockupPage: 'leaderboard' },
    { path: 'flashcards', title: 'Flashcard ôn tập', mockupPage: 'flashcards' },
    { path: 'saved', title: 'Đã lưu & ghi chú', mockupPage: 'saved' },
    { path: 'certificates', title: 'Chứng nhận', mockupPage: 'certificates' },
    { path: 'certificate/:id', title: 'Chứng nhận', mockupPage: 'certificate' },
    {
      path: 'instructor',
      title: 'Tổng quan giảng viên',
      mockupPage: 'instructor',
    },
    { path: 'instructor/inbox', title: 'Hộp phản hồi', mockupPage: 'inbox' },
    { path: 'admin', title: 'Tổng quan quản trị', mockupPage: 'adminHome' },
    {
      path: 'admin/import',
      title: 'Nhập dữ liệu hàng loạt',
      mockupPage: 'import',
    },
    { path: 'notifications', title: 'Thông báo', mockupPage: 'notifications' },
    {
      path: '403',
      title: 'Không đủ quyền',
      mockupPage: 'forbidden',
      load: () =>
        import('../../features/errors/forbidden/forbidden').then(
          (m) => m.Forbidden,
        ),
    },
  ],
} as const satisfies {
  /** Checked against every key: a function code without a group is a compile error. */
  readonly menus: Record<FunctionCode, MenuGroup>;
  readonly open: readonly Screen[];
};

type MenuScreens = (typeof SCREEN_TABLE.menus)[FunctionCode]['screens'][number];
type OpenScreens = (typeof SCREEN_TABLE.open)[number];

/** Every path of the table. */
export type ScreenPath = (MenuScreens | OpenScreens)['path'];
/** The paths without a `:param`, which are concrete URLs. */
export type StaticScreenPath = Exclude<ScreenPath, `${string}:${string}`>;

/** The URL of a screen with no route parameter. Renaming the screen breaks callers at build time. */
export const screenHref = (path: StaticScreenPath): string => `/${path}`;

/** The function codes in table order. */
export const FUNCTION_CODES = Object.keys(SCREEN_TABLE.menus) as FunctionCode[];

/** The group of a function, with the literal paths of the table widened to the `MenuGroup` shape. */
export const menuGroup = (code: FunctionCode): MenuGroup =>
  SCREEN_TABLE.menus[code];

/** A screen with the function code it is declared under (`undefined` for the open ones). */
export interface ScreenEntry {
  readonly screen: Screen;
  readonly menu?: FunctionCode;
}

/** The table flattened in declaration order. */
export const SCREEN_ENTRIES: readonly ScreenEntry[] = [
  ...FUNCTION_CODES.flatMap((menu) =>
    menuGroup(menu).screens.map((screen) => ({ screen, menu })),
  ),
  ...SCREEN_TABLE.open.map((screen) => ({ screen })),
];

export function metaOf({ screen, menu }: ScreenEntry): RouteMeta {
  return {
    ...(menu ? { menu } : {}),
    layout: screen.layout ?? 'app',
    mockupPage: screen.mockupPage,
    ...(screen.passwordChange !== undefined
      ? { passwordChange: screen.passwordChange }
      : {}),
  };
}
