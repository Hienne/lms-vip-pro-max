import {
  adminOrgEndpoints,
  FunctionCodeSchema,
  type FunctionInfo,
} from '@lms/contracts';
import { SEED_FUNCTIONS } from '@lms/mocks';
import { seedProfile } from '../session/session.testing';
import {
  activeHref,
  allSections,
  entryHref,
  homePathFor,
  knownFunctions,
  menuLabel,
  navFor,
} from './menu-catalog';

const fn = (id: number, code: string, sortNo: number): FunctionInfo => ({
  id,
  code,
  name: `Tên ${code}`,
  sortNo,
});

/** The nav of functions as `/me` lists them, the way `toProfile` builds it. */
const navOf = (functions: readonly FunctionInfo[]) =>
  navFor(knownFunctions(functions));

describe('menu catalog', () => {
  it('has one entry screen and one section for every function code the backend knows', () => {
    const items = allSections().flatMap((section) => section.items);
    expect(items.map((item) => item.code).sort()).toEqual(
      [...FunctionCodeSchema.options].sort(),
    );
    for (const item of items) expect(item.href).toBe(entryHref(item.code));
  });

  it('builds the sidebar from the functions of /me, named by the backend and in its order', () => {
    const functions = [
      fn(3, 'LEARNING_PROGRESS', 30),
      fn(1, 'PROFILE', 10),
      fn(2, 'COURSE_LEARNING', 20),
    ];
    const items = navOf(functions).flatMap((section) => section.items);
    expect(items.map((item) => [item.code, item.label])).toEqual([
      ['PROFILE', 'Tên PROFILE'],
      ['COURSE_LEARNING', 'Tên COURSE_LEARNING'],
      ['LEARNING_PROGRESS', 'Tên LEARNING_PROGRESS'],
    ]);
  });

  it('breaks a sortNo tie by id', () => {
    const items = navOf([
      fn(9, 'REPORTING', 5),
      fn(4, 'USER_MANAGEMENT', 5),
    ]).flatMap((section) => section.items);
    expect(items.map((item) => item.code)).toEqual([
      'USER_MANAGEMENT',
      'REPORTING',
    ]);
  });

  it('skips a function code the app has no screen for', () => {
    const items = navOf([fn(1, 'PROFILE', 1), fn(2, 'FUTURE_SCREEN', 2)])
      .flatMap((section) => section.items)
      .map((item) => item.code);
    expect(items).toEqual(['PROFILE']);
  });

  it('shows a learner the learner screens and an admin the management ones', () => {
    const codes = (userId: string) =>
      seedProfile(userId)
        .nav.flatMap((section) => section.items)
        .map((item) => item.code);
    expect(codes('000004')).toContain('COURSE_LEARNING');
    expect(codes('000004')).not.toContain('USER_MANAGEMENT');
    expect(codes('000002')).toContain('USER_MANAGEMENT');
    expect(codes('000001')).toEqual(
      expect.arrayContaining(['ROLE_MANAGEMENT', 'ORGANIZATION_MANAGEMENT']),
    );
  });

  describe('knownFunctions', () => {
    const functions = [fn(1, 'PROFILE', 1), fn(2, 'ROLE_MANAGEMENT', 2)];

    it('keeps every known function when the build serves all endpoints', () => {
      expect(knownFunctions(functions).map((f) => f.code)).toEqual([
        'PROFILE',
        'ROLE_MANAGEMENT',
      ]);
    });

    it('leaves out a function whose screens need an endpoint the build does not serve', () => {
      const withoutMock = (endpoint: { served?: string }) =>
        endpoint.served !== 'mock';
      expect(knownFunctions(functions, withoutMock).map((f) => f.code)).toEqual(
        ['PROFILE'],
      );
      expect(adminOrgEndpoints.roles.served).toBe('mock');
    });
  });

  describe('upcoming', () => {
    const UPCOMING = ['LESSON_MANAGEMENT', 'KNOWLEDGE_HUB', 'ISSUE_HUB'];

    it('marks exactly the functions whose entry screen is not built', () => {
      const items = allSections().flatMap((s) => s.items);
      expect(
        items
          .filter((i) => i.upcoming)
          .map((i) => i.code)
          .sort(),
      ).toEqual([...UPCOMING].sort());
    });

    it('carries the flag on the sidebar of a user', () => {
      const nav = navOf([
        fn(1, 'COURSE_LEARNING', 1),
        fn(2, 'KNOWLEDGE_HUB', 2),
      ]);
      const byCode = Object.fromEntries(
        nav.flatMap((s) => s.items).map((i) => [i.code, i.upcoming]),
      );
      expect(byCode).toEqual({ COURSE_LEARNING: false, KNOWLEDGE_HUB: true });
    });
  });

  describe('homePathFor', () => {
    it('skips a function whose entry screen is not built', () => {
      expect(
        homePathFor(
          knownFunctions([
            fn(1, 'PROFILE', 1),
            fn(2, 'KNOWLEDGE_HUB', 2),
            fn(3, 'REPORTING', 3),
          ]),
        ),
      ).toBe(entryHref('REPORTING'));
      expect(homePathFor(knownFunctions([fn(1, 'KNOWLEDGE_HUB', 1)]))).toBe(
        '/profile',
      );
    });

    it('is the entry screen of the first function after the profile', () => {
      expect(homePathFor(knownFunctions(SEED_FUNCTIONS))).toBe(
        entryHref('COURSE_LEARNING'),
      );
    });

    it('is the profile when the user holds nothing else', () => {
      expect(homePathFor(knownFunctions([fn(1, 'PROFILE', 1)]))).toBe(
        '/profile',
      );
      expect(homePathFor([])).toBe('/profile');
    });

    it('ignores a function the app has no screen for', () => {
      expect(
        homePathFor(
          knownFunctions([fn(1, 'FUTURE_SCREEN', 1), fn(2, 'REPORTING', 2)]),
        ),
      ).toBe(entryHref('REPORTING'));
    });
  });

  it('labels a code for the 403 page with the title of its first screen', () => {
    expect(menuLabel('USER_MANAGEMENT')).toBe('Người dùng');
  });

  describe('activeHref', () => {
    const functions = [
      fn(1, 'COURSE_LEARNING', 1),
      fn(2, 'COURSE_MANAGEMENT', 2),
    ];

    it('marks the longest entry that equals the path or is its parent', () => {
      const manage = entryHref('COURSE_MANAGEMENT');
      expect(activeHref(navOf(functions), `${manage}/new`)).toBe(manage);
      expect(activeHref(navOf(functions), manage)).toBe(manage);
    });

    it('marks nothing for a path outside the menu', () => {
      expect(activeHref(navOf(functions), '/profile')).toBeNull();
    });
  });
});
