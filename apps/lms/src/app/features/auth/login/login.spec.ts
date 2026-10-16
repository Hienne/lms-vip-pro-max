import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  demoAccountFixtures,
  envelopeError,
  envelopeOk,
  loginResult,
  profileFixtures,
} from '@lms/mocks';
import { Toaster } from '@lms/ui';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SessionStore } from '../../../core/session/session.store';

describe('Login', () => {
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
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
    backend.verify();
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  /** Restores the session as anonymous, opens the login page and answers its demo accounts. */
  async function openLogin(url = '/login'): Promise<void> {
    TestBed.inject(SessionStore).restore();
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(
        envelopeError('CORE-0401', 'Cần đăng nhập', 'Token không hợp lệ.'),
      );
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    backend
      .expectOne('/api/auth/demo-accounts')
      .flush(envelopeOk(demoAccountFixtures));
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const field = (name: 'email' | 'password') =>
    el.querySelector<HTMLInputElement>(
      name === 'email'
        ? 'input[autocomplete="username"]'
        : 'input[autocomplete="current-password"]',
    )!;

  async function type(email: string, password: string): Promise<void> {
    for (const [name, value] of [
      ['email', email],
      ['password', password],
    ] as const) {
      const input = field(name);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await settle();
  }

  async function submit(): Promise<void> {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await settle();
  }

  /** The backend refuses with an ERROR envelope; it still answers HTTP 200. */
  const refuse = (url: string, title: string, message: string) =>
    backend.expectOne(url).flush(envelopeError('CORE-0402', title, message));

  const alert = () => el.querySelector('.login__card ui-alert[role="alert"]');

  async function signInSucceeds(role: keyof typeof profileFixtures) {
    backend.expectOne('/api/auth/login').flush(envelopeOk(loginResult));
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures[role]));
    await settle();
  }

  it('lists a demo account per seeded role', async () => {
    await openLogin();
    const cards = Array.from(el.querySelectorAll('.login__account'));
    expect(cards).toHaveLength(demoAccountFixtures.length);
    expect(cards[0].textContent).toContain('Quản trị viên');
    expect(el.textContent).toContain('Quản trị viên đơn vị');
    expect(cards[0].textContent).toContain(demoAccountFixtures[0].email);
  });

  it('shows the heading, the form and the password hint', async () => {
    await openLogin();
    expect(el.querySelector('h1')?.textContent).toContain('Học đúng việc');
    expect(el.querySelector('h2')?.textContent).toContain('Chào mừng trở lại');
    expect(field('email').getAttribute('autocomplete')).toBe('username');
    expect(field('password').type).toBe('password');
    expect(el.textContent).toContain('bất kỳ từ 6 ký tự');
    expect(el.querySelector('.alert')).toBeNull();
  });

  it('reveals and hides the password', async () => {
    await openLogin();
    const toggle = el.querySelector<HTMLButtonElement>('.login__reveal')!;
    expect(toggle.getAttribute('aria-label')).toBe('Hiện mật khẩu');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    await settle();
    expect(field('password').type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Ẩn mật khẩu');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    await settle();
    expect(field('password').type).toBe('password');
  });

  describe('with the form', () => {
    it('signs in, says so, and goes to the home of the role', async () => {
      await openLogin();
      await type('hoc.vien@demo.cb', '123456');
      await submit();
      const request = backend.expectOne('/api/auth/login');
      expect(request.request.body).toEqual({
        email: 'hoc.vien@demo.cb',
        password: '123456',
      });
      request.flush(envelopeOk(loginResult));
      await settle();
      backend
        .expectOne('/api/auth/profile')
        .flush(envelopeOk(profileFixtures['learner']));
      await vi.waitFor(() => {
        TestBed.tick();
        expect(router.url).toBe('/learn');
      });
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain('Đăng nhập thành công'),
      );
    });

    it('marks the button busy while the request runs', async () => {
      await openLogin();
      await type('a@demo.cb', '123456');
      await submit();
      const button = el.querySelector('button[type="submit"]');
      expect(button?.getAttribute('aria-busy')).toBe('true');
      backend.expectOne('/api/auth/login').flush(envelopeOk(loginResult));
      await settle();
      backend
        .expectOne('/api/auth/profile')
        .flush(envelopeOk(profileFixtures['learner']));
      await settle();
    });

    it('tells the visitor why they are here and returns to the page they wanted', async () => {
      await openLogin('/login?next=%2Fcatalog');
      expect(el.querySelector('.alert')?.textContent).toContain(
        'Vui lòng đăng nhập để tiếp tục tới trang bạn yêu cầu.',
      );
      await type('hoc.vien@demo.cb', '123456');
      await submit();
      await signInSucceeds('learner');
      await vi.waitFor(() => {
        TestBed.tick();
        expect(router.url).toBe('/catalog');
      });
    });

    it('ignores a next that leaves the app', async () => {
      await openLogin('/login?next=%2F%2Fevil.example');
      expect(el.querySelector('.alert')).toBeNull();
      await type('hoc.vien@demo.cb', '123456');
      await submit();
      await signInSucceeds('learner');
      await vi.waitFor(() => {
        TestBed.tick();
        expect(router.url).toBe('/learn');
      });
    });

    it('shows a refused sign-in as one alert with the backend title and message, and no toast', async () => {
      await openLogin();
      const toasts = vi.spyOn(TestBed.inject(Toaster), 'error');
      await type('a@demo.cb', 'wrong-password');
      await submit();
      refuse(
        '/api/auth/login',
        'Đăng nhập thất bại',
        'Email hoặc mật khẩu không đúng.',
      );
      await settle();
      expect(alert()?.textContent).toContain('Đăng nhập thất bại');
      expect(alert()?.textContent).toContain('Email hoặc mật khẩu không đúng.');
      expect(toasts).not.toHaveBeenCalled();
      expect(el.querySelector('ui-error-summary')).toBeNull();
      expect(el.querySelector('.field__error')).toBeNull();
      expect(field('password').getAttribute('aria-invalid')).toBeNull();
      expect(router.url).toBe('/login');
    });

    it('falls back to a default heading when the backend sent no title', async () => {
      await openLogin();
      await type('a@demo.cb', 'wrong-password');
      await submit();
      backend.expectOne('/api/auth/login').flush({
        ...envelopeError('CORE-0402', '', 'Sai thông tin.'),
        messageTitle: null,
      });
      await settle();
      expect(alert()?.textContent).toContain('Không đăng nhập được');
      expect(alert()?.textContent).toContain('Sai thông tin.');
    });

    it('lets the visitor try again after a failure', async () => {
      await openLogin();
      await type('a@demo.cb', 'wrong-password');
      await submit();
      refuse('/api/auth/login', 'Đăng nhập thất bại', 'Sai mật khẩu.');
      await settle();
      await submit();
      await signInSucceeds('learner');
      await vi.waitFor(() => {
        TestBed.tick();
        expect(router.url).toBe('/learn');
      });
    });

    it('fills in the locked account and tries to sign in with it', async () => {
      await openLogin();
      el.querySelector<HTMLButtonElement>('.link-btn')?.click();
      await settle();
      const request = backend.expectOne('/api/auth/login');
      expect(request.request.body).toEqual({
        email: 'long.pd@demo.cb',
        password: '123456',
      });
      request.flush(
        envelopeError(
          'CORE-0423',
          'Tài khoản bị khóa',
          'Tài khoản đã bị khóa.',
        ),
      );
      await settle();
      expect(alert()?.textContent).toContain('Tài khoản đã bị khóa.');
    });
  });

  describe('with a demo account', () => {
    it('signs in as the chosen account', async () => {
      await openLogin();
      const target = demoAccountFixtures[2];
      Array.from(
        el.querySelectorAll<HTMLButtonElement>('.login__account'),
      )[2].click();
      await settle();
      backend
        .expectOne(`/api/auth/demo-accounts/${target.id}/login`)
        .flush(envelopeOk({ id: target.id, roleId: target.roleId }));
      await settle();
      backend
        .expectOne('/api/auth/profile')
        .flush(envelopeOk(profileFixtures['instructor']));
      await vi.waitFor(() => {
        TestBed.tick();
        expect(router.url).toBe('/instructor');
      });
    });

    it('shows why a locked demo account could not sign in', async () => {
      await openLogin();
      const target = demoAccountFixtures[5];
      Array.from(
        el.querySelectorAll<HTMLButtonElement>('.login__account'),
      )[5].click();
      await settle();
      refuse(
        `/api/auth/demo-accounts/${target.id}/login`,
        'Tài khoản bị khóa',
        'Tài khoản demo này đã bị khóa.',
      );
      await settle();
      expect(alert()?.textContent).toContain('Tài khoản demo này đã bị khóa.');
      expect(field('password').getAttribute('aria-invalid')).toBeNull();
    });
  });

  it('sends a signed-in user from the login page to their home', async () => {
    TestBed.inject(SessionStore).restore();
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures['admin']));
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/admin');
  });
});
