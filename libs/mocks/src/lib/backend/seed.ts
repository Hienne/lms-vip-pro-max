import type { FunctionInfo, ScopeType } from '@lms/contracts';

// The backend's demo database (corebanking-academy `docs/sql/learning_hub_identity.sql`): one org,
// its 15 teams, the 5 roles with the screens each opens, 7 accounts and their 8 grants. The mock
// backend starts from it, and the specs read the same rows, so nothing invents a user the real
// database does not have.

/** The password every demo account has (documented by the backend's SQL README). */
export const SEED_PASSWORD = 'Demo@123';

/** When the seed was loaded; also the grants' `grantedAt`. */
export const SEED_TIME = '2026-10-17T07:04:53.991734Z';

export interface SeedOrg {
  readonly id: number;
  readonly parentId: number | null;
  readonly orgType: 'UNIT' | 'DEPARTMENT';
  readonly code: string;
  readonly name: string;
  readonly status: 'active' | 'inactive';
  readonly sortNo: number;
}

export interface SeedTeam {
  readonly id: number;
  readonly orgId: number;
  readonly code: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly status: 'active' | 'inactive';
}

export interface SeedRole {
  readonly roleId: number;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  /** The `function_id`s the role opens (the backend's `role_functions`). */
  readonly functionIds: readonly number[];
}

export interface SeedUser {
  readonly userId: string;
  readonly username: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly positionName: string | null;
  readonly orgId: number | null;
  readonly teamId: number | null;
  readonly status: 'active' | 'inactive' | 'locked';
  readonly authProvider: 'LOCAL' | 'SSO';
  readonly mustChangePassword: boolean;
}

export interface SeedGrant {
  readonly grantId: number;
  readonly userId: string;
  readonly roleId: number;
  readonly scope: ScopeType;
  readonly orgId: number | null;
  readonly teamId: number | null;
  readonly grantedBy: string;
  readonly grantedAt: string;
  readonly active: boolean;
}

export const SEED_ORGS: readonly SeedOrg[] = [
  {
    id: 1,
    parentId: null,
    orgType: 'UNIT',
    code: 'BIDV110B803',
    name: 'Ban Quản lý và phát triển Core Banking',
    status: 'active',
    sortNo: 0,
  },
];

export const SEED_TEAMS: readonly SeedTeam[] = [
  {
    id: 1,
    orgId: 1,
    code: 'BIDV110B8031000',
    name: 'Ban Giám đốc',
    description: null,
    status: 'active',
  },
  {
    id: 2,
    orgId: 1,
    code: 'BIDV110B803099',
    name: 'Nhóm BA&QC CIF',
    description: null,
    status: 'active',
  },
  {
    id: 3,
    orgId: 1,
    code: 'BIDV110B803100',
    name: 'Nhóm BA&QC GL',
    description: null,
    status: 'active',
  },
  {
    id: 4,
    orgId: 1,
    code: 'BIDV110B803101',
    name: 'Nhóm BA&QC Teller',
    description: null,
    status: 'active',
  },
  {
    id: 5,
    orgId: 1,
    code: 'BIDV110B803102',
    name: 'Nhóm BA&QC thanh toán',
    description: null,
    status: 'active',
  },
  {
    id: 6,
    orgId: 1,
    code: 'BIDV110B8031523',
    name: 'Nhóm BA&QC Thẻ',
    description: null,
    status: 'active',
  },
  {
    id: 7,
    orgId: 1,
    code: 'BIDV110B803103',
    name: 'Nhóm BA&QC Tiền gửi',
    description: null,
    status: 'active',
  },
  {
    id: 8,
    orgId: 1,
    code: 'BIDV110B803104',
    name: 'Nhóm BA&QC Tiền vay',
    description: null,
    status: 'active',
  },
  {
    id: 9,
    orgId: 1,
    code: 'BIDV110B8031281',
    name: 'Nhóm phát triển Core Banking',
    description: null,
    status: 'active',
  },
  {
    id: 10,
    orgId: 1,
    code: 'BIDV110B8031279',
    name: 'Nhóm Phát triển Kênh Core Banking',
    description: null,
    status: 'active',
  },
  {
    id: 11,
    orgId: 1,
    code: 'BIDV110B8031280',
    name: 'Nhóm Tích hợp Core Banking',
    description: null,
    status: 'active',
  },
  {
    id: 12,
    orgId: 1,
    code: 'BIDV110B803106',
    name: 'Quản trị hệ thống ứng dụng Core Banking',
    description: null,
    status: 'active',
  },
  {
    id: 13,
    orgId: 1,
    code: 'BIDV110B803107',
    name: 'Quản trị tham số và dữ liệu Core Banking',
    description: null,
    status: 'active',
  },
  {
    id: 14,
    orgId: 1,
    code: 'BIDV110B8031563',
    name: 'Tổ hỗ trợ Core Banking',
    description: null,
    status: 'active',
  },
  {
    id: 15,
    orgId: 1,
    code: 'BIDV110B803098',
    name: 'Tổng hợp và QA',
    description: null,
    status: 'active',
  },
];

