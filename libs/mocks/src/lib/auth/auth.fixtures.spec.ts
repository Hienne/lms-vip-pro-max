import { authEndpoints } from '@lms/contracts';
import { endpointExamples } from '../examples';
import { userFixtures } from '../identity/identity.fixtures';
import {
  demoAccountFixtures,
  loginDemoNotFound,
  loginInvalid,
  loginLocked,
  profileFixtures,
} from './auth.fixtures';

describe('auth fixtures', () => {
  it('demo accounts are the six the login screen offers, from the seed', () => {
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
    expect(endpointExamples['profile']?.roles?.[name]).toBe(profile);
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

  it('every declared auth error status has a mockup message example', () => {
    for (const [key, endpoint] of Object.entries(authEndpoints)) {
      for (const status of endpoint.errors) {
        expect(
          endpointExamples[key]?.errors?.[status],
          `${key} ${status}`,
        ).toBeDefined();
      }
    }
    expect(loginInvalid.details).toEqual({
      email: 'Nhập email đăng nhập.',
      password: 'Mật khẩu tối thiểu 6 ký tự.',
    });
    expect(loginLocked.message).toBe(
      'Tài khoản đã bị khóa. Liên hệ quản trị viên đơn vị để được hỗ trợ.',
    );
    expect(loginDemoNotFound.message).toBe(
      'Tài khoản không tồn tại hoặc đã bị xóa.',
    );
  });
});
