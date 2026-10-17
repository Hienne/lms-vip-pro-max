import type { DemoAccount, Profile } from '@lms/contracts';
import { refusal } from '../error-envelopes';
import { roleFixtures, userFixtures } from '../identity/identity.fixtures';

// Ported from lms-mockup/src/api/auth.js. Computed values (names, menus, home path,
// scope) are fixed here, never recomputed.

const BAN = 'Ban QL&PT Core Banking';
const TTVH = 'Trung tâm Vận hành CNTT (giả lập)';
const WHOLE_SYSTEM = 'Toàn hệ thống';

function user(id: string) {
  const found = userFixtures.find((u) => u.id === id);
  if (!found) throw new Error(`No user fixture "${id}"`);
  return found;
}

function role(id: string) {
  const found = roleFixtures.find((r) => r.id === id);
  if (!found) throw new Error(`No role fixture "${id}"`);
  return found;
}

/** The home path the server computes: the first granted menu's screen, else the profile. */
const HOME_PATH: Readonly<Record<string, string>> = {
  learner: '/learn',
  instructor: '/instructor',
  admin: '/admin',
  viewer: '/reports',
};

function profile(
  userId: string,
  unitName: string,
  groupName: string,
  scopeName: string,
): Profile {
  const u = user(userId);
  const r = role(u.roleId);
  return {
    ...u,
    roleName: r.name,
    unitName,
    groupName,
    menus: r.menus,
    homePath: HOME_PATH[r.id] ?? '/profile',
    scopeName,
  };
}

export const profileFixtures: Readonly<Record<string, Profile>> = {
  admin: profile('a1', BAN, 'Nhóm Tổng hợp & QA', WHOLE_SYSTEM),
  'unit-admin': profile('a2', TTVH, 'Phòng Vận hành hạ tầng', TTVH),
  instructor: profile('i1', BAN, 'Nhóm Quản trị hệ thống Core Banking', BAN),
  viewer: profile('v1', BAN, 'Nhóm Tổng hợp & QA', WHOLE_SYSTEM),
  learner: profile('l1', BAN, 'Nhóm Quản trị hệ thống Core Banking', BAN),
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
    roleId: u.roleId,
    roleName: role(u.roleId).name,
    scopeUnitId: u.scopeUnitId,
    unit: unit as string,
  };
});

export const loginInvalid = refusal(
  'Thông tin đăng nhập chưa hợp lệ',
  'Vui lòng kiểm tra lại thông tin đăng nhập.',
);
export const loginUnauthorized = refusal(
  'Không đăng nhập được',
  'Email hoặc mật khẩu không đúng.',
);
export const loginLocked = refusal(
  'Tài khoản bị khóa',
  'Tài khoản đã bị khóa. Liên hệ quản trị viên đơn vị để được hỗ trợ.',
);

export const updateProfileInvalid = refusal(
  'Không lưu được hồ sơ',
  'Họ tên tối thiểu 2 ký tự.',
);
export const changePasswordInvalid = refusal(
  'Không đổi được mật khẩu',
  'Tối thiểu 8 ký tự, gồm chữ hoa và chữ số.',
);
