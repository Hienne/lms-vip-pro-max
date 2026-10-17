import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { identityEndpoints } from '@lms/contracts';
import { SEED_USERS } from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { SessionStore } from '../../../core/session/session.store';

const NAMES = Object.fromEntries(
  SEED_USERS.map((user) => [user.userId, user.fullName]),
);

describe('UserDetail', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

  function configure(mockApi: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi, mockBackend: true })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
  }
  beforeEach(() => configure(true));
  afterEach(() =>
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = '')),
  );

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
  }

  async function open(
    userId: string,
    as = { username: 'super.admin', id: '000001' },
  ) {
    signInToMockBackend(as.username);
    fakeSession().user.set(seedProfile(as.id));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/admin/users/${userId}`);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    ) as HTMLButtonElement;
  const tab = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]')).find((t) =>
      t.textContent?.includes(label),
    ) as HTMLElement;
  const alertDialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);

  async function choose(select: HTMLSelectElement, value: string) {
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  const picker = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('app-grant-picker ui-field'))
      .find((f) => f.querySelector('label')?.textContent?.includes(label))
      ?.querySelector('select') as HTMLSelectElement;

  it('shows the user, the account facts and the status actions', async () => {
    await open('000004');
    expect(el.querySelector('h1')?.textContent).toBe(NAMES['000004']);
    expect(text()).toContain('Hoạt động');
    expect(text()).toContain('learner@example.test');
    expect(text()).toContain('Mã cán bộ000004');
    expect(text()).toContain('Tên đăng nhậphocvien');
    expect(button(el, 'Sửa')).toBeTruthy();
    expect(button(el, 'Tạm dừng')).toBeTruthy();
    expect(button(el, 'Khóa tài khoản')).toBeTruthy();
  });

  it('pauses the account after confirming', async () => {
    await open('000004');
    button(el, 'Tạm dừng').click();
    await settle();
    expect(alertDialog()?.textContent).toContain(
      `Tạm dừng ${NAMES['000004']}?`,
    );
    button(alertDialog() as HTMLElement, 'Tạm dừng').click();
    await settle();
    expect(calls(identityEndpoints.setUserStatus)[0][1]).toMatchObject({
      body: { status: 'inactive' },
    });
    expect(text()).toContain('Tạm dừng');
    expect(button(el, 'Kích hoạt')).toBeTruthy();
  });

  it('lists the grants with their scope and revokes one after confirming', async () => {
    await open('000005');
    tab('Vai trò & quyền').click();
    await settle();
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(text()).toContain('Cá nhân');
    const instructor = Array.from(el.querySelectorAll('tbody tr')).find((r) =>
      r.textContent?.includes('Giảng viên'),
    ) as Element;
    button(instructor, 'Thu hồi').click();
    await settle();
    expect(alertDialog()?.textContent).toContain('Thu hồi vai trò Giảng viên?');
    button(alertDialog() as HTMLElement, 'Thu hồi').click();
    await settle();
    expect(calls(identityEndpoints.revokeRole)).toHaveLength(1);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(document.body.textContent).toContain('Đã thu hồi vai trò');
  });

  it('grants a role at the scopes the server allows: role, then scope, then org', async () => {
    await open('000004');
    tab('Vai trò & quyền').click();
    await settle();
    const add = button(el, 'Thêm') as HTMLButtonElement;
    expect(add.disabled).toBe(true);

    const role = picker('Vai trò');
    const instructor = Array.from(role.options).find((o) =>
      o.textContent?.includes('Giảng viên'),
    ) as HTMLOptionElement;
    await choose(role, instructor.value);
    const scopes = Array.from(picker('Phạm vi').options).map((o) => o.value);
    expect(scopes).toContain('ORG');
    await choose(picker('Phạm vi'), 'ORG');
    expect(add.disabled).toBe(true);
    await choose(picker('Đơn vị'), '1');
    expect(add.disabled).toBe(false);
    add.click();
    await settle();
    expect(calls(identityEndpoints.grantRole)[0][1]).toMatchObject({
      params: { userId: '000004' },
      body: { roleId: Number(instructor.value), scope: 'ORG', orgId: 1 },
    });
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(document.body.textContent).toContain('Đã cấp vai trò');
  });

  it('offers the courses, attempts and activity tabs only on the mock API', async () => {
    await open('000004');
    expect(tab('Khóa học được giao')).toBeTruthy();
    expect(tab('Lịch sử thi')).toBeTruthy();
    expect(tab('Hoạt động')).toBeTruthy();
    tab('Khóa học được giao').click();
    await settle();
    expect(text()).toContain('Khóa học được giao');
  });
});

describe('UserDetail against the backend only', () => {
  it('hides the tabs that have no backend endpoint yet', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: false, mockBackend: true })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    signInToMockBackend('super.admin');
    fakeSession().user.set(seedProfile('000001'));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/users/000004');
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    const el = harness.routeNativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('[role="tab"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(labels.join('|')).toContain('Thông tin');
    expect(labels.join('|')).not.toContain('Lịch sử thi');
  });
});
