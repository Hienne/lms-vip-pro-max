import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type BackendResponseKey,
  backendRefusal,
  envelopeError,
  envelopeOk,
  seedMe,
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
import {
  flushMe,
  ME_URL,
  storeToken,
} from '../../../core/session/session.testing';

const LOGIN_URL = '/api/v1/auth/login';

const loginData = {
  accessToken: 'fixture.jwt.token',
  tokenType: 'Bearer',
  expiresInSeconds: 3600,
};
const loginV1Body = envelopeOk(loginData);
/** `/me` of the seed learner. */
const meV1Body = envelopeOk(seedMe('000004'));

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
    // The learner's home a sign-in lands on reads its courses; this spec is about signing in.
    backend.match(
      (req) =>
        req.url.startsWith('/api/v1/me/learning/') ||
        req.url.startsWith('/api/v1/training-catalog/'),
    );
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
    el.querySelector<HTMLInputElement>(
      name === 'username'
        ? 'input[autocomplete="username"]'
        : 'input[autocomplete="current-password"]',
    )!;

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

  /** The backend refuses a wrong password with HTTP 401 and an envelope in the body. */
  const refuse = (key: BackendResponseKey = 'credentialsInvalid') => {
    const { status, body } = backendRefusal(key);
    backend
      .expectOne(LOGIN_URL)
      .flush(body, { status, statusText: 'Unauthorized' });
  };

  const alert = () => el.querySelector('.login__card ui-alert[role="alert"]');

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

  it('shows a wrong password (HTTP 401 IDENTITY-CREDENTIALS_INVALID) as one alert with the backend title and message, and no toast', async () => {
    await openLogin();
    const toasts = vi.spyOn(TestBed.inject(Toaster), 'error');
    await type('000123', 'wrong-password');
    await submit();
    refuse();
    await settle();
    expect(alert()?.textContent).toContain('Đăng nhập không thành công');
    expect(alert()?.textContent).toContain(
      'Tên đăng nhập hoặc mật khẩu không đúng.',
    );
    expect(toasts).not.toHaveBeenCalled();
    expect(el.querySelector('ui-error-summary')).toBeNull();
    expect(el.querySelector('.field__error')).toBeNull();
    expect(field('password').getAttribute('aria-invalid')).toBeNull();
    expect(router.url).toBe('/login');
  });

  it('falls back to a default heading when the backend sent no title', async () => {
    await openLogin();
    await type('000123', 'wrong-password');
    await submit();
    backend.expectOne(LOGIN_URL).flush(
      {
        ...envelopeError('IDENTITY-CREDENTIALS_INVALID', '', 'Sai thông tin.'),
        messageTitle: null,
      },
      { status: 401, statusText: 'Unauthorized' },
    );
    await settle();
    expect(alert()?.textContent).toContain('Không đăng nhập được');
    expect(alert()?.textContent).toContain('Sai thông tin.');
  });

  it('lets the visitor try again after a failure', async () => {
    await openLogin();
    await type('000123', 'wrong-password');
    await submit();
    refuse();
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

  it('sends a user with a temporary password to the password change', async () => {
    await openLogin();
    await type('moi.tao', 'Tam@12345');
    await submit();
    backend.expectOne(LOGIN_URL).flush(loginV1Body);
    await settle();
    const me = seedMe('000004');
    backend
      .expectOne(ME_URL)
      .flush(
        envelopeOk({ ...me, user: { ...me.user, mustChangePassword: true } }),
      );
    await vi.waitFor(() => {
      TestBed.tick();
      expect(router.url).toBe('/change-password');
    });
  });
});
