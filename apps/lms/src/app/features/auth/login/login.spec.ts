import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  loginLocked,
  loginUnauthorized,
  loginV1Body,
  loginV1Invalid,
  meV1Body,
} from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { SessionStore } from '../../../core/session/session.store';
import {
  flushMe,
  ME_URL,
  storeToken,
} from '../../../core/session/session.testing';

const LOGIN_URL = '/api/v1/auth/login';

describe('Login', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
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

  /** Restores the session as anonymous (no token) and opens the login page. */
  async function openLogin(url = '/login'): Promise<void> {
    TestBed.inject(SessionStore).restore();
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const field = (name: 'username' | 'password') =>
    el.querySelector<HTMLInputElement>(`#login-${name}`)!;

  async function type(username: string, password: string): Promise<void> {
    for (const [name, value] of [
      ['username', username],
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

  const fail = (url: string, body: object, status: number, text = 'Error') =>
    backend.expectOne(url).flush(body, { status, statusText: text });

  async function signInSucceeds() {
    backend.expectOne(LOGIN_URL).flush(loginV1Body);
    await settle();
    backend.expectOne(ME_URL).flush(meV1Body);
    await settle();
  }

  it('shows the heading and a username or staff code field, with no demo block', async () => {
    await openLogin();
    expect(el.querySelector('h1')?.textContent).toContain('Học đúng việc');
    expect(el.querySelector('h2')?.textContent).toContain('Chào mừng trở lại');
    expect(el.textContent).toContain('Tên đăng nhập hoặc mã cán bộ');
    expect(field('username').getAttribute('autocomplete')).toBe('username');
    expect(field('password').type).toBe('password');
    expect(el.querySelector('.alert')).toBeNull();
    expect(el.querySelector('.login__account')).toBeNull();
    expect(el.textContent).not.toContain('Tài khoản kiểm thử');
    expect(el.textContent).not.toContain('đã bị khóa');
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

  it('signs in, says so, and goes to /learn', async () => {
    await openLogin();
    await type('000123', 'secret');
    await submit();
    const request = backend.expectOne(LOGIN_URL);
    expect(request.request.body).toEqual({
      username: '000123',
      password: 'secret',
    });
    request.flush(loginV1Body);
    await settle();
    backend.expectOne(ME_URL).flush(meV1Body);
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
    await type('a', 'b');
    await submit();
    const button = el.querySelector('button[type="submit"]');
    expect(button?.getAttribute('aria-busy')).toBe('true');
    await signInSucceeds();
  });

  it('tells the visitor why they are here and returns to the page they wanted', async () => {
    await openLogin('/login?next=%2Fcatalog');
    expect(el.querySelector('.alert')?.textContent).toContain(
      'Vui lòng đăng nhập để tiếp tục tới trang bạn yêu cầu.',
    );
    await type('000123', 'secret');
    await submit();
    await signInSucceeds();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(router.url).toBe('/catalog');
    });
  });

  it('ignores a next that leaves the app', async () => {
    await openLogin('/login?next=%2F%2Fevil.example');
    expect(el.querySelector('.alert')).toBeNull();
    await type('000123', 'secret');
    await submit();
    await signInSucceeds();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(router.url).toBe('/learn');
    });
  });

  it('puts a 422 on the fields and focuses a summary of them', async () => {
    await openLogin();
    await submit();
    fail(LOGIN_URL, loginV1Invalid, 422, 'Unprocessable');
    await settle();
    const summary = el.querySelector('ui-error-summary');
    expect(summary?.getAttribute('role')).toBe('alert');
    expect(summary?.textContent).toContain(loginV1Invalid.message);
    expect(summary?.querySelectorAll('li')).toHaveLength(2);
    const messages = Array.from(el.querySelectorAll('.field__error')).map((e) =>
      e.textContent?.trim(),
    );
    expect(messages).toEqual([
      loginV1Invalid.details?.['username'],
      loginV1Invalid.details?.['password'],
    ]);
    expect(field('username').getAttribute('aria-invalid')).toBe('true');
    await vi.waitFor(() => expect(document.activeElement).toBe(summary));
  });

  it.each([
    [401, loginUnauthorized, 'Unauthorized'],
    [423, loginLocked, 'Locked'],
  ] as const)(
    'puts a %s on the password field and stays on the page',
    async (status, body, text) => {
      await openLogin();
      await type('000123', 'wrong-password');
      await submit();
      fail(LOGIN_URL, body, status, text);
      await settle();
      const summary = el.querySelector('ui-error-summary');
      expect(summary?.textContent).toContain('Không đăng nhập được');
      expect(summary?.textContent).toContain(body.message);
      expect(field('password').getAttribute('aria-invalid')).toBe('true');
      expect(field('username').getAttribute('aria-invalid')).toBeNull();
      expect(router.url).toBe('/login');
    },
  );

  it('lets the visitor try again after a failure', async () => {
    await openLogin();
    await type('000123', 'wrong-password');
    await submit();
    fail(LOGIN_URL, loginUnauthorized, 401, 'Unauthorized');
    await settle();
    await submit();
    await signInSucceeds();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(router.url).toBe('/learn');
    });
  });

  it('sends a signed-in user from the login page to /learn', async () => {
    storeToken();
    TestBed.inject(SessionStore).restore();
    await settle();
    flushMe(backend);
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/learn');
  });
});
