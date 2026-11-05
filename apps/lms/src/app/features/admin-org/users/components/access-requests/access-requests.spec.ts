import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { identityEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import type { MockInstance } from 'vitest';
import { createAppRoutes } from '../../../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../../core/config/app-config';
import { testAppConfig } from '../../../../../core/config/app-config.testing';
import { MockBackend } from '../../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../../../core/dev/mock-api/mock-backend.testing';
import { SessionStore } from '../../../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../../../core/session/session.testing';

describe('AccessRequests', () => {
  let harness: RouterTestingHarness;
  let panel: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;
  const original = (endpoint: unknown, request: unknown) =>
    MockBackend.prototype.handle.call(
      TestBed.inject(MockBackend),
      endpoint as never,
      request as never,
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  async function open(username = 'super.admin', userId = '000001') {
    signInToMockBackend(username);
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/users?tab=requests');
    await settle();
    panel = (harness.routeNativeElement as HTMLElement).querySelector(
      'app-access-requests',
    ) as HTMLElement;
  }

  const text = (root: ParentNode = panel) =>
    (root.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rows = () => Array.from(panel.querySelectorAll('tbody tr'));
  const rowOf = (needle: string) =>
    rows().find((row) => row.textContent?.includes(needle)) as HTMLElement;
  const select = (label: string) =>
    panel.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;

  async function choose(control: HTMLSelectElement, value: string) {
    control.value = value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  it('lists the pending requests, newest first, with sender, kind, unit and time', async () => {
    await open();
    const headers = Array.from(panel.querySelectorAll('th')).map((th) =>
      text(th),
    );
    expect(headers).toEqual([
      'Người gửi',
      'Loại',
      'Đơn vị',
      'Gửi lúc',
      'Trạng thái',
    ]);
    expect(rows()).toHaveLength(3);
    expect(
      rows().map((row) => /000\d{3}/.exec(row.textContent ?? '')?.[0]),
    ).toEqual(['000004', '000101', '000999']);
    expect(text()).toContain('3 yêu cầu');
    const register = rowOf('Nguyễn Văn An');
    expect(register.textContent).toContain('000101');
    expect(register.textContent).toContain('an.nguyen@example.com');
    expect(register.textContent).toContain('Đăng ký');
    expect(register.textContent).toContain('Chờ xử lý');
    expect(register.textContent).toContain('Ban Quản lý và phát triển');
    const reset = rowOf('Học viên tiền gửi Demo');
    expect(reset.textContent).toContain('Quên mật khẩu');
  });

  it('says when a reset request matched no account', async () => {
    await open();
    const missing = rowOf('000999');
    expect(text(missing)).toContain('Không tìm thấy tài khoản');
    expect(text(rowOf('000004'))).not.toContain('Không tìm thấy tài khoản');
  });

  it('shows who resolved a request, when, and the note, with no action', async () => {
    await open();
    await choose(select('Trạng thái'), 'REJECTED');
    const rejected = rowOf('000103');
    expect(rejected.textContent).toContain('Đã từ chối');
    expect(rejected.textContent).toContain('000001');
    expect(rejected.textContent).toContain(
      'Không thuộc đơn vị được phép đăng ký.',
    );
    expect(rejected.querySelector('button')).toBeNull();
  });

  it('asks the server to filter by kind, status and text', async () => {
    await open();
    const lastQuery = () =>
      handle.mock.calls
        .filter(([e]) => e === identityEndpoints.accessRequests)
        .at(-1)?.[1].query;
    await choose(select('Loại yêu cầu'), 'PASSWORD_RESET');
    expect(lastQuery()).toMatchObject({
      kind: 'PASSWORD_RESET',
      status: 'PENDING',
    });
    await choose(select('Trạng thái'), '');
    expect((lastQuery() as Record<string, string>)['status']).toBeUndefined();
  });

  it('shows an inline empty line when nothing matches', async () => {
    await open();
    await choose(select('Loại yêu cầu'), 'REGISTER');
    await choose(select('Trạng thái'), 'APPROVED');
    await choose(select('Loại yêu cầu'), 'PASSWORD_RESET');
    expect(rows().length).toBe(0);
    expect(text()).toContain('Không có yêu cầu nào.');
    expect(panel.querySelector('ui-error-state')).toBeNull();
  });

  it('shows an error with retry, and retry reads the list again', async () => {
    handle.mockImplementation((endpoint, request) =>
      endpoint === identityEndpoints.accessRequests &&
      (request as { query: Record<string, string> }).query['size'] === '10'
        ? backendRefusal('internalError')
        : original(endpoint, request),
    );
    await open();
    const error = panel.querySelector('ui-error-state') as HTMLElement;
    expect(error).not.toBeNull();
    handle.mockImplementation(original);
    Array.from(error.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Thử lại'))
      ?.click();
    await settle();
    expect(panel.querySelector('ui-error-state')).toBeNull();
    expect(rows()).toHaveLength(3);
  });

  it('leaves the primary-action slot empty: no disabled placeholder button', async () => {
    await open();
    expect(rowOf('Nguyễn Văn An').querySelectorAll('[disabled]')).toHaveLength(
      0,
    );
  });
});
