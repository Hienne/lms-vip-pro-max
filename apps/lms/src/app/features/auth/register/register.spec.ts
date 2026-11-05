import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

const UNITS_URL = '/api/v1/auth/registration-units';
const REGISTER_URL = '/api/v1/auth/register-request';
const MESSAGE = 'Yêu cầu đã được gửi. Quản trị viên sẽ xem xét.';
const UNITS = [{ orgId: 1, name: 'Ban Quản lý và phát triển Core Banking' }];

describe('Register', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let router: Router;
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
    router = TestBed.inject(Router);
  });
  afterEach(() => backend.verify());

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  async function openRegister(units = UNITS): Promise<void> {
    TestBed.inject(SessionStore).restore();
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/register');
    await settle();
    backend.expectOne(UNITS_URL).flush(envelopeOk(units));
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const input = (autocomplete: string, index = 0) =>
    el.querySelectorAll<HTMLInputElement>(
      `input[autocomplete="${autocomplete}"]`,
    )[index];
  const unit = () => el.querySelector<HTMLSelectElement>('select')!;

  async function setValue(
    control: HTMLInputElement | HTMLSelectElement,
    value: string,
  ): Promise<void> {
    control.value = value;
    // A real choice in a select fires both events.
    for (const type of ['input', 'change']) {
      control.dispatchEvent(new Event(type, { bubbles: true }));
    }
    await settle();
  }

  async function fill(overrides: Record<string, string> = {}): Promise<void> {
    const v = {
      code: '000555',
      name: 'Lê Thị Bình',
      email: 'binh@example.test',
      unit: '1',
      password: 'Matkhau@1',
      confirm: 'Matkhau@1',
      ...overrides,
    };
    await setValue(input('username'), v.code);
    await setValue(input('name'), v.name);
    await setValue(input('email'), v.email);
    await setValue(unit(), v.unit);
    await setValue(input('new-password', 0), v.password);
    await setValue(input('new-password', 1), v.confirm);
  }

  async function submit(): Promise<void> {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await settle();
  }

  it('shows the form with the units from the server and a link back to sign-in', async () => {
    await openRegister();
    expect(el.querySelector('h1')?.textContent).toContain('Đăng ký tài khoản');
    expect(unit().textContent).toContain('Ban Quản lý và phát triển');
    expect(el.querySelector('.register__back a')?.textContent).toContain(
      'Đăng nhập',
    );
  });

  it('sends the request with the unit as a number and never the confirmation', async () => {
    await openRegister();
    await fill({ code: ' 000555 ' });
    await submit();
    const call = backend.expectOne(REGISTER_URL);
    expect(call.request.body).toEqual({
      staffCode: '000555',
      fullName: 'Lê Thị Bình',
      email: 'binh@example.test',
      orgId: 1,
      password: 'Matkhau@1',
    });
    call.flush(envelopeOk({ message: MESSAGE }));
    await settle();
    expect(el.querySelector('h1')?.textContent).toContain('Đã gửi yêu cầu');
    expect(el.textContent).toContain(MESSAGE);
    expect(el.querySelector('form')).toBeNull();
    expect(
      el.querySelector<HTMLAnchorElement>('a[href="/login"]'),
    ).not.toBeNull();
  });

  it('keeps the request back and says why while a field is wrong', async () => {
    await openRegister();
    await fill({ code: 'a b', email: 'nope', confirm: 'khac', unit: '' });
    await submit();
    backend.expectNone(REGISTER_URL);
    const text = el.textContent ?? '';
    expect(text).toContain('Mã cán bộ chỉ gồm chữ');
    expect(text).toContain('Email không đúng định dạng.');
    expect(text).toContain('Chọn đơn vị.');
    expect(text).toContain('Mật khẩu nhập lại không khớp.');
  });

  it('refuses a password under 6 characters', async () => {
    await openRegister();
    await fill({ password: '12345', confirm: '12345' });
    await submit();
    backend.expectNone(REGISTER_URL);
    expect(el.textContent).toContain('Mật khẩu tối thiểu 6 ký tự.');
  });

  it('reveals and hides both password fields', async () => {
    await openRegister();
    const toggle = el.querySelector<HTMLButtonElement>('.register__reveal')!;
    expect(input('new-password', 0).type).toBe('password');
    toggle.click();
    await settle();
    expect(input('new-password', 0).type).toBe('text');
    expect(input('new-password', 1).type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the backend message in an alert when the request is throttled', async () => {
    await openRegister();
    await fill();
    await submit();
    const { status, body } = backendRefusal('tooManyRequests');
    backend
      .expectOne(REGISTER_URL)
      .flush(body, { status, statusText: 'Too Many Requests' });
    await settle();
    const alert = el.querySelector('ui-alert[role="alert"]');
    expect(alert?.textContent).toContain('quá nhiều yêu cầu');
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('offers a retry when the units cannot be loaded', async () => {
    TestBed.inject(SessionStore).restore();
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/register');
    await settle();
    backend
      .expectOne(UNITS_URL)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    el = harness.routeNativeElement as HTMLElement;
    expect(el.textContent).toContain('Không tải được danh sách đơn vị');
    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Thử lại'))
      ?.click();
    await settle();
    backend.expectOne(UNITS_URL).flush(envelopeOk(UNITS));
    await settle();
    expect(el.textContent).not.toContain('Không tải được danh sách đơn vị');
  });

  it('is only for visitors: a signed-in user is sent away', async () => {
    expect(router.config.some((r) => r.path === 'register')).toBe(true);
  });
});