export const SEED_FUNCTIONS: readonly FunctionInfo[] = [
  {
    id: 1,
    code: 'PROFILE',
    name: 'Hồ sơ cá nhân',
    routePattern: '/profile',
    parentFunctionId: null,
    sortNo: 10,
  },
  {
    id: 2,
    code: 'COURSE_LEARNING',
    name: 'Học tập',
    routePattern: '/learn',
    parentFunctionId: null,
    sortNo: 20,
  },
  {
    id: 3,
    code: 'LEARNING_PROGRESS',
    name: 'Tiến độ học tập',
    routePattern: '/progress',
    parentFunctionId: null,
    sortNo: 30,
  },
  {
    id: 4,
    code: 'QUIZ_TAKING',
    name: 'Làm bài kiểm tra',
    routePattern: '/quiz',
    parentFunctionId: null,
    sortNo: 40,
  },
  {
    id: 5,
    code: 'COURSE_MANAGEMENT',
    name: 'Quản lý khóa học',
    routePattern: '/admin/courses',
    parentFunctionId: null,
    sortNo: 50,
  },
  {
    id: 6,
    code: 'LESSON_MANAGEMENT',
    name: 'Quản lý bài giảng',
    routePattern: '/admin/lessons',
    parentFunctionId: null,
    sortNo: 60,
  },
  {
    id: 7,
    code: 'QUESTION_BANK',
    name: 'Ngân hàng câu hỏi',
    routePattern: '/admin/questions',
    parentFunctionId: null,
    sortNo: 70,
  },
  {
    id: 8,
    code: 'QUIZ_MANAGEMENT',
    name: 'Quản lý bài thi',
    routePattern: '/admin/quizzes',
    parentFunctionId: null,
    sortNo: 80,
  },
  {
    id: 9,
    code: 'USER_MANAGEMENT',
    name: 'Quản lý người dùng',
    routePattern: '/admin/users',
    parentFunctionId: null,
    sortNo: 90,
  },
  {
    id: 10,
    code: 'ORGANIZATION_MANAGEMENT',
    name: 'Quản lý đơn vị và nhóm',
    routePattern: '/admin/org',
    parentFunctionId: null,
    sortNo: 100,
  },
  {
    id: 11,
    code: 'ROLE_MANAGEMENT',
    name: 'Quản lý vai trò và phân quyền',
    routePattern: '/admin/roles',
    parentFunctionId: null,
    sortNo: 110,
  },
  {
    id: 12,
    code: 'COURSE_ASSIGNMENT',
    name: 'Giao khóa học',
    routePattern: '/admin/assignments',
    parentFunctionId: null,
    sortNo: 120,
  },
  {
    id: 13,
    code: 'REPORTING',
    name: 'Báo cáo đào tạo',
    routePattern: '/reports',
    parentFunctionId: null,
    sortNo: 130,
  },
  {
    id: 14,
    code: 'SYSTEM_AUDIT',
    name: 'Nhật ký hệ thống',
    routePattern: '/admin/system',
    parentFunctionId: null,
    sortNo: 140,
  },
  {
    id: 15,
    code: 'KNOWLEDGE_HUB',
    name: 'Kho tri thức',
    routePattern: '/knowledge',
    parentFunctionId: null,
    sortNo: 150,
  },
  {
    id: 16,
    code: 'ISSUE_HUB',
    name: 'Tra cứu sự cố',
    routePattern: '/issues',
    parentFunctionId: null,
    sortNo: 160,
  },
  {
    id: 17,
    code: 'AI_ASSISTANT',
    name: 'Trợ lý AI',
    routePattern: '/assistant',
    parentFunctionId: null,
    sortNo: 155,
  },
];

export const SEED_ROLES: readonly SeedRole[] = [
  {
    roleId: 1,
    code: 'SUPER_ADMIN',
    name: 'Quản trị viên gốc',
    description:
      'Quản trị toàn hệ thống và cấp/thu hồi ADMIN hoặc SUPER_ADMIN.',
    functionIds: [1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17],
  },
  {
    roleId: 2,
    code: 'ADMIN',
    name: 'Quản trị viên',
    description:
      'Quản trị nghiệp vụ theo GLOBAL/ORG; không cấp quyền quản trị.',
    functionIds: [1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17],
  },
  {
    roleId: 3,
    code: 'LEARNER',
    name: 'Học viên',
    description: 'Học viên với phạm vi OWN.',
    functionIds: [1, 2, 3, 4, 15, 16, 17],
  },
  {
    roleId: 4,
    code: 'INSTRUCTOR',
    name: 'Giảng viên',
    description: 'Giảng viên hoặc cán bộ quản lý nội dung theo scope được cấp.',
    functionIds: [1, 5, 6, 7, 8, 13, 17],
  },
  {
    roleId: 5,
    code: 'REPORT_VIEWER',
    name: 'Người xem báo cáo',
    description: 'Lãnh đạo hoặc người xem báo cáo theo TEAM/ORG/GLOBAL.',
    functionIds: [1, 13, 17],
  },
];

