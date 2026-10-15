import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { SessionStore } from '../../../core/session/session.store';

describe('404 page', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        {
          provide: SessionStore,
          useValue: {
            isSignedIn$: () => true,
            menus$: signal([]),
            whenReady: () => Promise.resolve(),
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  const text = () =>
    (harness.routeNativeElement as HTMLElement).textContent?.replace(
      /\s+/g,
      ' ',
    ) ?? '';

  it('shows the missing path, the error code and a way home', async () => {
    await harness.navigateByUrl('/khong/co/trang/nay');
    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toContain(
      'Không tìm thấy trang',
    );
    expect(text()).toContain(
      'Đường dẫn "/khong/co/trang/nay" không tồn tại hoặc đã bị thay đổi.',
    );
    expect(text()).toContain('Mã lỗi 404');
    const home = page.querySelector<HTMLAnchorElement>('a');
    expect(home?.textContent).toContain('Về trang chủ');
    expect(home?.getAttribute('href')).toBe('/');
  });

  it('answers unknown URLs for visitors too, without asking them to sign in', async () => {
    await harness.navigateByUrl('/mot-trang-la');
    expect(text()).toContain('Mã lỗi 404');
  });
});
