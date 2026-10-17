import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { envelopeOk } from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';

const PASSWORD_URL = '/api/v1/auth/password';

describe('ChangePassword', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fakeSession().user.set({
      ...seedProfile('000004'),
      mustChangePassword: true,
      homePath: '/change-password',
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/change-password');
    el = harness.routeNativeElement as HTMLElement;
  });
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
    backend.verify();
  });

  async function type(label: string, value: string) {
    const field = Array.from(el.querySelectorAll<HTMLElement>('ui-field'))
      .find((f) => f.textContent?.includes(label))
      ?.querySelector<HTMLInputElement>('input') as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    TestBed.tick();
    await Promise.resolve();
  }

  it('tells a user with a temporary password to set a new one first', () => {
    TestBed.tick();
    expect(el.querySelector('ui-alert')?.textContent).toContain(
      'Bạn đang dùng mật khẩu tạm',
    );
    expect(el.textContent).toContain(seedProfile('000004').fullName);
  });

  it('changes the password, ends the session and asks for a new sign-in', async () => {
    await type('Mật khẩu hiện tại', 'Tam@12345');
    await type('Mật khẩu mới', 'Moi@456');
    await type('Nhập lại mật khẩu mới', 'Moi@456');
    el.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    TestBed.tick();
    await Promise.resolve();
    const put = backend.expectOne(PASSWORD_URL);
    expect(put.request.body).toEqual({
      currentPassword: 'Tam@12345',
      newPassword: 'Moi@456',
    });
    put.flush(envelopeOk(null));
    TestBed.tick();
    expect(fakeSession().expire).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url.startsWith('/login')).toBe(true),
    );
  });

  it('lets the user sign out instead', () => {
    const signOut = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Đăng xuất'),
    );
    signOut?.click();
    expect(fakeSession().signOut).toHaveBeenCalledOnce();
  });
});
