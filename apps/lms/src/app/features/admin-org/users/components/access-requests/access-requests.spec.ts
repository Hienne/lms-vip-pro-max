import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { identityEndpoints } from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
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
      'Thao tác',
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

  describe('rejecting a request', () => {
    const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
    const rejectButton = (needle: string) =>
      Array.from(rowOf(needle).querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Từ chối'),
      ) as HTMLButtonElement;
    const footerButton = (label: string) =>
      Array.from(dialog()?.querySelectorAll('button') ?? []).find((b) =>
        b.textContent?.includes(label),
      ) as HTMLButtonElement;
    const rejections = () =>
      handle.mock.calls.filter(
        ([e]) => e === identityEndpoints.rejectAccessRequest,
      );
    afterEach(() =>
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((c) => (c.innerHTML = '')),
    );

    it('offers "Duyệt" on pending registrations, "Đặt lại mật khẩu" on found-account resets and "Từ chối" on every pending row, with no disabled placeholder', async () => {
      await open();
      const labels = (row: Element) =>
        Array.from(row.querySelectorAll('button')).map((b) =>
          b.textContent?.trim(),
        );
      expect(labels(rowOf('000101'))).toEqual(['Duyệt', 'Từ chối']);
      expect(labels(rowOf('000004'))).toEqual(['Đặt lại mật khẩu', 'Từ chối']);
      expect(labels(rowOf('000999'))).toEqual(['Từ chối']);
      expect(panel.querySelectorAll('tbody [disabled]')).toHaveLength(0);
      await choose(select('Trạng thái'), 'REJECTED');
      expect(rowOf('000103').querySelector('button')).toBeNull();
    });

    it('opens a dialog naming the sender, with an optional note capped at 500 characters', async () => {
      await open();
      rejectButton('Nguyễn Văn An').click();
      await settle();
      expect(dialog()?.textContent).toContain('Nguyễn Văn An');
      const note = dialog()?.querySelector('textarea') as HTMLTextAreaElement;
      expect(note.getAttribute('maxlength')).toBe('500');
      expect(footerButton('Từ chối yêu cầu')).toBeTruthy();
      expect(rejections()).toHaveLength(0);
    });

    it('rejects without a note: the row leaves, the count drops, one toast', async () => {
      await open();
      rejectButton('Nguyễn Văn An').click();
      await settle();
      footerButton('Từ chối yêu cầu').click();
      await settle();
      expect(rejections()).toHaveLength(1);
      expect(rejections()[0][1]).toMatchObject({
        params: { requestId: '1' },
        body: {},
      });
      expect(dialog()).toBeNull();
      expect(rows()).toHaveLength(2);
      expect(text()).toContain('2 yêu cầu');
      const tab = (harness.routeNativeElement as HTMLElement).querySelector(
        '[role="tab"][aria-selected="true"]',
      );
      expect(text(tab as HTMLElement)).toBe('Yêu cầu 2');
      expect(document.body.textContent).toContain('Đã từ chối yêu cầu');
    });

    it('sends the trimmed note', async () => {
      await open();
      rejectButton('000999').click();
      await settle();
      const note = dialog()?.querySelector('textarea') as HTMLTextAreaElement;
      note.value = '  Không có tài khoản này  ';
      note.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      footerButton('Từ chối yêu cầu').click();
      await settle();
      expect(rejections()[0][1]).toMatchObject({
        body: { note: 'Không có tài khoản này' },
      });
    });

    it('leaves the row untouched on cancel and on Escape, and gives focus back', async () => {
      await open();
      const opener = rejectButton('Nguyễn Văn An');
      opener.focus();
      opener.click();
      await settle();
      footerButton('Hủy').click();
      await settle();
      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(opener);
      opener.click();
      await settle();
      dialog()?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          bubbles: true,
        }),
      );
      await settle();
      expect(dialog()).toBeNull();
      expect(rejections()).toHaveLength(0);
      expect(rows()).toHaveLength(3);
    });

    it('shows the refusal once and keeps the row when the server refuses', async () => {
      await open();
      handle.mockImplementation((endpoint, request) =>
        endpoint === identityEndpoints.rejectAccessRequest
          ? backendRefusal('stateConflict')
          : original(endpoint, request),
      );
      rejectButton('Nguyễn Văn An').click();
      await settle();
      footerButton('Từ chối yêu cầu').click();
      await settle();
      expect(document.body.textContent).toContain('Xung đột dữ liệu');
      expect(document.body.textContent).not.toContain('Đã từ chối yêu cầu');
      expect(rows()).toHaveLength(3);
    });
  });

  describe('approving', () => {
    const dialog = () => document.querySelector('[role="dialog"]');
    const footerButton = (label: string) =>
      Array.from(dialog()?.querySelectorAll('button') ?? []).find((b) =>
        b.textContent?.includes(label),
      ) as HTMLButtonElement;
    const approveButton = (needle: string) =>
      Array.from(rowOf(needle).querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Duyệt'),
      ) as HTMLButtonElement;
    const approvals = () =>
      handle.mock.calls.filter(
        ([e]) => e === identityEndpoints.approveAccessRequest,
      );
    const approvedRow = {
      requestId: 1,
      kind: 'REGISTER',
      status: 'APPROVED',
      staffCode: '000101',
      fullName: 'Nguyễn Văn An',
      email: 'an.nguyen@example.com',
      orgId: 1,
      orgName: 'Ban Quản lý và phát triển Core Banking',
      targetUserId: '000101',
      accountFound: true,
      createdTime: '2026-11-05T08:15:00+07:00',
      resolvedBy: '000001',
      resolvedTime: '2026-11-05T10:00:00+07:00',
      resolutionNote: 'Đúng đối tượng',
    };
    /** The approve endpoint is not in the in-app mock: the backend answers it, so the spec stands in. */
    const backendApproves = () =>
      handle.mockImplementation((endpoint, request) =>
        endpoint === identityEndpoints.approveAccessRequest
          ? { status: 200, body: envelopeOk(approvedRow) }
          : original(endpoint, request),
      );
    afterEach(() =>
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((c) => (c.innerHTML = '')),
    );

    it('opens a dialog that says what will be created, with an optional note capped at 500 characters', async () => {
      await open();
      approveButton('000101').click();
      await settle();
      const content = text(dialog() as HTMLElement);
      expect(content).toContain('Nguyễn Văn An');
      expect(content).toContain('000101');
      expect(content).toContain('vai trò học viên');
      expect(
        dialog()?.querySelector('textarea')?.getAttribute('maxlength'),
      ).toBe('500');
      expect(footerButton('Duyệt yêu cầu')).toBeTruthy();
      expect(approvals()).toHaveLength(0);
    });

    it('approves with the trimmed note, closes, and says so once', async () => {
      await open();
      backendApproves();
      approveButton('000101').click();
      await settle();
      const note = dialog()?.querySelector('textarea') as HTMLTextAreaElement;
      note.value = '  Đúng đối tượng  ';
      note.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      footerButton('Duyệt yêu cầu').click();
      await settle();
      expect(approvals()).toHaveLength(1);
      expect(approvals()[0][1]).toMatchObject({
        params: { requestId: '1' },
        body: { note: 'Đúng đối tượng' },
      });
      expect(dialog()).toBeNull();
      expect(document.body.textContent).toContain('Đã duyệt yêu cầu');
    });

    it('sends nothing on cancel', async () => {
      await open();
      approveButton('000101').click();
      await settle();
      footerButton('Hủy').click();
      await settle();
      expect(dialog()).toBeNull();
      expect(approvals()).toHaveLength(0);
    });

    it('shows the refusal and keeps the row when the staff code was taken meanwhile', async () => {
      await open();
      handle.mockImplementation((endpoint, request) =>
        endpoint === identityEndpoints.approveAccessRequest
          ? backendRefusal('identifierExists')
          : original(endpoint, request),
      );
      approveButton('000101').click();
      await settle();
      footerButton('Duyệt yêu cầu').click();
      await settle();
      expect(document.body.textContent).not.toContain('Đã duyệt yêu cầu');
      expect(document.body.textContent).toContain('đã được sử dụng');
      expect(rows()).toHaveLength(3);
    });
  });

  describe('resetting a password', () => {
    const dialog = () => document.querySelector('[role="dialog"]');
    const button = (root: ParentNode, label: string) =>
      Array.from(root.querySelectorAll('button')).find(
        (b) =>
          b.textContent?.includes(label) ||
          b.getAttribute('aria-label')?.includes(label),
      ) as HTMLButtonElement;
    const resets = () =>
      handle.mock.calls.filter(
        ([e]) => e === identityEndpoints.resetPasswordForRequest,
      );
    const resetRow = {
      requestId: 2,
      kind: 'PASSWORD_RESET',
      status: 'APPROVED',
      staffCode: '000004',
      fullName: 'Học viên tiền gửi Demo',
      email: null,
      orgId: 1,
      orgName: 'Ban Quản lý và phát triển Core Banking',
      targetUserId: '000004',
      accountFound: true,
      createdTime: '2026-11-05T08:15:00+07:00',
      resolvedBy: '000001',
      resolvedTime: '2026-11-05T10:00:00+07:00',
      resolutionNote: null,
    };
    const backendResets = () =>
      handle.mockImplementation((endpoint, request) =>
        endpoint === identityEndpoints.resetPasswordForRequest
          ? {
              status: 200,
              body: envelopeOk({
                request: resetRow,
                temporaryPassword: 'Xk7mPq2RtV9b',
              }),
            }
          : original(endpoint, request),
      );
    afterEach(() =>
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((c) => (c.innerHTML = '')),
    );

    it('offers the reset only on a forgot-password request whose account was found', async () => {
      await open();
      expect(button(rowOf('000004'), 'Đặt lại mật khẩu')).toBeTruthy();
      expect(button(rowOf('000101'), 'Đặt lại mật khẩu')).toBeUndefined();
      expect(button(rowOf('000999'), 'Đặt lại mật khẩu')).toBeUndefined();
    });

    it('asks first and sends nothing until confirmed', async () => {
      await open();
      button(rowOf('000004'), 'Đặt lại mật khẩu').click();
      await settle();
      expect(text(dialog() as HTMLElement)).toContain('000004');
      expect(resets()).toHaveLength(0);
      button(dialog() as HTMLElement, 'Hủy').click();
      await settle();
      expect(dialog()).toBeNull();
      expect(resets()).toHaveLength(0);
    });

    it('shows the temporary password once, masked until revealed, and drops it on Xong', async () => {
      await open();
      backendResets();
      button(rowOf('000004'), 'Đặt lại mật khẩu').click();
      await settle();
      const note = dialog()?.querySelector('textarea') as HTMLTextAreaElement;
      note.value = '  đã gọi lại  ';
      note.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      button(dialog() as HTMLElement, 'Đặt lại mật khẩu').click();
      await settle();
      expect(resets()[0][1]).toMatchObject({
        params: { requestId: '2' },
        body: { note: 'đã gọi lại' },
      });
      const field = dialog()?.querySelector(
        'input[aria-label="Mật khẩu tạm"]',
      ) as HTMLInputElement;
      expect(field.type).toBe('password');
      expect(field.value).toBe('Xk7mPq2RtV9b');
      button(dialog() as HTMLElement, 'Hiện mật khẩu').click();
      await settle();
      expect(field.type).toBe('text');

      const written: string[] = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (v: string) => void written.push(v) },
      });
      button(dialog() as HTMLElement, 'Sao chép').click();
      await settle();
      expect(written).toEqual(['Xk7mPq2RtV9b']);

      button(dialog() as HTMLElement, 'Xong').click();
      await settle();
      expect(dialog()).toBeNull();
      expect(document.body.textContent).not.toContain('Xk7mPq2RtV9b');
      expect(document.body.innerHTML.includes('Xk7mPq2RtV9b')).toBe(false);
    });

    it('shows a refusal inside the dialog and leaves it open', async () => {
      await open();
      handle.mockImplementation((endpoint, request) =>
        endpoint === identityEndpoints.resetPasswordForRequest
          ? backendRefusal('stateConflict')
          : original(endpoint, request),
      );
      button(rowOf('000004'), 'Đặt lại mật khẩu').click();
      await settle();
      button(dialog() as HTMLElement, 'Đặt lại mật khẩu').click();
      await settle();
      expect(dialog()).not.toBeNull();
      expect(text(dialog() as HTMLElement)).toContain(
        'Chưa đặt lại được mật khẩu',
      );
      expect(
        dialog()?.querySelector('input[aria-label="Mật khẩu tạm"]'),
      ).toBeNull();
    });
  });
});
