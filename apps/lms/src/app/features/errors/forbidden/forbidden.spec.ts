import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { MenuKey } from '@lms/contracts';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { SessionStore } from '../../../core/session/session.store';

describe('403 page', () => {
  const menus = signal<readonly MenuKey[]>(['learn.home']);
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    menus.set(['learn.home']);
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        {
          provide: SessionStore,
          useValue: {
            menus$: menus,
            isSignedIn$: () => true,
            whenReady: () => Promise.resolve(),
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  const page = () => harness.routeNativeElement as HTMLElement;
  const text = () => page().textContent?.replace(/\s+/g, ' ') ?? '';

  it('names the page and the menu that grants it after a visit without the menu', async () => {
    await harness.navigateByUrl('/admin/users');
    expect(TestBed.inject(Router).url).toBe('/403');
    expect(page().querySelector('h1')?.textContent).toContain(
      'Bạn không có quyền truy cập trang này',
    );
    expect(text()).toContain(
      'Trang "/admin/users" thuộc menu "Người dùng", vai trò của bạn chưa được cấp. Nếu cần quyền, hãy liên hệ quản trị viên đơn vị.',
    );
    expect(text()).toContain('Mã lỗi 403');
  });

  it('names the menu of a sub-route', async () => {
    await harness.navigateByUrl('/admin/courses/new');
    expect(text()).toContain('thuộc menu "Khóa học"');
  });

  it('falls back to the generic reason without navigation state', async () => {
    await harness.navigateByUrl('/403');
    expect(text()).toContain(
      'Vai trò của bạn không có quyền vào chức năng này. Nếu cần quyền',
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
