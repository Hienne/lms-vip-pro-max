import { seedMe } from '@lms/mocks';
import { toProfile } from './to-profile';

describe('toProfile', () => {
  it('keeps the staff code as a string with its leading zeros', () => {
    expect(toProfile(seedMe('000004')).userId).toBe('000004');
  });

  it('keeps real authoring/reporting available when proposed mock endpoints are disabled', () => {
    const profile = toProfile(
      seedMe('000002'),
      (endpoint) => endpoint.served !== 'mock',
    );
    expect(profile.menus).toEqual(
      expect.arrayContaining(['QUESTION_BANK', 'QUIZ_MANAGEMENT', 'REPORTING']),
    );
  });

  it('does not combine an instructor OWN grant with the GLOBAL scope of a learner for reports', () => {
    const me = seedMe('000005');
    const profile = toProfile({
      ...me,
      roleGrants: [
        {
          roleCode: 'INSTRUCTOR',
          roleName: 'Giảng viên',
          scope: { type: 'OWN' },
        },
        {
          roleCode: 'LEARNER',
          roleName: 'Học viên',
          scope: { type: 'GLOBAL' },
        },
      ],
    });
    expect(profile.menus).not.toContain('REPORTING');
    expect(profile.menus).not.toContain('COURSE_LEARNING');
    expect(profile.menus).toContain('COURSE_MANAGEMENT');
  });

  it('keeps course authoring while excluding shared-bank management from an OWN instructor grant', () => {
    const profile = toProfile({
      ...seedMe('000005'),
      roleGrants: [
        {
          roleCode: 'INSTRUCTOR',
          roleName: 'Giảng viên',
          scope: { type: 'OWN' },
        },
      ],
    });
    expect(profile.menus).toContain('COURSE_MANAGEMENT');
    expect(profile.menus).toContain('QUIZ_MANAGEMENT');
    expect(profile.menus).not.toContain('QUESTION_BANK');
  });

  it('lists the functions the app has a screen for, in the backend order, as menus and as the nav', () => {
    const profile = toProfile(seedMe('000002'));
    expect(
      profile.nav.flatMap((section) => section.items.map((i) => i.code)).sort(),
    ).toEqual([...profile.menus].sort());
    expect(profile.menus[0]).toBe('PROFILE');
    expect(profile.menus).toContain('USER_MANAGEMENT');
  });

  it('leaves a function out of the nav and the menus when its endpoints are not served', () => {
    const me = seedMe('000001');
    expect(toProfile(me).menus).toContain('ROLE_MANAGEMENT');
    const profile = toProfile(me, (endpoint) => endpoint.served !== 'mock');
    expect(profile.menus).not.toContain('ROLE_MANAGEMENT');
    expect(
      profile.nav.flatMap((section) => section.items).map((i) => i.code),
    ).not.toContain('ROLE_MANAGEMENT');
  });

  describe('scopeSummary', () => {
    it('is global for an ADMIN or SUPER_ADMIN at GLOBAL scope', () => {
      expect(toProfile(seedMe('000001')).scopeSummary).toBe('global');
      expect(toProfile(seedMe('000002')).scopeSummary).toBe('global');
    });

    it('is limited for an admin tied to an org and for a learner', () => {
      expect(toProfile(seedMe('000003')).scopeSummary).toBe('limited');
      expect(toProfile(seedMe('000004')).scopeSummary).toBe('limited');
    });

    it('is limited for a non-admin role granted at GLOBAL scope', () => {
      const me = seedMe('000004');
      const profile = toProfile({
        ...me,
        roleGrants: me.roleGrants.map((grant) => ({
          ...grant,
          scope: { ...grant.scope, type: 'GLOBAL' },
        })),
      });
      expect(profile.scopeSummary).toBe('limited');
    });
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
