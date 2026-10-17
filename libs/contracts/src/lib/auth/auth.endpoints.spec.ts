import { authEndpoints } from './auth.endpoints';
import { DemoAccountSchema, ProfileSchema } from './auth.schema';

describe('auth endpoints', () => {
  it('keeps only the mock-only endpoints; the backend ones are authV1Endpoints', () => {
    expect(Object.keys(authEndpoints).sort()).toEqual(
      ['changePassword', 'demoAccounts', 'updateProfile'].sort(),
    );
  });

  it('rejects a menu key the app does not know', () => {
    const profile = ProfileSchema.shape.menus;
    expect(() => profile.parse(['learn.home'])).not.toThrow();
    expect(() => profile.parse(['admin.secret'])).toThrow();
  });

  it('keeps menus, home path and scope in the profile, no per-action permissions', () => {
    expect(ProfileSchema.shape).not.toHaveProperty('perms');
    expect(ProfileSchema.shape).toHaveProperty('menus');
    expect(ProfileSchema.shape).toHaveProperty('homePath');
    expect(ProfileSchema.shape).toHaveProperty('scopeName');
    expect(DemoAccountSchema.shape).not.toHaveProperty('roleLabel');
  });
});
