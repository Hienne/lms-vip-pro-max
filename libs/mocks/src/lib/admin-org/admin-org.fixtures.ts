import type {
  AdminMeta,
  ApiError,
  AuditEntry,
  OrgUnit,
  ResetPasswordResult,
  UserDetail,
  UserListItem,
} from '@lms/contracts';
import {
  groupFixtures,
  roleFixtures,
  unitFixtures,
  userFixtures,
} from '../identity/identity.fixtures';

// Ported from the users part of lms-mockup/src/api/admin.js and the seed. Names and the scope cut
// are results of the server's computation, fixed here and never recomputed.

function name<T extends { id: string; name: string }>(
  list: readonly T[],
  id: string,
): string {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`No fixture "${id}"`);
  return found.name;
}

export const userListFixtures: readonly UserListItem[] = userFixtures.map(
  (u) => ({
    ...u,
    roleName: name(roleFixtures, u.roleId),
    unitName: name(unitFixtures, u.unitId),
    groupName: name(groupFixtures, u.groupId),
  }),
);

/** The `unit-admin` example: only the users of its unit. */
export const unitAdminUserList: readonly UserListItem[] =
  userListFixtures.filter((u) => u.unitId === 'u2');

function listItem(id: string): UserListItem {
  const found = userListFixtures.find((u) => u.id === id);
  if (!found) throw new Error(`No user fixture "${id}"`);
  return found;
}

const audit: AuditEntry[] = [
  {
    id: 'au7',
    at: '2026-01-15T09:00:00.000Z',
    userId: 'l1',
    action: 'login',
    target: 'Phiên đăng nhập',
    detail: 'Đăng nhập thành công',
  },
];

/** Prism is stateless, so every user page answers with this one: the seed's demo learner `l1`. */
export const userDetailFixture: UserDetail = {
  user: listItem('l1'),
  role: roleFixtures.find((r) => r.id === 'learner') ?? roleFixtures[0],
  courses: [
    {
      id: 'c4',
      code: 'HN-101',
      title: 'Văn hóa doanh nghiệp & quy chế nội bộ',
      required: true,
      pct: 100,
      status: 'completed',
      overdue: false,
      dueAt: '2026-01-13T17:00:00.000Z',
      lastAccessAt: '2026-01-08T14:00:00.000Z',
      quiz: null,
    },
    {
      id: 'c1',
      code: 'NV-101',
      title: 'Tổng quan hệ thống Core Banking',
      required: true,
      pct: 62,
      status: 'failed',
      overdue: false,
      dueAt: '2026-01-27T17:00:00.000Z',
      lastAccessAt: '2026-01-14T14:00:00.000Z',
      quiz: { best: 60, attempts: 2, maxAttempts: 3 },
    },
    {
      id: 'c2',
      code: 'VH-201',
      title: 'Quy trình quản lý thay đổi (Change Management)',
      required: true,
      pct: 0,
      status: 'not_started',
      overdue: false,
      dueAt: '2026-02-02T17:00:00.000Z',
      lastAccessAt: null,
      quiz: null,
    },
  ],
  attempts: [
    {
      id: 'at2',
      title: 'Kiểm tra cuối khóa: Tổng quan Core Banking',
      score: 60,
      passed: false,
      at: '2026-01-14T14:12:00.000Z',
    },
    {
      id: 'at1',
      title: 'Kiểm tra cuối khóa: Tổng quan Core Banking',
      score: 50,
      passed: false,
      at: '2026-01-12T14:12:00.000Z',
    },
  ],
  audit,
};

const [BAN, TTVH] = unitFixtures;

function scopeTo(unitId: string): Pick<AdminMeta, 'units' | 'groups'> {
  return {
    units: unitFixtures.filter((u) => u.id === unitId),
    groups: groupFixtures.filter((g) => g.unitId === unitId),
  };
}

const copy = <T>(list: readonly T[]): T[] => [...list];

/** The whole-system admin: every unit and group, and every role it may assign. */
export const adminMetaFixture: AdminMeta = {
  units: [BAN, TTVH],
  allUnits: copy(unitFixtures),
  groups: copy(groupFixtures),
  roles: copy(roleFixtures),
};

