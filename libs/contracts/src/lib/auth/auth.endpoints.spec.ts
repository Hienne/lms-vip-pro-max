import { toUrl } from '../http/endpoint';
import { authEndpoints } from './auth.endpoints';
import {
  DemoAccountSchema,
  LoginCommandSchema,
  LoginResultSchema,
  ProfileSchema,
} from './auth.schema';

describe('auth endpoints', () => {
  it('keeps the mockup function names as keys', () => {
    expect(Object.keys(authEndpoints).sort()).toEqual(
      ['demoAccounts', 'login', 'loginDemo', 'logout', 'profile'].sort(),
    );
  });

  it.each([
    ['login', [401, 422, 423]],
    ['loginDemo', [404, 423]],
    ['logout', []],
    ['profile', [401]],
    ['demoAccounts', []],
  ] as const)('%s declares its error statuses', (key, statuses) => {
    expect(authEndpoints[key].errors).toEqual(statuses);
  });

  it('builds the loginDemo url from the user id', () => {
    expect(toUrl(authEndpoints.loginDemo, { userId: 'a1' })).toBe(
      '/api/auth/demo-accounts/a1/login',
    );
  });

  it('types only the login payload, password rules stay on the server', () => {
    expect(
      LoginCommandSchema.parse({ email: 'x@demo.cb', password: '1' }),
    ).toEqual({ email: 'x@demo.cb', password: '1' });
    expect(() => LoginCommandSchema.parse({ email: 'x' })).toThrow();
  });

  it('rejects unknown roles in the login result', () => {
    expect(() => LoginResultSchema.parse({ id: 'a1', role: 'boss' })).toThrow();
  });

  it('keeps permissions and scope but no display labels in the profile', () => {
    expect(ProfileSchema.shape).not.toHaveProperty('roleLabel');
    expect(ProfileSchema.shape).toHaveProperty('perms');
    expect(ProfileSchema.shape).toHaveProperty('scopeName');
    expect(DemoAccountSchema.shape).not.toHaveProperty('roleLabel');
  });
});
