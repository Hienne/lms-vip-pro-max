import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Role } from '@lms/contracts';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { SessionStore } from '../../../core/session/session.store';

describe('403 page', () => {
  const role = signal<Role | null>('learner');
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    role.set('learner');
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        {
          provide: SessionStore,
          useValue: {
            role$: role,
            isSignedIn$: () => role() !== null,
            perms$: signal([]),
            whenReady: () => Promise.resolve(),
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  const page = () => harness.routeNativeElement as HTMLElement;
  const text = () => page().textContent?.replace(/\s+/g, ' ') ?? '';

  it('names the page and the roles that may enter after a wrong-role visit', async () => {
    await harness.navigateByUrl('/admin/users');
    expect(TestBed.inject(Router).url).toBe('/403');
    expect(page().querySelector('h1')?.textContent).toContain(
      'Bạn không có quyền truy cập trang này',
    );
    expect(text()).toContain(
      'Trang "/admin/users" dành cho vai trò: Quản trị viên. Nếu cần quyền, hãy liên hệ quản trị viên đơn vị.',
    );
    expect(text()).toContain('Mã lỗi 403');
  });

  it('lists every allowed role in the mockup order', async () => {
    await harness.navigateByUrl('/admin/courses');
    expect(text()).toContain('dành cho vai trò: Quản trị viên, Giảng viên.');
  });

  it('falls back to the generic reason without navigation state', async () => {
    await harness.navigateByUrl('/403');
    expect(text()).toContain(
      'Chức năng này không thuộc vai trò của bạn. Nếu cần quyền',
    );
  });

  it('offers a way home and a way back', async () => {
    await harness.navigateByUrl('/403');
    const home = page().querySelector<HTMLAnchorElement>('a');
    expect(home?.textContent).toContain('Về trang chủ của tôi');
    expect(home?.getAttribute('href')).toBe('/');

    const back = vi.spyOn(TestBed.inject(Location), 'back');
    const button = page().querySelector<HTMLButtonElement>('button');
    expect(button?.textContent).toContain('Quay lại');
    button?.click();
    expect(back).toHaveBeenCalledTimes(1);
  });
});
