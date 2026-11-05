import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { backendRefusal, envelopeOk } from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SessionStore } from '../../../core/session/session.store';

const URL = '/api/v1/auth/password-reset-request';
const MESSAGE = 'Yêu cầu đã được gửi. Quản trị viên sẽ xem xét.';

describe('ForgotPassword', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        SessionStore,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  async function open(): Promise<void> {
    TestBed.inject(SessionStore).restore();
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/forgot-password');
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const code = () =>
    el.querySelector<HTMLInputElement>('input[autocomplete="username"]')!;

  async function enter(value: string): Promise<void> {
    code().value = value;
    code().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function submit(): Promise<void> {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await settle();
  }

  it('shows the form with a link back to sign-in', async () => {
    await open();
    expect(el.querySelector('h1')?.textContent).toContain('Quên mật khẩu');
    expect(el.querySelector('.forgot__back a')?.textContent).toContain(
      'Đăng nhập',
    );
  });

  it('sends the trimmed staff code and shows the answer in place of the form', async () => {
    await open();
    await enter(' 000004 ');
    await submit();
    const call = backend.expectOne(URL);
    expect(call.request.body).toEqual({ staffCode: '000004' });
    call.flush(envelopeOk({ message: MESSAGE }));
    await settle();
    expect(el.querySelector('h1')?.textContent).toContain('Đã gửi yêu cầu');
    expect(el.textContent).toContain(MESSAGE);
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('keeps the request back and says why while the code is wrong', async () => {
    await open();
    await submit();
    expect(el.textContent).toContain('Nhập mã cán bộ.');
    await enter('a b');
    await submit();
    backend.expectNone(URL);
    expect(el.textContent).toContain('Mã cán bộ chỉ gồm chữ');
  });

  it('shows a refusal such as too many requests as an alert and keeps the form', async () => {
    await open();
    await enter('000004');
    await submit();
    const { status, body } = backendRefusal('tooManyRequests');
    backend
      .expectOne(URL)
      .flush(body, { status, statusText: 'Too Many Requests' });
    await settle();
    expect(el.querySelector('ui-alert[role="alert"]')?.textContent).toContain(
      'quá nhiều yêu cầu',
    );
    expect(el.querySelector('form')).not.toBeNull();
  });
});
