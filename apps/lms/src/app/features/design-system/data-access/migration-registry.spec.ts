import * as ui from '@lms/ui';
import type { Route } from '@angular/router';
import { createAppRoutes } from '../../../app.routes';
import { SCREEN_ENTRIES } from '../../../core/routing/screens';
import { MIGRATION_ENTRIES } from './migration-entries.data';
import {
  MigrationEntrySchema,
  MigrationRegistrySchema,
  type ComponentEntry,
  type RouteEntry,
} from './migration-entry.schema';
import {
  isComponentEntry,
  isRouteEntry,
  MIGRATION_REGISTRY,
  summarize,
} from './migration-registry';

const NO_CHECKS = {
  lightDark: 'todo',
  widths: 'todo',
  keyboard: 'todo',
  errorStates: 'todo',
} as const;

const entry = {
  id: 'sample',
  kind: 'component',
  mockupSource: '.sample',
  level: 'atom',
  targets: ['Sample'],
  checklist: ['H'],
} as const;

describe('migration entry schema', () => {
  it('accepts a todo entry without owner or checks, defaulting every check to todo', () => {
    const parsed = MigrationEntrySchema.parse({ ...entry, status: 'todo' });
    expect(parsed.verify).toEqual(NO_CHECKS);
  });

  it.each(['in-progress', 'done'] as const)(
    'requires an owner when %s',
    (status) => {
      const verify = {
        lightDark: 'done',
        widths: 'done',
        keyboard: 'done',
        errorStates: 'n/a',
      };
      const result = MigrationEntrySchema.safeParse({
        ...entry,
        status,
        verify,
      });
      expect(result.success).toBe(false);
      expect(
        MigrationEntrySchema.safeParse({
          ...entry,
          status,
          verify,
          owner: 'Hienne',
          pullRequest: 'https://github.com/Hienne/lms-vip-pro-max/pull/1',
        }).success,
      ).toBe(true);
    },
  );

  it('requires every applicable verify check before done', () => {
    const result = MigrationEntrySchema.safeParse({
      ...entry,
      status: 'done',
      owner: 'Hienne',
      pullRequest: 'https://github.com/Hienne/lms-vip-pro-max/pull/1',
      verify: { ...NO_CHECKS, lightDark: 'done' },
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('widths');
  });

  it('requires the pull request link before done, and names the entry', () => {
    const done = {
      ...entry,
      status: 'done',
      owner: 'Hienne',
      verify: {
        ...NO_CHECKS,
        lightDark: 'done',
        widths: 'done',
        keyboard: 'done',
        errorStates: 'n/a',
      },
    };
    const result = MigrationEntrySchema.safeParse(done);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(
      `${entry.id}: a done entry needs the link of the pull request`,
    );
    expect(
      MigrationEntrySchema.safeParse({
        ...done,
        pullRequest: 'https://github.com/Hienne/lms-vip-pro-max/pull/1',
      }).success,
    ).toBe(true);
  });

  it('lets a check that does not apply be n/a', () => {
    expect(
      MigrationEntrySchema.safeParse({
        ...entry,
        status: 'done',
        owner: 'Hienne',
        pullRequest: 'https://github.com/Hienne/lms-vip-pro-max/pull/1',
        verify: {
          lightDark: 'done',
          widths: 'done',
          keyboard: 'n/a',
          errorStates: 'n/a',
        },
      }).success,
    ).toBe(true);
  });

  it.each([
    ['an unknown status', { status: 'blocked' }],
    ['a malformed owner', { status: 'in-progress', owner: 'not a user' }],
    ['a malformed pull request link', { status: 'todo', pullRequest: 'PR 12' }],
    ['a malformed checklist code', { status: 'todo', checklist: ['Z.1'] }],
    ['no targets', { status: 'todo', targets: [] }],
  ])('rejects %s', (_name, patch) => {
    expect(MigrationEntrySchema.safeParse({ ...entry, ...patch }).success).toBe(
      false,
    );
  });

  it('rejects duplicate ids', () => {
    expect(
      MigrationRegistrySchema.safeParse([
        { ...entry, status: 'todo' },
        { ...entry, status: 'todo' },
      ]).success,
    ).toBe(false);
  });
});

describe('migration registry', () => {
  it('parses every entry', () => {
    expect(MIGRATION_REGISTRY).toHaveLength(MIGRATION_ENTRIES.length);
  });

  it('lists every component inventory row and every mockup route', () => {
    const routes = MIGRATION_REGISTRY.filter(isRouteEntry).map((e) => e.target);
    for (const path of [
      'login',
      '',
      'learn',
      'lesson/:courseId/:lessonId',
      'admin/users/:id',
      'reports/:dim',
      'design-system',
      '403',
    ]) {
      expect(routes).toContain(path);
    }
    expect(
      MIGRATION_REGISTRY.filter(isComponentEntry).length,
    ).toBeGreaterThanOrEqual(40);
  });

  it('counts entries per status', () => {
    const summary = summarize(MIGRATION_REGISTRY);
    expect(summary.total).toBe(
      summary.byStatus.todo +
        summary.byStatus['in-progress'] +
        summary.byStatus.done,
    );
  });
});

describe('migration registry vs the code', () => {
  const libExports = Object.keys(ui);
  const libEntries = MIGRATION_REGISTRY.filter(
    (e): e is ComponentEntry =>
      isComponentEntry(e) && ['atom', 'molecule', 'organism'].includes(e.level),
  );
  const libTargets = libEntries.flatMap((e) => e.targets);

  it('has a component entry for every @lms/ui export', () => {
    expect(libExports.filter((name) => !libTargets.includes(name))).toEqual([]);
  });

  it('points no @lms/ui entry that is done at an export that does not exist', () => {
    const missing = libEntries
      .filter((e) => e.status === 'done')
      .flatMap((e) =>
        e.targets
          .filter((name) => !libExports.includes(name))
          .map((name) => `${e.id}: ${name}`),
      );
    expect(missing).toEqual([]);
  });

  it('lists each @lms/ui target in one entry only', () => {
    const duplicates = libTargets.filter(
      (name, i) => libTargets.indexOf(name) !== i,
    );
    expect(duplicates).toEqual([]);
  });

  describe('routes', () => {
    async function childrenOf(
      route: Route,
    ): Promise<readonly Route[] | undefined> {
      if (route.children) return route.children;
      if (!route.loadChildren) return undefined;
      const loaded = await route.loadChildren();
      return Array.isArray(loaded)
        ? loaded
        : (loaded as unknown as { default: Route[] }).default;
    }

    /** Full paths of the leaf routes, following lazy `loadChildren`. */
    async function routePaths(
      routes: readonly Route[],
      prefix = '',
    ): Promise<string[]> {
      const paths: string[] = [];
      for (const route of routes) {
        if (route.path === undefined) continue;
        const path = [prefix, route.path].filter(Boolean).join('/');
        const children = await childrenOf(route);
        paths.push(...(children ? await routePaths(children, path) : [path]));
      }
      return paths;
    }

    it('walks lazy routes down to their leaves', async () => {
      const paths = await routePaths(createAppRoutes({ devTools: true }));
      expect(paths).toEqual(
        expect.arrayContaining(['design-system', 'dev/migration']),
      );
    });

    it('has a loader for every screen of the table whose route entry is done', () => {
      const withoutLoader = MIGRATION_REGISTRY.filter(
        (e): e is RouteEntry => isRouteEntry(e) && e.status === 'done',
      )
        .filter((e) =>
          SCREEN_ENTRIES.some(
            ({ screen }) => screen.path === e.target && !screen.load,
          ),
        )
        .map((e) => e.id);
      expect(withoutLoader).toEqual([]);
    });

    it('has a route entry for every route of the app', async () => {
      const targets = MIGRATION_REGISTRY.filter(isRouteEntry).map(
        (e) => e.target,
      );
      const paths = await routePaths(createAppRoutes({ devTools: true }));
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.filter((path) => !targets.includes(path))).toEqual([]);
    });

    it('points no route entry that is done at a route that does not exist', async () => {
      const paths = await routePaths(createAppRoutes({ devTools: true }));
      const missing = MIGRATION_REGISTRY.filter(
        (e): e is RouteEntry => isRouteEntry(e) && e.status === 'done',
      ).filter((e) => !paths.includes(e.target));
      expect(missing.map((e) => e.id)).toEqual([]);
    });
  });
});
