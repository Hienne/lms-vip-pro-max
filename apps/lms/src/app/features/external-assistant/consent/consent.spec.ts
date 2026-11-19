import { HttpTestingController } from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import type { OAuthConsentRequest } from '@lms/contracts';
import { envelopeError, envelopeOk } from '@lms/mocks';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { PAGE_LOCATION } from '../../../core/errors/stale-build';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SessionStore } from '../../../core/session/session.store';
import {
  fakeSession,
  FakeSessionStore,
  seedProfile,
} from '../../../core/session/session.testing';
import { Consent } from './consent';

const STATUS = '/api/v1/assistant/external-connections/status';
const REQUEST = '/api/v1/assistant/oauth-requests/r1';

const pending = (atLimit = false): OAuthConsentRequest => ({
  clientName: 'Claude',
  redirectHost: 'claude.ai',
  idleDays: 30,
  atLimit,
  maxConnections: 10,
});

describe('Consent (/tro-ly-ngoai/cho-phep)', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<Consent>;
  let assign: ReturnType<typeof vi.fn>;

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  async function render(
    request: string | null,
    status = { enabled: true, allowed: true },
  ): Promise<void> {
    assign = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(request ? { request } : {}),
            },
          },
        },
        {
          provide: PAGE_LOCATION,
          useValue: { assign, reload: vi.fn(), confirm: vi.fn() },
        },
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fakeSession().user.set({
      ...seedProfile('000005'),
      menus: ['AI_ASSISTANT'],
    });
    fixture = TestBed.createComponent(Consent);
    await settle();
    backend.expectOne(STATUS).flush(envelopeOk(status));
    await settle();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === label,
    );

  async function showRequest(atLimit = false): Promise<void> {
    await render('r1');
    backend.expectOne(REQUEST).flush(envelopeOk(pending(atLimit)));
    await settle();
  }

  afterEach(() => backend.verify());

  it('shows who asks, as self-declared, for which account, what it may do and for how long', async () => {
    await showRequest();

    expect(el().querySelector('[data-testid="client-name"]')?.textContent).toBe(
      'Claude',
    );
    expect(text()).toContain(
      'Tên do ứng dụng tự khai, CHAN Academy không xác minh',
    );
    expect(text()).toContain('claude.ai');
    expect(
      el().querySelector('[data-testid="account"]')?.textContent,
    ).toContain(fakeSession().user()?.username ?? '-');
    expect(text()).toContain('khóa học nháp');
    expect(text()).toContain('không dùng');
    expect(text()).toContain('30 ngày');
    expect(button('Cho phép')).toBeDefined();
    expect(button('Từ chối')).toBeDefined();
  });

  it('Cho phép sends the browser to the URL the server returns', async () => {
    await showRequest();
    button('Cho phép')?.click();
    await settle();

    const call = backend.expectOne(`${REQUEST}/approve`);
    expect(call.request.method).toBe('POST');
    call.flush(
      envelopeOk({
        redirectUrl: 'https://claude.ai/api/mcp/auth_callback?code=c&state=s',
      }),
    );
    await settle();

    expect(assign).toHaveBeenCalledWith(
      'https://claude.ai/api/mcp/auth_callback?code=c&state=s',
    );
    expect(button('Cho phép')?.disabled).toBe(true);
  });

  it('Từ chối sends the browser back with the refusal', async () => {
    await showRequest();
    button('Từ chối')?.click();
    await settle();

    backend.expectOne(`${REQUEST}/deny`).flush(
      envelopeOk({
        redirectUrl: 'http://127.0.0.1:5000/cb?error=access_denied',
      }),
    );
    await settle();

    expect(assign).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/cb?error=access_denied',
    );
  });

  it('says to revoke some at the limit, and shows the refusal the server gives', async () => {
    await showRequest(true);
    expect(el().querySelector('[data-testid="limit"]')?.textContent).toContain(
      '10 kết nối',
    );

    button('Cho phép')?.click();
    await settle();
    backend
      .expectOne(`${REQUEST}/approve`)
      .flush(
        envelopeError(
          'CORE-STATE_CONFLICT',
          'Xung đột dữ liệu',
          'Bạn đã có 10 kết nối trợ lý ngoài còn hiệu lực.',
        ),
      );
    await settle();

    expect(assign).not.toHaveBeenCalled();
    expect(text()).toContain('Bạn đã có 10 kết nối trợ lý ngoài còn hiệu lực.');
    expect(button('Cho phép')?.disabled).toBe(false);
  });

  it('says an expired or used request has to be started again from Claude', async () => {
    await render('r1');
    backend
      .expectOne(REQUEST)
      .flush(
        envelopeError(
          'CORE-RESOURCE_NOT_FOUND',
          'Không tìm thấy dữ liệu',
          'Không tìm thấy.',
        ),
      );
    await settle();

    expect(text()).toContain('Yêu cầu đã hết hạn');
    expect(button('Cho phép')).toBeUndefined();
  });

  it('opened without a request, says the same and asks nothing', async () => {
    await render(null);
    backend.expectNone(REQUEST);
    expect(text()).toContain('Yêu cầu đã hết hạn');
  });

  it('tells a caller who may not connect, and never reads the request', async () => {
    await render('r1', { enabled: true, allowed: false });
    backend.expectNone(REQUEST);
    expect(text()).toContain('Bạn chưa dùng được trợ lý ngoài');
  });
});
