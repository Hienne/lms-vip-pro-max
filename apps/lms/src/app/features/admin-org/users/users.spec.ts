import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { identityEndpoints } from '@lms/contracts';
import { envelopeOk, SEED_USERS } from '@lms/mocks';
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

describe('Users', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

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

  /** Opens the list as a seed user: the backend answers as that user, the session shows them. */
  async function open(username: string, userId: string, url = '/admin/users') {
    signInToMockBackend(username);
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const rows = () => Array.from(el.querySelectorAll('tbody tr'));
  const rowOf = (name: string) =>
    rows().find((row) => row.textContent?.includes(name)) as Element;
  const button = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      `${b.textContent} ${b.getAttribute('aria-label') ?? ''}`.includes(label),
    ) as HTMLButtonElement;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const alertDialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');
  const field = (label: string) =>
    Array.from(dialog()?.querySelectorAll<HTMLElement>('ui-field') ?? []).find(
      (f) => f.querySelector('label')?.textContent?.includes(label),
    ) as HTMLElement;
  const inputOf = (label: string) =>
    field(label).querySelector('input') as HTMLInputElement;
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);

  async function choose(select: HTMLSelectElement, value: string) {
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  async function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  it("lists the users of the caller's scope from the server, with role, org and status", async () => {
    await open('super.admin', '000001');
    expect(el.querySelector('h1')?.textContent).toBe('Người dùng');
    expect(text()).toContain(`${SEED_USERS.length} người dùng`);
    expect(rows()).toHaveLength(SEED_USERS.length);
    const learner = rowOf(NAMES['000004']);
    expect(learner.textContent).toContain('Học viên');
    expect(learner.textContent).toContain('Hoạt động');
    expect(learner.querySelector('a')?.getAttribute('href')).toBe(
      '/admin/users/000004',
    );
    expect(calls(identityEndpoints.listUsers)[0][1].query).toMatchObject({
      page: '0',
      size: '10',
    });
  });

  it('offers only "Thêm người dùng" in the header: the backend has no user import', async () => {
    await open('super.admin', '000001');
    const actions = el.querySelector('[slot="actions"]');
    expect(actions?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Thêm người dùng',
    );
    expect(el.querySelector('a[href^="/admin/import"]')).toBeNull();
  });

  it('cuts the list to the scope of the caller: an org admin sees their own org only', async () => {
    await open('quantri.ban', '000003');
    expect(text()).toContain('chỉ thấy và quản lý người dùng thuộc');
    expect(rows().length).toBeGreaterThan(0);
  });

  it('asks the server to filter by status, sort and search instead of doing it in the browser', async () => {
    await open('super.admin', '000001');
    const status = el.querySelector<HTMLSelectElement>(
      'select[aria-label="Trạng thái"]',
    ) as HTMLSelectElement;
    await choose(status, 'locked');
    expect(calls(identityEndpoints.listUsers).at(-1)?.[1].query).toMatchObject({
      status: 'locked',
      page: '0',
    });
    expect(rows()).toHaveLength(0);
    expect(text()).toContain('Không có người dùng phù hợp');

    await choose(status, '');
    button(el.querySelector('thead') as HTMLElement, 'Người dùng').click();
    await settle();
    expect(calls(identityEndpoints.listUsers).at(-1)?.[1].query).toMatchObject({
      sort: 'fullName,asc',
    });
    expect(el.querySelector('th[aria-sort="ascending"]')).not.toBeNull();
  });

  it('filters by role with the role code', async () => {
    await open('super.admin', '000001');
    const role = el.querySelector<HTMLSelectElement>(
      'select[aria-label="Vai trò"]',
    ) as HTMLSelectElement;
    await choose(role, 'INSTRUCTOR');
    expect(calls(identityEndpoints.listUsers).at(-1)?.[1].query).toMatchObject({
      roleCode: 'INSTRUCTOR',
    });
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining(NAMES['000005']),
    ]);
  });

  it('starts from the team in the URL, as the org screen links to it, and lets the admin drop it', async () => {
    await open('super.admin', '000001', '/admin/users?teamId=1');
    expect(calls(identityEndpoints.listUsers)[0][1].query).toMatchObject({
      teamId: '1',
    });
    expect(text()).toContain('Bỏ lọc theo nhóm');
    button(el, 'Bỏ lọc theo nhóm').click();
    await settle();
    expect(
      calls(identityEndpoints.listUsers).at(-1)?.[1].query,
    ).not.toHaveProperty('teamId');
  });

  it('shows your own row and other administrators view-only: the server marks them not editable', async () => {
    await open('quantri', '000002');
    for (const id of ['000002', '000003', '000001']) {
      const row = rowOf(NAMES[id]);
      expect(button(row, 'Sửa')).toBeUndefined();
      expect(button(row, 'Khóa')).toBeUndefined();
      expect(row.querySelector(`a[href="/admin/users/${id}"]`)).not.toBeNull();
    }
    expect(button(rowOf(NAMES['000004']), 'Khóa')).toBeTruthy();
  });

  it('lets the root administrator edit other administrators, but not themselves', async () => {
    await open('super.admin', '000001');
    expect(button(rowOf(NAMES['000002']), 'Sửa')).toBeTruthy();
    expect(button(rowOf(NAMES['000001']), 'Sửa')).toBeUndefined();
  });

  it('shows a row the caller may read but not change as view-only', async () => {
    await open('quantri.ban', '000003');
    const readOnly = rows().find((r) => !button(r, 'Sửa'));
    if (readOnly) expect(readOnly.querySelector('a')).not.toBeNull();
  });

  it('locks an account after confirming, then reloads the list', async () => {
    await open('super.admin', '000001');
    const row = rowOf(NAMES['000004']);
    button(row, 'Khóa').click();
    await settle();
    expect(alertDialog()?.textContent).toContain(
      `Khóa tài khoản ${NAMES['000004']}?`,
    );
    expect(calls(identityEndpoints.setUserStatus)).toHaveLength(0);
    button(alertDialog() as HTMLElement, 'Khóa tài khoản').click();
    await settle();
    expect(calls(identityEndpoints.setUserStatus)[0][1]).toMatchObject({
      params: { userId: '000004' },
      body: { status: 'locked' },
    });
    expect(rowOf(NAMES['000004']).textContent).toContain('Đã khóa');
    expect(document.body.textContent).toContain('Đã khóa tài khoản');
  });

  it('does not lock when the confirmation is cancelled', async () => {
    await open('super.admin', '000001');
    button(rowOf(NAMES['000004']), 'Khóa').click();
    await settle();
    button(alertDialog() as HTMLElement, 'Hủy').click();
    await settle();
    expect(calls(identityEndpoints.setUserStatus)).toHaveLength(0);
  });

  it('reopens a locked account without asking', async () => {
    await open('super.admin', '000001');
    button(rowOf(NAMES['000004']), 'Khóa').click();
    await settle();
    button(alertDialog() as HTMLElement, 'Khóa tài khoản').click();
    await settle();
    button(rowOf(NAMES['000004']), 'Mở khóa').click();
    await settle();
    expect(calls(identityEndpoints.setUserStatus).at(-1)?.[1]).toMatchObject({
      body: { status: 'active' },
    });
    expect(rowOf(NAMES['000004']).textContent).toContain('Hoạt động');
  });

  it('checks the add form with the backend rules before calling the server', async () => {
    await open('super.admin', '000001');
    button(el, 'Thêm người dùng').click();
    await settle();
    expect(dialog()?.textContent).toContain('Thêm người dùng');
    await type(inputOf('Mã cán bộ'), 'bad id!');
    await type(inputOf('Mật khẩu tạm'), '123');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(calls(identityEndpoints.createUser)).toHaveLength(0);
    expect(dialog()?.textContent).toContain('Mã cán bộ gồm chữ, số');
    expect(dialog()?.textContent).toContain('Nhập họ và tên.');
    expect(dialog()?.textContent).toContain('Mật khẩu tạm tối thiểu 6 ký tự.');
  });

  it('adds a user: sends the command with numeric ids, closes the drawer, shows the new row', async () => {
    await open('super.admin', '000001');
    button(el, 'Thêm người dùng').click();
    await settle();
    await type(inputOf('Mã cán bộ'), '000099');
    await type(inputOf('Tên đăng nhập'), 'moi.tao');
    await type(inputOf('Họ và tên'), '  Trần Thị Mới ');
    await type(inputOf('Email'), 'moi@example.test');
    await type(inputOf('Mật khẩu tạm'), 'Tam@12345');
    await choose(
      field('Đơn vị').querySelector('select') as HTMLSelectElement,
      '1',
    );
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(calls(identityEndpoints.createUser)[0][1].body).toEqual({
      userId: '000099',
      username: 'moi.tao',
      fullName: 'Trần Thị Mới',
      email: 'moi@example.test',
      orgId: 1,
      initialPassword: 'Tam@12345',
    });
    expect(dialog()).toBeNull();
    expect(rowOf('Trần Thị Mới').textContent).toContain('Chờ đổi mật khẩu');
    expect(document.body.textContent).toContain('Đã thêm người dùng');
  });

  it('adds a user with a first role grant from the picker', async () => {
    await open('super.admin', '000001');
    button(el, 'Thêm người dùng').click();
    await settle();
    const select = (label: string) =>
      field(label).querySelector('select') as HTMLSelectElement;
    await type(inputOf('Mã cán bộ'), '000098');
    await type(inputOf('Tên đăng nhập'), 'co.vai.tro');
    await type(inputOf('Họ và tên'), 'Có Vai Trò');
    await type(inputOf('Mật khẩu tạm'), 'Tam@12345');
    const role = select('Vai trò');
    const learner = Array.from(role.options).find((o) =>
      o.textContent?.includes('Học viên'),
    ) as HTMLOptionElement;
    await choose(role, learner.value);
    expect(select('Phạm vi').value).toBe('OWN');
    button(dialog() as HTMLElement, 'Thêm').click();
    await settle();
    expect(dialog()?.textContent).toContain('Học viên · Cá nhân');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(
      (
        calls(identityEndpoints.createUser)[0][1].body as {
          initialRoleGrants: unknown;
        }
      ).initialRoleGrants,
    ).toEqual([{ roleId: Number(learner.value), scope: 'OWN' }]);
    expect(dialog()).toBeNull();
  });

  it('includes the selected role when saving without pressing Add', async () => {
    await open('super.admin', '000001');
    button(el, 'Thêm người dùng').click();
    await settle();
    await type(inputOf('Mã cán bộ'), '000096');
    await type(inputOf('Tên đăng nhập'), 'hocvien.moi');
    await type(inputOf('Họ và tên'), 'Học viên Mới');
    await type(inputOf('Mật khẩu tạm'), 'Tam@12345');
    const role = field('Vai trò').querySelector('select') as HTMLSelectElement;
    const learner = Array.from(role.options).find((o) =>
      o.textContent?.includes('Học viên'),
    ) as HTMLOptionElement;
    await choose(role, learner.value);
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(calls(identityEndpoints.createUser)[0][1].body).toMatchObject({
      initialRoleGrants: [{ roleId: Number(learner.value), scope: 'OWN' }],
    });
  });

  it('keeps the drawer and its input open and toasts the backend message when the username is taken', async () => {
    await open('super.admin', '000001');
    button(el, 'Thêm người dùng').click();
    await settle();
    await type(inputOf('Mã cán bộ'), '000097');
    await type(inputOf('Tên đăng nhập'), 'hocvien');
    await type(inputOf('Họ và tên'), 'Trùng Tên');
    await type(inputOf('Mật khẩu tạm'), 'Tam@12345');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(inputOf('Tên đăng nhập').value).toBe('hocvien');
    expect(document.body.textContent).toContain('Trùng thông tin tài khoản');
  });

  it('edits a user with the form prefilled and PATCHes only what changed', async () => {
    await open('super.admin', '000001');
    button(rowOf(NAMES['000004']), 'Sửa').click();
    await settle();
    expect(dialog()?.textContent).toContain(`Sửa ${NAMES['000004']}`);
    expect(inputOf('Họ và tên').value).toBe(NAMES['000004']);
    expect(dialog()?.textContent).not.toContain('Mật khẩu tạm');
    await type(inputOf('Chức danh'), 'Chuyên viên cao cấp');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(calls(identityEndpoints.updateUser)[0][1]).toMatchObject({
      params: { userId: '000004' },
      body: { positionName: 'Chuyên viên cao cấp' },
    });
    expect(
      Object.keys(calls(identityEndpoints.updateUser)[0][1].body as object),
    ).toEqual(['positionName']);
    expect(dialog()).toBeNull();
    expect(document.body.textContent).toContain('Đã cập nhật người dùng');
  });

  it('closes the editor without a request when nothing changed', async () => {
    await open('super.admin', '000001');
    button(rowOf(NAMES['000004']), 'Sửa').click();
    await settle();
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(calls(identityEndpoints.updateUser)).toHaveLength(0);
    expect(dialog()).toBeNull();
  });

  it('warns that moving a user to another team revokes the grants of the old one', async () => {
    await open('super.admin', '000001');
    button(rowOf(NAMES['000006']), 'Sửa').click();
    await settle();
    expect(dialog()?.textContent).not.toContain('sẽ thu hồi');
    const team = field('Nhóm').querySelector('select') as HTMLSelectElement;
    await choose(team, '');
    expect(dialog()?.textContent).toContain('sẽ thu hồi');
  });

  describe('the requests tab', () => {
    const tabs = () =>
      Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'));
    const tabOf = (name: string) =>
      tabs().find((t) => t.textContent?.includes(name)) as HTMLElement;

    it('adds a "Yêu cầu" tab with the pending count beside "Người dùng", which stays the default', async () => {
      await open('super.admin', '000001');
      expect(
        tabs().map((t) => t.textContent?.replace(/\s+/g, ' ').trim()),
      ).toEqual(['Người dùng', 'Yêu cầu 3']);
      expect(tabOf('Người dùng').getAttribute('aria-selected')).toBe('true');
      expect(rows()).toHaveLength(SEED_USERS.length);
      expect(el.querySelector('app-access-requests')).toBeNull();
      const asked = calls(identityEndpoints.accessRequests);
      expect(
        asked.every(
          ([, r]) => (r.query as Record<string, string>)['size'] === '1',
        ),
      ).toBe(true);
    });

    it('shows no count when nothing is pending', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === identityEndpoints.accessRequests
          ? ({
              status: 200,
              body: envelopeOk({
                items: [],
                page: 0,
                size: 1,
                totalElements: 0,
                totalPages: 0,
              }),
            } as never)
          : MockBackend.prototype.handle.call(
              TestBed.inject(MockBackend),
              endpoint as never,
              request as never,
            ),
      );
      await open('super.admin', '000001');
      expect(tabOf('Yêu cầu').textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Yêu cầu',
      );
    });

    it('opens on ?tab=requests, so a link and the back button work', async () => {
      await open('super.admin', '000001', '/admin/users?tab=requests');
      expect(tabOf('Yêu cầu').getAttribute('aria-selected')).toBe('true');
      expect(el.querySelector('app-access-requests')).not.toBeNull();
      expect(el.querySelector('[slot="actions"]')).toBeNull();
    });

    it('writes the tab to the URL when it is chosen, and drops it for the default', async () => {
      await open('super.admin', '000001');
      tabOf('Yêu cầu').click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/admin/users?tab=requests');
      expect(el.querySelector('app-access-requests')).not.toBeNull();
      tabOf('Người dùng').click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/admin/users');
      expect(el.querySelector('[slot="actions"]')).not.toBeNull();
    });
  });
});
