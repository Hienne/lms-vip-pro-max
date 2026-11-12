import type { Route } from '@angular/router';
import {
  assessmentV1Endpoints,
  adminOrgEndpoints,
  communityEndpoints,
  gamificationEndpoints,
  learnerEndpoints,
  learnerQuizEndpoints,
  flashcardEndpoints,
  assessmentReportEndpoints,
  certificateEndpoints,
  personalEndpoints,
  type AnyEndpoint,
  type FunctionCode,
} from '@lms/contracts';
import type { IconName } from '@lms/ui';
import type { Layout, RouteMeta } from './route-table';

/** Lazy `import()` of a screen's route component: the one place core names feature code. */
type ScreenLoad = NonNullable<Route['loadComponent']>;

export interface Screen {
  /** A secondary route may reuse a function without adding a sidebar entry. */
  readonly access?: FunctionCode;
  readonly requires?: readonly AnyEndpoint[];
  /** Angular path, without a leading slash. */
  readonly path: string;
  /** Static page title; screens with a data-dependent title replace it when migrated. */
  readonly title: string;
  /** The mockup page this route will become; the placeholder names it. */
  readonly mockupPage: string;
  readonly layout?: Layout;
  /** `create` on the route of a screen that also edits: the screen reads it from the route's `data`. */
  readonly mode?: 'create';
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
  /** Retired destinations forward to the existing screen that owns their content. */
  readonly redirectTo?: string;
}

export interface MenuNav {
  /** Retain server function codes and old URLs without showing a duplicate destination. */
  readonly hidden?: boolean;
  readonly icon: IconName;
  readonly section: string;
  /** Count shown beside the label; the shell fills it from the server's nav counts. */
  readonly badge?: 'inbox';
}

