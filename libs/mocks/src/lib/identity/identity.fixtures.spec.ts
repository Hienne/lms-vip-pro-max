import {
  GroupSchema,
  RoleSchema,
  UnitSchema,
  UserSchema,
} from '@lms/contracts';
import {
  groupFixtures,
  roleFixtures,
  unitFixtures,
  userFixtures,
} from './identity.fixtures';

describe('identity fixtures', () => {
  it.each(unitFixtures)('unit $id parses', (unit) => {
    expect(() => UnitSchema.parse(unit)).not.toThrow();
  });

  it.each(groupFixtures)('group $id parses', (group) => {
    expect(() => GroupSchema.parse(group)).not.toThrow();
  });

  it.each(userFixtures)('user $id parses', (user) => {
    expect(() => UserSchema.parse(user)).not.toThrow();
  });

  it.each(roleFixtures)('role $id parses', (role) => {
    expect(() => RoleSchema.parse(role)).not.toThrow();
  });

  it('seeds the four system roles and one custom role', () => {
    expect(roleFixtures.filter((r) => r.system).map((r) => r.id)).toEqual([
      'learner',
      'instructor',
      'admin',
      'viewer',
    ]);
    expect(roleFixtures.filter((r) => !r.system)).toHaveLength(1);
  });

  it('counts the users of each role', () => {
    for (const role of roleFixtures) {
      expect(role.userCount).toBe(
        userFixtures.filter((u) => u.roleId === role.id).length,
      );
    }
  });

  it('keeps the menu-managing role on admin', () => {
    expect(roleFixtures.find((r) => r.id === 'admin')?.menus).toContain(
      'admin.roles',
    );
  });

  it('holds the seed counts', () => {
    expect(unitFixtures).toHaveLength(2);
    expect(groupFixtures).toHaveLength(4);
    expect(userFixtures).toHaveLength(12);
  });

  it('references only existing units and groups', () => {
    const unitIds = unitFixtures.map((u) => u.id);
    const groupIds = groupFixtures.map((g) => g.id);
    for (const g of groupFixtures) expect(unitIds).toContain(g.unitId);
    for (const u of userFixtures) {
      expect(unitIds).toContain(u.unitId);
      expect(groupIds).toContain(u.groupId);
      expect(roleFixtures.map((r) => r.id)).toContain(u.roleId);
      if (u.scopeUnitId !== null) expect(unitIds).toContain(u.scopeUnitId);
    }
  });

  // README demo accounts (lms-mockup/README.md)
  it.each([
    ['admin@demo.cb', 'a1', 'admin', 'active', null],
    ['qtdonvi@demo.cb', 'a2', 'admin', 'active', 'u2'],
    ['giangvien@demo.cb', 'i1', 'instructor', 'active', 'u1'],
    ['lanhdao@demo.cb', 'v1', 'viewer', 'active', null],
    ['hocvien@demo.cb', 'l1', 'learner', 'active', 'u1'],
    ['dung.bq@demo.cb', 'l4', 'learner', 'active', 'u1'],
    ['long.pd@demo.cb', 'l8', 'learner', 'locked', 'u1'],
  ])('demo account %s exists', (email, id, roleId, status, scopeUnitId) => {
    expect(userFixtures.find((u) => u.email === email)).toMatchObject({
      id,
      roleId,
      status,
      scopeUnitId,
    });
  });

  it('has a never-logged-in user', () => {
    expect(userFixtures.find((u) => u.id === 'l3')?.lastLoginAt).toBeNull();
  });
});