export const SEED_USERS: readonly SeedUser[] = [
  {
    userId: '000001',
    username: 'super.admin',
    fullName: 'Quản trị gốc Demo',
    email: 'root@example.test',
    positionName: 'Quản trị hệ thống',
    orgId: 1,
    teamId: null,
    status: 'active',
    authProvider: 'LOCAL',
    mustChangePassword: false,
  },
  {
    userId: '000002',
    username: 'quantri',
    fullName: 'Quản trị nghiệp vụ Demo',
    email: 'admin@example.test',
    positionName: 'Quản trị viên',
    orgId: 1,
    teamId: null,
    status: 'active',
    authProvider: 'LOCAL',
    mustChangePassword: false,
  },
  {
    userId: '000003',
    username: 'quantri.ban',
    fullName: 'Quản trị Ban Demo',
    email: 'quantri.ban@example.test',
    positionName: 'Quản trị đơn vị',
    orgId: 1,
    teamId: null,
    status: 'active',
    authProvider: 'LOCAL',
    mustChangePassword: false,
  },
  {
    userId: '000004',
    username: 'hocvien',
    fullName: 'Học viên tiền gửi Demo',
    email: 'learner@example.test',
    positionName: 'Chuyên viên nghiệp vụ',
    orgId: 1,
    teamId: 7,
    status: 'active',
    authProvider: 'LOCAL',
    mustChangePassword: false,
  },
  {
    userId: '000005',
    username: 'giangvien',
    fullName: 'Giảng viên Demo',
    email: 'instructor@example.test',
    positionName: 'Chuyên gia',
    orgId: 1,
    teamId: 9,
    status: 'active',
    authProvider: 'LOCAL',
    mustChangePassword: false,
  },
  {
    userId: '000006',
    username: 'baocao',
    fullName: 'Người xem báo cáo Demo',
    email: 'report@example.test',
    positionName: 'Lãnh đạo',
    orgId: 1,
    teamId: 1,
    status: 'active',
    authProvider: 'LOCAL',
    mustChangePassword: false,
  },
  {
    userId: '000007',
    username: 'hocvien.tichhop',
    fullName: 'Học viên tích hợp Demo',
    email: 'other@example.test',
    positionName: 'Chuyên viên kỹ thuật',
    orgId: 1,
    teamId: 11,
    status: 'active',
    authProvider: 'LOCAL',
    mustChangePassword: false,
  },
];

export const SEED_GRANTS: readonly SeedGrant[] = [
  {
    grantId: 1,
    userId: '000001',
    roleId: 1,
    scope: 'GLOBAL',
    orgId: null,
    teamId: null,
    grantedBy: '000001',
    grantedAt: SEED_TIME,
    active: true,
  },
  {
    grantId: 2,
    userId: '000002',
    roleId: 2,
    scope: 'GLOBAL',
    orgId: null,
    teamId: null,
    grantedBy: '000001',
    grantedAt: SEED_TIME,
    active: true,
  },
  {
    grantId: 3,
    userId: '000003',
    roleId: 2,
    scope: 'ORG',
    orgId: 1,
    teamId: null,
    grantedBy: '000001',
    grantedAt: SEED_TIME,
    active: true,
  },
  {
    grantId: 4,
    userId: '000004',
    roleId: 3,
    scope: 'OWN',
    orgId: null,
    teamId: null,
    grantedBy: '000001',
    grantedAt: SEED_TIME,
    active: true,
  },
  {
    grantId: 5,
    userId: '000005',
    roleId: 3,
    scope: 'OWN',
    orgId: null,
    teamId: null,
    grantedBy: '000001',
    grantedAt: SEED_TIME,
    active: true,
  },
  {
    grantId: 6,
    userId: '000007',
    roleId: 3,
    scope: 'OWN',
    orgId: null,
    teamId: null,
    grantedBy: '000001',
    grantedAt: SEED_TIME,
    active: true,
  },
  {
    grantId: 7,
    userId: '000005',
    roleId: 4,
    scope: 'ORG',
    orgId: 1,
    teamId: null,
    grantedBy: '000001',
    grantedAt: SEED_TIME,
    active: true,
  },
  {
    grantId: 8,
    userId: '000006',
    roleId: 5,
    scope: 'TEAM',
    orgId: 1,
    teamId: 1,
    grantedBy: '000001',
    grantedAt: SEED_TIME,
    active: true,
  },
];