/** A unit-scoped admin: its unit only, and no role that can manage roles (admin). */
export const unitAdminMetaFixture: AdminMeta = {
  ...scopeTo('u2'),
  allUnits: copy(unitFixtures),
  roles: roleFixtures.filter((r) => !r.menus.includes('admin.roles')),
};

export const resetPasswordResult: ResetPasswordResult = {
  sentTo: 'hocvien@demo.cb',
};

export const saveUserInvalid: ApiError = {
  message: 'Vui lòng kiểm tra lại thông tin.',
  details: { email: 'Email đã được dùng cho tài khoản khác.' },
};
export const saveUserForbidden: ApiError = {
  message: 'Bạn không có quyền tạo/sửa người dùng ngoài đơn vị bạn quản lý.',
};
export const setUserStatusInvalid: ApiError = {
  message: 'Không thể tự khóa tài khoản của chính mình.',
};
export const userNotFound: ApiError = { message: 'Người dùng không tồn tại.' };
export const userForbidden: ApiError = {
  message: 'Bạn không có quyền xem người dùng thuộc đơn vị khác.',
};

/** Administrators of a unit: those limited to it, and whole-system ones placed in it. */
function adminsOf(unitId: string): OrgUnit['admins'] {
  return userFixtures
    .filter(
      (u) =>
        u.roleId === 'admin' &&
        (u.scopeUnitId === unitId ||
          (u.scopeUnitId === null && u.unitId === unitId)),
    )
    .map((u) => ({
      id: u.id,
      name: u.name,
      scope: u.scopeUnitId ? 'unit' : 'system',
    }));
}

function orgUnit(unitId: string, shared: OrgUnit['sharedCourses']): OrgUnit {
  const unit = unitFixtures.find((u) => u.id === unitId);
  if (!unit) throw new Error(`No fixture "${unitId}"`);
  return {
    ...unit,
    admins: adminsOf(unitId),
    members: userFixtures.filter((u) => u.unitId === unitId).length,
    groups: groupFixtures
      .filter((g) => g.unitId === unitId)
      .map((g) => ({
        ...g,
        members: userFixtures
          .filter((u) => u.groupId === g.id)
          .map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            roleId: u.roleId,
            roleName: name(roleFixtures, u.roleId),
            scopeUnitId: u.scopeUnitId,
          })),
      })),
    sharedCourses: shared,
  };
}

const sharedWithTtvh = [
  { id: 'c4', title: 'Văn hóa doanh nghiệp & quy chế nội bộ' },
];

/** The whole-system admin sees every unit. */
export const orgFixtures: readonly OrgUnit[] = [
  orgUnit('u1', []),
  orgUnit('u2', sharedWithTtvh),
];

/** The `unit-admin` example: its own unit only. */
export const unitAdminOrg: readonly OrgUnit[] = orgFixtures.filter(
  (u) => u.id === 'u2',
);

export const saveUnitInvalid: ApiError = {
  message: 'Vui lòng kiểm tra lại thông tin.',
  details: { code: 'Mã đơn vị đã tồn tại.' },
};
export const saveUnitForbidden: ApiError = {
  message: 'Bạn không có quyền tạo đơn vị mới (chỉ quản trị toàn hệ thống).',
};
export const unitNotFound: ApiError = { message: 'Đơn vị không tồn tại.' };
export const saveGroupInvalid: ApiError = {
  message: 'Vui lòng kiểm tra lại thông tin.',
  details: { name: 'Nhập tên phòng/nhóm.' },
};
export const deleteGroupInvalid: ApiError = {
  message: 'Nhóm còn thành viên — hãy chuyển thành viên sang nhóm khác trước.',
};
export const groupNotFound: ApiError = { message: 'Nhóm không tồn tại.' };

export const saveRoleInvalid: ApiError = {
  message: 'Vui lòng kiểm tra lại thông tin.',
  details: { name: 'Tên vai trò đã tồn tại.' },
};
export const saveRoleLocked: ApiError = {
  message: 'Vai trò hệ thống này bị khóa, không thể sửa.',
};
export const deleteRoleForbidden: ApiError = {
  message: 'Không thể xóa vai trò hệ thống.',
};
export const deleteRoleInvalid: ApiError = {
  message:
    'Vai trò đang được gán cho người dùng — hãy chuyển họ sang vai trò khác trước.',
};
export const roleNotFound: ApiError = { message: 'Vai trò không tồn tại.' };
