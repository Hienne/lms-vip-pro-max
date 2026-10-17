import { userFixtures } from '../identity/identity.fixtures';
import {
  demoAccountFixtures,
  loginInvalid,
  loginLocked,
  profileFixtures,
} from './auth.fixtures';

describe('auth fixtures', () => {
  it('demo accounts are the six mock roles the dev toolbar offers, from the seed', () => {
    expect(demoAccountFixtures.map((a) => a.id)).toEqual([
      'a1',
      'a2',
      'i1',
      'v1',
      'l1',
      'l4',
    ]);
    for (const account of demoAccountFixtures) {
      expect(userFixtures.find((u) => u.id === account.id)?.email).toBe(
        account.email,
      );
    }
  });

  it.each([
    ['admin', 'a1', 'Toàn hệ thống'],
    ['unit-admin', 'a2', 'Trung tâm Vận hành CNTT (giả lập)'],
    ['instructor', 'i1', 'Ban QL&PT Core Banking'],
    ['viewer', 'v1', 'Toàn hệ thống'],
    ['learner', 'l1', 'Ban QL&PT Core Banking'],
  ])('profile example %s', (name, id, scopeName) => {
    const profile = profileFixtures[name];
    expect(profile).toMatchObject({ id, scopeName });
  });

  it('profiles carry the role name, its menus and a home path', () => {
    expect(profileFixtures['admin']).toMatchObject({
      roleName: 'Quản trị viên',
      homePath: '/admin',
    });
    expect(profileFixtures['admin']?.menus).toContain('admin.roles');
    expect(profileFixtures['learner']?.menus).not.toContain('admin.users');
    expect(profileFixtures['viewer']?.menus).toEqual(['reports']);
  });

  it('keeps the mockup error messages', () => {
    expect(loginInvalid.message).toBe(
      'Vui lòng kiểm tra lại thông tin đăng nhập.',
    );
    expect(loginLocked.message).toBe(
      'Tài khoản đã bị khóa. Liên hệ quản trị viên đơn vị để được hỗ trợ.',
    );
  });
});
