import type { Route } from '@angular/router';
import type { MenuKey } from '@lms/contracts';
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
  /** Sidebar wording, where it differs from the title of the entry screen. */
  readonly label?: string;
}

export interface MenuGroup {
  readonly nav: MenuNav;
  /** The first screen is the menu's entry route: the sidebar links to it. */
  readonly screens: readonly [Screen, ...Screen[]];
}

/**
 * Every screen with a path, declared once and grouped by the menu that grants it. A screen's menu
 * is the group it is written in; group order is sidebar order, and the first screen of a group is
 * where its sidebar entry links to. The mockup's `routes[]`
 * (core/router.js) is the spec. `/` (role home), `/design-system`, the dev routes and the
 * not-found route have their own entries in `app.routes.ts`.
 */
export const SCREEN_TABLE = {
  menus: {
    'learn.home': {
      nav: { icon: 'house', section: 'Học tập' },
      screens: [
        {
          path: 'learn',
          title: 'Trang chủ học tập',
          mockupPage: 'dashboard',
        },
      ],
    },
    'learn.catalog': {
      nav: { icon: 'library', section: 'Học tập' },
      screens: [
        {
          path: 'catalog',
          title: 'Danh mục khóa học',
          mockupPage: 'catalog',
        },
        {
          path: 'course/:id',
          title: 'Chi tiết khóa học',
          mockupPage: 'course',
        },
        {
          path: 'lesson/:courseId/:lessonId',
          title: 'Bài học',
          mockupPage: 'lesson',
          layout: 'focus',
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
      ],
    },
    'learn.progress': {
      nav: { icon: 'chart-column', section: 'Học tập' },
      screens: [
        {
          path: 'progress',
          title: 'Tiến độ của tôi',
          mockupPage: 'progress',
        },
      ],
    },
    'learn.leaderboard': {
      nav: { icon: 'trophy', section: 'Học tập' },
      screens: [
        {
          path: 'leaderboard',
          title: 'Bảng xếp hạng',
          mockupPage: 'leaderboard',
        },
      ],
    },
    'learn.assistant': {
      nav: { icon: 'sparkles', section: 'Công cụ học' },
      screens: [
        {
          path: 'assistant',
          title: 'Trợ lý AI',
          mockupPage: 'assistant',
        },
      ],
    },
    'learn.flashcards': {
      nav: { icon: 'layers', section: 'Công cụ học' },
      screens: [
        {
          path: 'flashcards',
          title: 'Flashcard ôn tập',
          mockupPage: 'flashcards',
        },
      ],
    },
    'learn.saved': {
      nav: { icon: 'bookmark', section: 'Công cụ học' },
      screens: [
        {
          path: 'saved',
          title: 'Đã lưu & ghi chú',
          mockupPage: 'saved',
        },
      ],
    },
    'learn.certificates': {
      nav: { icon: 'award', section: 'Công cụ học' },
      screens: [
        {
          path: 'certificates',
          title: 'Chứng nhận',
          mockupPage: 'certificates',
        },
        {
          path: 'certificate/:id',
          title: 'Chứng nhận',
          mockupPage: 'certificate',
        },
      ],
    },
    'teach.home': {
      nav: { icon: 'house', section: 'Giảng dạy' },
      screens: [
        {
          path: 'instructor',
          title: 'Tổng quan giảng viên',
          mockupPage: 'instructor',
        },
      ],
    },
    'admin.home': {
      nav: { icon: 'house', section: 'Quản trị', label: 'Tổng quan' },
      screens: [
        {
          path: 'admin',
          title: 'Tổng quan quản trị',
          mockupPage: 'adminHome',
        },
      ],
    },
    'content.catalog': {
      nav: { icon: 'network', section: 'Nội dung' },
      screens: [
        {
          path: 'admin/catalog',
          title: 'Lĩnh vực & chương trình',
          mockupPage: 'adminCatalog',
        },
      ],
    },
    'content.courses': {
      nav: { icon: 'book-open', section: 'Nội dung' },
      screens: [
        {
          path: 'admin/courses',
          title: 'Khóa học',
          mockupPage: 'adminCourses',
        },
        {
          path: 'admin/courses/new',
          title: 'Tạo khóa học mới',
          mockupPage: 'courseWizard',
        },
        {
          path: 'admin/courses/:id/edit',
          title: 'Sửa khóa học',
          mockupPage: 'courseWizard',
        },
      ],
    },
    'content.questions': {
      nav: { icon: 'circle-help', section: 'Nội dung' },
      screens: [
        {
          path: 'admin/questions',
          title: 'Ngân hàng câu hỏi',
          mockupPage: 'questions',
        },
      ],
    },
    'content.quizzes': {
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
    'content.import': {
      nav: { icon: 'upload', section: 'Nội dung', label: 'Nhập dữ liệu' },
      screens: [
        {
          path: 'admin/import',
          title: 'Nhập dữ liệu hàng loạt',
          mockupPage: 'import',
        },
      ],
    },
    'admin.users': {
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
    'admin.org': {
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
    'admin.roles': {
      nav: { icon: 'shield', section: 'Tổ chức' },
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
    'admin.assignments': {
      nav: { icon: 'calendar', section: 'Tổ chức', label: 'Giao học & hạn' },
      screens: [
        {
          path: 'admin/assignments',
          title: 'Giao học & hạn hoàn thành',
          mockupPage: 'assignments',
        },
      ],
    },
    reports: {
      nav: { icon: 'chart-column', section: 'Theo dõi', label: 'Báo cáo' },
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
    'teach.inbox': {
      nav: { icon: 'inbox', section: 'Theo dõi', badge: 'inbox' },
      screens: [
        {
          path: 'instructor/inbox',
          title: 'Hộp phản hồi',
          mockupPage: 'inbox',
        },
      ],
    },
    'admin.system': {
      nav: { icon: 'settings', section: 'Theo dõi' },
      screens: [
        {
          path: 'admin/system',
          title: 'Hệ thống & nhật ký',
          mockupPage: 'system',
        },
      ],
    },
  },
  /** Screens that belong to no menu: any signed-in user may open them (login is public). */
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
      path: 'quiz/:id/result/:attemptId',
      title: 'Kết quả bài kiểm tra',
      mockupPage: 'quizResult',
    },
    {
      path: 'notifications',
      title: 'Thông báo',
      mockupPage: 'notifications',
    },
    {
      path: 'profile',
      title: 'Hồ sơ cá nhân',
      mockupPage: 'profile',
      load: () =>
        import('../../features/account/profile/profile').then((m) => m.Profile),
    },
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
  /** Checked against every key: a menu without a group is a compile error. */
  readonly menus: Record<MenuKey, MenuGroup>;
  readonly open: readonly Screen[];
};

type MenuScreens = (typeof SCREEN_TABLE.menus)[MenuKey]['screens'][number];
type OpenScreens = (typeof SCREEN_TABLE.open)[number];

/** Every path of the table. */
export type ScreenPath = (MenuScreens | OpenScreens)['path'];
/** The paths without a `:param`, which are concrete URLs. */
export type StaticScreenPath = Exclude<ScreenPath, `${string}:${string}`>;

/** The menus in table order, which is sidebar order. */
export const MENU_KEYS = Object.keys(SCREEN_TABLE.menus) as MenuKey[];

/** The group of a menu, with the literal paths of the table widened to the `MenuGroup` shape. */
export const menuGroup = (menu: MenuKey): MenuGroup => SCREEN_TABLE.menus[menu];

/** A screen with the menu it is declared under (`undefined` for the open ones). */
export interface ScreenEntry {
  readonly screen: Screen;
  readonly menu?: MenuKey;
}

/** The table flattened in declaration order. */
export const SCREEN_ENTRIES: readonly ScreenEntry[] = [
  ...MENU_KEYS.flatMap((menu) =>
    menuGroup(menu).screens.map((screen) => ({ screen, menu })),
  ),
  ...SCREEN_TABLE.open.map((screen) => ({ screen })),
];

export function metaOf({ screen, menu }: ScreenEntry): RouteMeta {
  return {
    ...(menu ? { menu } : {}),
    layout: screen.layout ?? 'app',
    mockupPage: screen.mockupPage,
  };
}
