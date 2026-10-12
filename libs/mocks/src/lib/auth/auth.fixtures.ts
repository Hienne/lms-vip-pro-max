import type {
  ApiError,
  DemoAccount,
  LoginResult,
  Profile,
} from '@lms/contracts';
import { userFixtures } from '../identity/identity.fixtures';

// Ported from lms-mockup/src/api/auth.js. Computed values (names, permissions,
// scope) are fixed here, never recomputed.

const BAN = 'Ban QL&PT Core Banking';
const TTVH = 'Trung tâm Vận hành CNTT (giả lập)';
const WHOLE_SYSTEM = 'Toàn hệ thống';

function user(id: string) {
  const found = userFixtures.find((u) => u.id === id);
  if (!found) throw new Error(`No user fixture "${id}"`);
  return found;
}

const INSTRUCTOR_PERMS: Profile['perms'] = [
  'content.write',
  'question.write',
  'feedback.reply',
  'reports.read',
];

export const profileFixtures: Readonly<Record<string, Profile>> = {
  admin: {
    ...user('a1'),
    unitName: BAN,
    groupName: 'Nhóm Tổng hợp & QA',
    perms: [
      ...INSTRUCTOR_PERMS,
      'users.manage',
      'org.manage',
      'assign.manage',
      'system.manage',
    ],
    scopeName: WHOLE_SYSTEM,
  },
  'unit-admin': {
    ...user('a2'),
    unitName: TTVH,
    groupName: 'Phòng Vận hành hạ tầng',
    perms: [
      ...INSTRUCTOR_PERMS,
      'users.manage',
      'org.manage',
      'assign.manage',
      'system.manage',
    ],
    scopeName: TTVH,
  },
  instructor: {
    ...user('i1'),
    unitName: BAN,
    groupName: 'Nhóm Quản trị hệ thống Core Banking',
    perms: INSTRUCTOR_PERMS,
    scopeName: BAN,
  },
  viewer: {
    ...user('v1'),
    unitName: BAN,
    groupName: 'Nhóm Tổng hợp & QA',
    perms: ['reports.read'],
    scopeName: WHOLE_SYSTEM,
  },
  learner: {
    ...user('l1'),
    unitName: BAN,
    groupName: 'Nhóm Quản trị hệ thống Core Banking',
    perms: ['learn'],
    scopeName: BAN,
  },
};

export const demoAccountFixtures: readonly DemoAccount[] = [
  ['a1', BAN],
  ['a2', TTVH],
  ['i1', BAN],
  ['v1', BAN],
  ['l1', BAN],
  ['l4', BAN],
].map(([id, unit]) => {
  const u = user(id as string);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    adminScope: u.adminScope,
    unit: unit as string,
  };
});

export const loginResult: LoginResult = { id: 'l1', role: 'learner' };

export const loginInvalid: ApiError = {
  message: 'Vui lòng kiểm tra lại thông tin đăng nhập.',
  details: {
    email: 'Nhập email đăng nhập.',
    password: 'Mật khẩu tối thiểu 6 ký tự.',
  },
};
export const loginUnauthorized: ApiError = {
  message: 'Email hoặc mật khẩu không đúng.',
};
export const loginLocked: ApiError = {
  message: 'Tài khoản đã bị khóa. Liên hệ quản trị viên đơn vị để được hỗ trợ.',
};
export const loginDemoNotFound: ApiError = {
  message: 'Tài khoản không tồn tại hoặc đã bị xóa.',
};
export const loginDemoLocked: ApiError = {
  message: 'Tài khoản đã bị khóa.',
};
export const profileUnauthorized: ApiError = {
  message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
};
