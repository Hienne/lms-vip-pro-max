import { authV1Endpoints } from './auth-v1.endpoints';
import {
  ChangePasswordV1CommandSchema,
  MeSchema,
  passwordByteLength,
  UpdateMeCommandSchema,
} from './auth-v1.schema';

describe('auth v1 endpoints', () => {
  it('declare the backend paths and methods', () => {
    expect(
      Object.entries(authV1Endpoints).map(([key, e]) => [
        key,
        e.method,
        e.path,
      ]),
    ).toEqual([
      ['login', 'post', '/api/v1/auth/login'],
      ['logout', 'post', '/api/v1/auth/logout'],
      ['me', 'get', '/api/v1/auth/me'],
      ['updateMe', 'patch', '/api/v1/auth/me'],
      ['changePassword', 'put', '/api/v1/auth/password'],
    ]);
  });

  it('login takes a username and a password', () => {
    expect(
      authV1Endpoints.login.body.parse({ username: '000123', password: 'x' }),
    ).toEqual({
      username: '000123',
      password: 'x',
    });
    expect(() =>
      authV1Endpoints.login.body.parse({ email: 'x', password: 'x' }),
    ).toThrow();
  });

  it('updateMe takes changed fields only, and null clears email and position', () => {
    expect(UpdateMeCommandSchema.parse({})).toEqual({});
    expect(
      UpdateMeCommandSchema.parse({ email: null, positionName: null }),
    ).toEqual({ email: null, positionName: null });
    expect(() => UpdateMeCommandSchema.parse({ fullName: null })).toThrow();
  });

  it('changePassword names the current and the new password', () => {
    expect(
      ChangePasswordV1CommandSchema.parse({
        currentPassword: 'a',
        newPassword: 'b',
      }),
    ).toEqual({ currentPassword: 'a', newPassword: 'b' });
  });

  it('counts a password in UTF-8 bytes, as bcrypt does', () => {
    expect(passwordByteLength('abc')).toBe(3);
    expect(passwordByteLength('mật khẩu')).toBeGreaterThan('mật khẩu'.length);
  });

  it('requires mustChangePassword on the user of /me', () => {
    const me = {
      user: {
        userId: '000001',
        username: 'super.admin',
        fullName: 'Quản trị gốc Demo',
        status: 'active',
        authProvider: 'LOCAL',
      },
      roles: [],
      functions: [],
      roleGrants: [],
      functionDetails: [],
      functionScopes: {},
    };
    expect(() => MeSchema.parse(me)).toThrow();
    expect(() =>
      MeSchema.parse({
        ...me,
        user: { ...me.user, mustChangePassword: false },
      }),
    ).not.toThrow();
  });
});
