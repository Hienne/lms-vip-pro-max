import { seedMe } from '@lms/mocks';
import { toProfile } from './to-profile';

describe('toProfile', () => {
  it('keeps the staff code as a string with its leading zeros', () => {
    expect(toProfile(seedMe('000004')).userId).toBe('000004');
  });

  it('lists the functions the app has a screen for, in the backend order, as menus', () => {
    const profile = toProfile(seedMe('000002'));
    expect(profile.menus).toEqual(profile.functions.map((fn) => fn.code));
    expect(profile.menus[0]).toBe('PROFILE');
    expect(profile.menus).toContain('USER_MANAGEMENT');
  });

  it('ignores a function code the app has no screen for', () => {
    const me = seedMe('000004');
    const profile = toProfile({
      ...me,
      functions: [...me.functions, 'FUTURE_SCREEN'],
      functionDetails: [
        ...me.functionDetails,
        { id: 99, code: 'FUTURE_SCREEN', name: 'Mới', sortNo: 999 },
      ],
    });
    expect(profile.menus).not.toContain('FUTURE_SCREEN');
  });

  it('homes a learner on the learning screens and an admin on course management', () => {
    expect(toProfile(seedMe('000004')).homePath).toBe('/learn');
    expect(toProfile(seedMe('000002')).homePath).toBe('/admin/courses');
  });

  it('homes a user who only holds the profile on the profile', () => {
    const me = seedMe('000006');
    const profile = toProfile({
      ...me,
      functions: ['PROFILE'],
      functionDetails: me.functionDetails.filter((f) => f.code === 'PROFILE'),
    });
    expect(profile.homePath).toBe('/profile');
  });

  it('homes a user with a temporary password on the password change', () => {
    const me = seedMe('000004');
    const profile = toProfile({
      ...me,
      user: { ...me.user, mustChangePassword: true },
    });
    expect(profile.mustChangePassword).toBe(true);
    expect(profile.homePath).toBe('/change-password');
  });

  it('names the org and team of the user and joins the distinct role names', () => {
    const profile = toProfile(seedMe('000005'));
    expect(profile.org).toMatchObject({ id: 1, code: 'BIDV110B803' });
    expect(profile.roleText).toBe('Học viên, Giảng viên');
  });

  it('takes an empty email as none', () => {
    const me = seedMe('000004');
    expect(
      toProfile({ ...me, user: { ...me.user, email: null } }).email,
    ).toBeNull();
  });
});
