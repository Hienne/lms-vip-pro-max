import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RedirectCommand, type Route } from '@angular/router';
import type { Permission } from '@lms/contracts';
import { SessionStore } from '../session/session.store';
import { permissionGuard } from './permission.guard';

describe('permissionGuard', () => {
  const granted = signal<readonly Permission[]>([]);

  beforeEach(() => {
    granted.set([]);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionStore,
          useValue: { perms$: granted, whenReady: () => Promise.resolve() },
        },
      ],
    });
  });

  const run = (...required: Permission[]) =>
    TestBed.runInInjectionContext(() =>
      permissionGuard(...required)({} as Route, [], {} as never),
    );

  it('lets the route through when every permission was granted', async () => {
    granted.set(['users.manage', 'system.manage']);
    expect(await run('users.manage', 'system.manage')).toBe(true);
  });

  it('sends the user to /403 when one is missing', async () => {
    granted.set(['users.manage']);
    const result = await run('users.manage', 'system.manage');
    expect(result).toBeInstanceOf(RedirectCommand);
    expect((result as RedirectCommand).redirectTo.toString()).toBe(
      TestBed.inject(Router).parseUrl('/403').toString(),
    );
  });
});