/** A list the header search can fill: the menu's entry screen, or `href` for a parametrised one. */
export interface MenuSearch {
  readonly queryKey?: 'q' | 'userId';
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
          requires: [learnerEndpoints.dashboard],
          title: 'Trang chủ học tập',
          mockupPage: 'dashboard',
          load: () =>
            import('../../features/learning/learn/learn').then((m) => m.Learn),
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
          path: 'scorm',
          title: 'Bài giảng SCORM',
          mockupPage: 'lessons',
          load: () =>
            import('../../features/scorm/scorm-library/scorm-library').then(
              (m) => m.ScormLibrary,
            ),
        },
        {
          path: 'lesson/:courseId/:lessonId',
          title: 'Bài học',
          mockupPage: 'lesson',
          layout: 'focus',
          load: () =>
            import('../../features/lesson/lesson/lesson').then((m) => m.Lesson),
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
          load: () =>
            import('../../features/achievements/progress/progress').then(
              (m) => m.LearningProgress,
            ),
        },
      ],
    },
    QUIZ_TAKING: {
      nav: { icon: 'notebook-pen', section: 'Học tập' },
      requires: [
        learnerQuizEndpoints.quizIntro,
        learnerQuizEndpoints.startAttempt,
        learnerQuizEndpoints.myAttempts,
      ],
      screens: [
        {
          path: 'quiz',
          title: 'Làm bài kiểm tra',
          mockupPage: 'quizHub',
          load: () =>
            import('../../features/quiz/learner-quiz/quiz-hub/quiz-hub').then(
              (m) => m.QuizHub,
            ),
        },
        {
          path: 'quiz/:id',
          title: 'Bài kiểm tra',
          mockupPage: 'quizIntro',
          load: () =>
            import(
              '../../features/quiz/learner-quiz/quiz-intro/quiz-intro'
            ).then((m) => m.QuizIntro),
        },
        {
          path: 'quiz/:id/take',
          title: 'Làm bài kiểm tra',
          mockupPage: 'quizTake',
          layout: 'focus',
          load: () =>
            import('../../features/quiz/learner-quiz/quiz-take/quiz-take').then(
              (m) => m.QuizTake,
            ),
        },
        {
          path: 'quiz/:id/attempts',
          title: 'Lịch sử thi',
          mockupPage: 'quizAttempts',
          load: () =>
            import(
              '../../features/quiz/learner-quiz/quiz-attempts/quiz-attempts'
            ).then((m) => m.QuizAttempts),
        },
        {
          path: 'quiz/:id/result/:attemptId',
          title: 'Kết quả bài kiểm tra',
          mockupPage: 'quizResult',
          load: () =>
            import(
              '../../features/quiz/learner-quiz/quiz-result/quiz-result'
            ).then((m) => m.QuizResult),
        },
      ],
    },
    TRAINING_CATALOG: {
      nav: { icon: 'layers', section: 'Nội dung' },
      screens: [
        {
          path: 'admin/catalog',
          title: 'Lĩnh vực & chương trình',
          mockupPage: 'adminCatalog',
          load: () =>
            import(
              '../../features/admin-content/training-catalog/training-catalog'
            ).then((m) => m.TrainingCatalog),
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
          mode: 'create',
          load: () =>
            import(
              '../../features/admin-content/course-editor/course-editor'
            ).then((m) => m.CourseEditor),
        },
        {
          path: 'admin/courses/ai-drafts/:jobId',
          title: 'Công việc tạo khóa học',
          mockupPage: 'courseWizard',
          load: () =>
            import(
              '../../features/admin-content/ai-course/legacy-course-job/legacy-course-job'
            ).then((m) => m.LegacyCourseJob),
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
          load: () =>
            import('../../features/scorm/scorm-library/scorm-library').then(
              (m) => m.ScormLibrary,
            ),
        },
      ],
    },
    QUESTION_BANK: {
      nav: { icon: 'circle-help', section: 'Nội dung' },
      requires: [
        assessmentV1Endpoints.questions,
        assessmentV1Endpoints.createQuestion,
      ],
      screens: [
        {
          path: 'admin/questions',
          title: 'Ngân hàng câu hỏi',
          mockupPage: 'questions',
          load: () =>
            import(
              '../../features/quiz/assessment-screen/assessment-screen'
            ).then((m) => m.AssessmentScreen),
        },
      ],
    },
    QUIZ_MANAGEMENT: {
      nav: { icon: 'clipboard-check', section: 'Nội dung' },
      requires: [
        assessmentV1Endpoints.courseQuizList,
        assessmentV1Endpoints.updateQuiz,
      ],
      screens: [
        {
          path: 'admin/quizzes',
          title: 'Bài kiểm tra',
          mockupPage: 'quizzes',
          load: () =>
            import(
              '../../features/quiz/assessment-screen/assessment-screen'
            ).then((m) => m.AssessmentScreen),
        },
        {
          path: 'admin/quizzes/:id',
          title: 'Cấu hình bài kiểm tra',
          mockupPage: 'quizConfig',
          load: () =>
            import(
              '../../features/quiz/assessment-screen/assessment-screen'
            ).then((m) => m.AssessmentScreen),
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
      requires: [
        assessmentReportEndpoints.overview,
        assessmentReportEndpoints.results,
      ],
      search: { href: 'reports/results', queryKey: 'userId' },
      screens: [
        {
          path: 'reports',
          title: 'Báo cáo đào tạo',
          mockupPage: 'reports',
          load: () =>
            import('../../features/reports/report-screen/report-screen').then(
              (m) => m.ReportScreen,
            ),
        },
        {
          path: 'reports/gamification',
          title: 'Tác động gamification',
          mockupPage: 'gamificationImpact',
          load: () =>
            import(
              '../../features/admin-gamification/gamification-impact/gamification-impact'
            ).then((m) => m.GamificationImpact),
        },
        {
          path: 'reports/:dim',
          title: 'Báo cáo',
          mockupPage: 'reportDetail',
          load: () =>
            import('../../features/reports/report-screen/report-screen').then(
              (m) => m.ReportScreen,
            ),
        },
      ],
    },
    SYSTEM_AUDIT: {
      nav: { icon: 'settings', section: 'Theo dõi' },
      requires: [gamificationEndpoints.config],
      screens: [
        {
          path: 'admin/gamification',
          title: 'Cấu hình điểm thưởng',
          mockupPage: 'gamificationAdmin',
          load: () =>
            import(
              '../../features/admin-gamification/gamification-admin/gamification-admin'
            ).then((m) => m.GamificationAdmin),
        },
        {
          path: 'admin/system',
          title: 'Hệ thống & nhật ký',
          mockupPage: 'system',
        },
      ],
    },
    KNOWLEDGE_HUB: {
      nav: { icon: 'graduation-cap', section: 'Cộng đồng', hidden: true },
      screens: [
        {
          path: 'knowledge',
          title: 'Kho tri thức',
          mockupPage: 'knowledge',
          redirectTo: 'community/questions',
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
        {
          path: 'assistant/tai-lieu',
          title: 'Tài liệu của trợ lý',
          mockupPage: 'assistant',
          load: () =>
            import(
              '../../features/study-tools/assistant/documents/assistant-documents'
            ).then((m) => m.AssistantDocuments),
        },
      ],
    },
    COMMUNITY: {
      nav: { icon: 'message-square', section: 'Học tập' },
      screens: [
        {
          path: 'community/questions',
          title: 'Hỏi đáp',
          mockupPage: 'CM-01',
          load: () =>
            import('../../features/community/questions/questions').then(
              (m) => m.CommunityQuestions,
            ),
        },
        {
          path: 'community/questions/new',
          title: 'Đặt câu hỏi',
          mockupPage: 'CM-02',
          load: () =>
            import('../../features/community/ask/ask').then(
              (m) => m.CommunityAsk,
            ),
        },
        {
          path: 'community/contents/:id',
          title: 'Chi tiết nội dung',
          mockupPage: 'CM-03',
          load: () =>
            import('../../features/community/content/content').then(
              (m) => m.CommunityContent,
            ),
        },
        {
          path: 'community/contents/:id/edit',
          title: 'Sửa bài',
          mockupPage: 'CM-05',
          load: () =>
            import('../../features/community/editor/editor').then(
              (m) => m.CommunityEditor,
            ),
        },
        {
          path: 'community/articles',
          title: 'Bài viết',
          mockupPage: 'CM-04',
          load: () =>
            import('../../features/community/articles/articles').then(
              (m) => m.CommunityArticles,
            ),
        },
        {
          path: 'community/articles/new',
          title: 'Viết bài mới',
          mockupPage: 'CM-05',
          load: () =>
            import('../../features/community/editor/editor').then(
              (m) => m.CommunityEditor,
            ),
        },
        {
          path: 'community/reviews/new',
          title: 'Tạo đề nghị review',
          mockupPage: 'CM-REVIEW-NEW',
          load: () =>
            import('../../features/community/editor/editor').then(
              (m) => m.CommunityEditor,
            ),
        },
        {
          path: 'community/reviews/:id/edit',
          title: 'Sửa thiết kế',
          mockupPage: 'CM-REVIEW-EDIT',
          load: () =>
            import('../../features/community/editor/editor').then(
              (m) => m.CommunityEditor,
            ),
        },
        {
          path: 'community/reviews/:id',
          title: 'Review kiến trúc',
          mockupPage: 'CM-REVIEW-DETAIL',
          load: () =>
            import('../../features/community/review-detail/review-detail').then(
              (m) => m.CommunityReviewDetail,
            ),
        },
        {
          path: 'community/reviews',
          title: 'Review kiến trúc',
          mockupPage: 'CM-REVIEW',
          load: () =>
            import('../../features/community/reviews/reviews').then(
              (m) => m.CommunityReviews,
            ),
        },
        {
          path: 'community/me',
          title: 'Của tôi',
          mockupPage: 'CM-06',
          load: () =>
            import('../../features/community/mine/mine').then(
              (m) => m.CommunityMine,
            ),
        },
      ],
    },
    COMMUNITY_MODERATION: {
      nav: { icon: 'shield', section: 'Tổ chức' },
      requires: [communityEndpoints.moderators],
      screens: [
        {
          path: 'community/moderation',
          title: 'Điều phối cộng đồng',
          mockupPage: 'CM-08',
          load: () =>
            import('../../features/community/moderation/moderation').then(
              (m) => m.CommunityModeration,
            ),
        },
      ],
    },
    ISSUE_HUB: {
      nav: { icon: 'message-square', section: 'Cộng đồng', hidden: true },
      screens: [
        {
          path: 'issues',
          title: 'Tra cứu sự cố',
          mockupPage: 'issues',
          redirectTo: 'community/articles?type=lesson',
        },
      ],
    },
  },
  /**
   * Secondary routes without their own sidebar entry. `access` reuses a business function and
   * `requires` closes integrations unavailable in this build. Login is public; the password
   * change is the one screen a user with a temporary password may use.
   */
  open: [
    {
      path: 'chat-room',
      title: 'Giờ ra chơi',
      mockupPage: 'chatRoom',
      layout: 'workspace',
      load: () =>
        import('../../features/chat-room/chat-room').then((m) => m.ChatRoom),
    },
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
      path: 'register',
      title: 'Đăng ký tài khoản',
      mockupPage: 'register',
      layout: 'bare',
      public: true,
      guestOnly: true,
      load: () =>
        import('../../features/auth/register/register').then((m) => m.Register),
    },
    {
      path: 'forgot-password',
      title: 'Quên mật khẩu',
      mockupPage: 'forgotPassword',
      layout: 'bare',
      public: true,
      guestOnly: true,
      load: () =>
        import('../../features/auth/forgot-password/forgot-password').then(
          (m) => m.ForgotPassword,
        ),
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
      access: 'COURSE_LEARNING',
      title: 'Danh mục khóa học',
      mockupPage: 'catalog',
      load: () =>
        import('../../features/learning/catalog/catalog').then(
          (m) => m.Catalog,
        ),
    },
    {
      path: 'leaderboard',
      title: 'Bảng xếp hạng & thành tích',
      mockupPage: 'leaderboard',
      load: () =>
        import('../../features/achievements/leaderboard/leaderboard').then(
          (m) => m.Leaderboard,
        ),
    },
    {
      path: 'admin/flashcards',
      access: 'QUESTION_BANK',
      title: 'Quản lý flashcard',
      mockupPage: 'flashcards',
      requires: [flashcardEndpoints.managed],
      load: () =>
        import('../../features/study-tools/flashcards/manage-flashcards').then(
          (m) => m.ManageFlashcards,
        ),
    },
    {
      path: 'flashcards',
      access: 'QUIZ_TAKING',
      title: 'Flashcard ôn tập',
      mockupPage: 'flashcards',
      requires: [flashcardEndpoints.list],
      load: () =>
        import('../../features/study-tools/flashcards/flashcards').then(
          (m) => m.Flashcards,
        ),
    },
    {
      path: 'saved',
      access: 'COURSE_LEARNING',
      requires: [personalEndpoints.saved],
      title: 'Đã lưu & ghi chú',
      mockupPage: 'saved',
      load: () =>
        import('../../features/study-tools/saved/saved').then((m) => m.Saved),
    },
    {
      path: 'certificates',
      access: 'LEARNING_PROGRESS',
      title: 'Chứng nhận',
      mockupPage: 'certificates',
      requires: [certificateEndpoints.certificates],
      load: () =>
        import('../../features/achievements/certificates/certificates').then(
          (m) => m.Certificates,
        ),
    },
    {
      path: 'certificate/:id',
      access: 'LEARNING_PROGRESS',
      title: 'Chứng nhận',
      mockupPage: 'certificate',
      requires: [certificateEndpoints.certificate],
      load: () =>
        import('../../features/achievements/certificate/certificate').then(
          (m) => m.Certificate,
        ),
    },
    {
      path: 'instructor',
      access: 'COURSE_MANAGEMENT',
      title: 'Tổng quan giảng viên',
      mockupPage: 'instructor',
      load: () =>
        import('../../features/management-dashboard/management-dashboard').then(
          (m) => m.ManagementDashboard,
        ),
    },
    {
      path: 'instructor/inbox',
      access: 'COURSE_MANAGEMENT',
      title: 'Hộp phản hồi',
      mockupPage: 'inbox',
    },
    {
      path: 'admin',
      access: 'USER_MANAGEMENT',
      title: 'Tổng quan quản trị',
      mockupPage: 'adminHome',
      load: () =>
        import('../../features/management-dashboard/management-dashboard').then(
          (m) => m.ManagementDashboard,
        ),
    },
    {
      path: 'admin/import',
      access: 'COURSE_MANAGEMENT',
      title: 'Nhập dữ liệu hàng loạt',
      mockupPage: 'import',
    },
    {
      path: 'notifications',
      title: 'Thông báo',
      mockupPage: 'notifications',
      load: () =>
        import('../../features/account/notifications/notifications').then(
          (m) => m.Notifications,
        ),
    },
    {
      path: 'scorm/:id',
      title: 'Học bài giảng SCORM',
      mockupPage: 'lesson',
      load: () =>
        import('../../features/scorm/scorm-player/scorm-player').then(
          (m) => m.ScormPlayer,
        ),
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
  const access = menu ?? screen.access;
  return {
    ...(access ? { menu: access } : {}),
    ...(screen.requires ? { requires: screen.requires } : {}),
    layout: screen.layout ?? 'app',
    mockupPage: screen.mockupPage,
    ...(screen.mode ? { mode: screen.mode } : {}),
    ...(screen.passwordChange !== undefined
      ? { passwordChange: screen.passwordChange }
      : {}),
  };
}
