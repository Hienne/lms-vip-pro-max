import type { AuditEntry, Role, UserAttempt, UserCourse } from '@lms/contracts';
import { refusal } from '../error-envelopes';
import { SEED_FUNCTIONS, SEED_GRANTS, SEED_ROLES } from '../backend/seed';

// The mock-only admin data: the role editor and the courses, attempts and activity tabs of a user.
// Ported from lms-mockup/src/api/admin.js and re-keyed to the backend seed: the roles are the
// backend's five, whose screens are its `role_functions`, plus one custom role to edit.

const codeOf = (functionId: number): string => {
  const found = SEED_FUNCTIONS.find((f) => f.id === functionId);
  if (!found) throw new Error(`No seed function ${functionId}`);
  return found.code;
};

/** The mock server refuses to edit the administrator roles. */
const LOCKED_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export const roleFixtures: readonly Role[] = [
  ...SEED_ROLES.map((role) => ({
    id: role.code.toLowerCase(),
    name: role.name,
    description: role.description,
    system: true,
    menus: role.functionIds.map(codeOf) as Role['menus'],
    locked: LOCKED_ROLES.includes(role.code),
    userCount: new Set(
      SEED_GRANTS.filter((g) => g.roleId === role.roleId).map((g) => g.userId),
    ).size,
  })),
  {
    id: 'content-lead',
    name: 'Chuyên viên nội dung',
    description: 'Quản lý khóa học và câu hỏi, xem báo cáo.',
    system: false,
    menus: ['PROFILE', 'COURSE_MANAGEMENT', 'QUESTION_BANK', 'REPORTING'],
    locked: false,
    userCount: 0,
  },
];

export const userCourseFixtures: readonly UserCourse[] = [
  {
    id: 'c4',
    code: 'HN-101',
    title: 'Văn hóa doanh nghiệp & quy chế nội bộ',
    required: true,
    pct: 100,
    status: 'completed',
    overdue: false,
    dueAt: '2026-10-13T17:00:00.000Z',
    lastAccessAt: '2026-10-08T14:00:00.000Z',
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
    dueAt: '2026-10-27T17:00:00.000Z',
    lastAccessAt: '2026-10-14T14:00:00.000Z',
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
    dueAt: '2026-11-02T17:00:00.000Z',
    lastAccessAt: null,
    quiz: null,
  },
];

export const userAttemptFixtures: readonly UserAttempt[] = [
  {
    id: 'at2',
    title: 'Kiểm tra cuối khóa: Tổng quan Core Banking',
    score: 60,
    passed: false,
    at: '2026-10-14T14:12:00.000Z',
  },
  {
    id: 'at1',
    title: 'Kiểm tra cuối khóa: Tổng quan Core Banking',
    score: 50,
    passed: false,
    at: '2026-10-12T14:12:00.000Z',
  },
];

export const userAuditFixtures: readonly AuditEntry[] = [
  {
    id: 'au7',
    at: '2026-10-15T09:00:00.000Z',
    userId: '000004',
    action: 'login',
    target: 'Phiên đăng nhập',
    detail: 'Đăng nhập thành công',
  },
];

export const saveRoleRejected = refusal(
  'Không lưu được vai trò',
  'Tên vai trò đã tồn tại.',
);
export const systemRoleLocked = refusal(
  'Vai trò bị khóa',
  'Vai trò hệ thống này bị khóa, không thể sửa.',
);
export const deleteRoleNotPermitted = refusal(
  'Không xóa được vai trò',
  'Không thể xóa vai trò hệ thống.',
);
export const deleteRoleRejected = refusal(
  'Không xóa được vai trò',
  'Vai trò đang được gán cho người dùng — hãy chuyển họ sang vai trò khác trước.',
);
export const roleMissing = refusal(
  'Không tìm thấy vai trò',
  'Vai trò không tồn tại.',
);
