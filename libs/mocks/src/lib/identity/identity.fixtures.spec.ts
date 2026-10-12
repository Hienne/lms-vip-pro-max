import { GroupSchema, UnitSchema, UserSchema } from '@lms/contracts';
import { groupFixtures, unitFixtures, userFixtures } from './identity.fixtures';

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
      if (u.adminScope !== null) expect(unitIds).toContain(u.adminScope);
    }
  });

  // README demo accounts (lms-mockup/README.md)
  it.each([
    ['admin@demo.cb', 'a1', 'admin', 'active', null],
    ['qtdonvi@demo.cb', 'a2', 'admin', 'active', 'u2'],
    ['giangvien@demo.cb', 'i1', 'instructor', 'active', null],
    ['lanhdao@demo.cb', 'v1', 'viewer', 'active', null],
    ['hocvien@demo.cb', 'l1', 'learner', 'active', null],
    ['dung.bq@demo.cb', 'l4', 'learner', 'active', null],
    ['long.pd@demo.cb', 'l8', 'learner', 'locked', null],
  ])('demo account %s exists', (email, id, role, status, adminScope) => {
    expect(userFixtures.find((u) => u.email === email)).toMatchObject({
      id,
      role,
      status,
      adminScope,
    });
  });

  it('has a never-logged-in user', () => {
    expect(userFixtures.find((u) => u.id === 'l3')?.lastLoginAt).toBeNull();
  });
});
