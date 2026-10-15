import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  adminMetaFixture,
  profileFixtures,
  saveUserInvalid,
  unitAdminMetaFixture,
  unitAdminUserList,
  userListFixtures,
} from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { SessionStore } from '../../../core/session/session.store';

describe('Users', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
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

  async function open(
    role: 'admin' | 'unit-admin' = 'admin',
    list = userListFixtures,
    meta = adminMetaFixture,
  ) {
    TestBed.inject(SessionStore).restore();
    await settle();
    backend.expectOne('/api/auth/profile').flush(profileFixtures[role]);
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/users');
    await settle();
    backend.expectOne('/api/admin/users').flush(list);
    backend.expectOne('/api/admin/meta').flush(meta);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const rows = () => Array.from(el.querySelectorAll('tbody tr'));
  const button = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    ) as HTMLButtonElement;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const alertDialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');

  async function pick(label: string, value: string) {
    const select = el.querySelector<HTMLSelectElement>(
      `select[aria-label="${label}"]`,
    ) as HTMLSelectElement;
    await choose(select, value);
  }

  /** Chooses an option the way a browser reports it: `input`, then `change`. */
  async function choose(select: HTMLSelectElement, value: string) {
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  async function type(field: HTMLInputElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  const field = (label: string) =>
    Array.from(dialog()?.querySelectorAll<HTMLElement>('ui-field') ?? []).find(
      (f) => f.querySelector('label')?.textContent?.includes(label),
    ) as HTMLElement;

  it('lists ten users a page with their role, unit and status', async () => {
    await open();
    expect(el.querySelector('h1')?.textContent).toBe('Người dùng');
    expect(text()).toContain('12 người dùng');
    expect(rows()).toHaveLength(10);
    expect(text()).toContain('Hiển thị 1–10 / 12');
    expect(rows()[0].textContent).toContain(userListFixtures[0].email);
    const link = rows()[0].querySelector<HTMLAnchorElement>('a');
    expect(link?.getAttribute('href')).toBe(
      `/admin/users/${userListFixtures[0].id}`,
    );
  });

  it('goes to the second page', async () => {
    await open();
    button(el, '2').click();
    await settle();
    expect(rows()).toHaveLength(2);
    expect(text()).toContain('Hiển thị 11–12 / 12');
  });

  it('filters by role and drops back to the first page', async () => {
    await open();
    button(el, '2').click();
    await settle();
    await pick('Vai trò', 'learner');
    const learners = userListFixtures.filter((u) => u.roleId === 'learner');
    expect(text()).toContain(`${learners.length} người dùng`);
    expect(rows()).toHaveLength(Math.min(10, learners.length));
  });

  it('sorts by a column header', async () => {
    await open();
    button(el, 'Người dùng').click();
    await settle();
    const names = rows().map(
      (row) => row.querySelector('a')?.textContent?.trim() ?? '',
    );
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'vi')));
    expect(el.querySelector('th[aria-sort="ascending"]')).not.toBeNull();
  });

  it('says which unit a unit administrator is limited to, and hides the unit filter', async () => {
    await open('unit-admin', unitAdminUserList, unitAdminMetaFixture);
    expect(text()).toContain(
      'chỉ thấy và quản lý người dùng thuộc Trung tâm Vận hành CNTT',
    );
    expect(el.querySelector('select[aria-label="Đơn vị"]')).toBeNull();
  });

  it('offers no lock on your own row', async () => {
    await open('admin');
    const own = rows().find((row) =>
      row.textContent?.includes(profileFixtures['admin'].email),
    ) as Element;
    expect(button(own, 'Sửa')).toBeTruthy();
    expect(button(own, 'Khóa')).toBeUndefined();
    expect(button(rows()[1], 'Khóa')).toBeTruthy();
  });

  it('locks an account after confirming, then reloads the list', async () => {
    await open('admin');
    const target =
      userListFixtures.find((u) => u.id === 'i1') ?? userListFixtures[2];
    const row = rows().find((r) =>
      r.textContent?.includes(target.email),
    ) as Element;
    button(row, 'Khóa').click();
    await settle();
    expect(alertDialog()?.textContent).toContain(
      `Khóa tài khoản ${target.name}?`,
    );
    backend.expectNone(`/api/admin/users/${target.id}/status`);
    button(alertDialog() as HTMLElement, 'Khóa tài khoản').click();
    await settle();
    const put = backend.expectOne(`/api/admin/users/${target.id}/status`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ status: 'locked' });
    put.flush({ ...target, status: 'locked' });
    await settle();
    backend.expectOne('/api/admin/users').flush(userListFixtures);
    await settle();
    expect(document.body.textContent).toContain('Đã khóa tài khoản');
  });

  it('does not lock when the confirmation is cancelled', async () => {
    await open('admin');
    button(rows()[1], 'Khóa').click();
    await settle();
    button(alertDialog() as HTMLElement, 'Hủy').click();
    await settle();
    backend.expectNone((req) => req.url.endsWith('/status'));
  });

  it('checks the add form locally before calling the server', async () => {
    await open('admin');
    button(el, 'Thêm người dùng').click();
    await settle();
    expect(dialog()?.textContent).toContain('Thêm người dùng');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    backend.expectNone('/api/admin/users');
    expect(dialog()?.textContent).toContain('Họ tên tối thiểu 2 ký tự.');
    expect(dialog()?.textContent).toContain('Email không hợp lệ.');
    expect(dialog()?.textContent).toContain('Chọn phòng / nhóm.');
  });

  it('offers only the groups of the chosen unit, and the roles the caller may assign', async () => {
    await open('admin');
    button(el, 'Thêm người dùng').click();
    await settle();
    const groupOptions = () =>
      Array.from(
        field('Phòng / nhóm').querySelectorAll<HTMLOptionElement>('option'),
      ).map((o) => o.value);
    const unitOne = adminMetaFixture.groups.filter((g) => g.unitId === 'u1');
    expect(groupOptions()).toEqual(['', ...unitOne.map((g) => g.id)]);
    const unit = field('Đơn vị').querySelector('select') as HTMLSelectElement;
    await choose(unit, 'u2');
    const unitTwo = adminMetaFixture.groups.filter((g) => g.unitId === 'u2');
    expect(groupOptions()).toEqual(['', ...unitTwo.map((g) => g.id)]);
    const roles = Array.from(
      field('Vai trò').querySelectorAll<HTMLOptionElement>('option'),
    ).map((o) => o.value);
    expect(roles).toEqual(adminMetaFixture.roles.map((r) => r.id));
  });

  it('adds a user: sends the command, closes the drawer, reloads the list', async () => {
    await open('admin');
    button(el, 'Thêm người dùng').click();
    await settle();
    await type(
      field('Họ và tên').querySelector('input') as HTMLInputElement,
      '  Trần Thị Mới ',
    );
    await type(
      field('Email đăng nhập').querySelector('input') as HTMLInputElement,
      'moi@demo.cb',
    );
    const group = field('Phòng / nhóm').querySelector(
      'select',
    ) as HTMLSelectElement;
    const groupId = adminMetaFixture.groups.find((g) => g.unitId === 'u1')
      ?.id as string;
    await choose(group, groupId);
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    const post = backend.expectOne('/api/admin/users');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      name: 'Trần Thị Mới',
      email: 'moi@demo.cb',
      title: '',
      unitId: 'u1',
      groupId,
      roleId: 'learner',
      scopeUnitId: null,
    });
    post.flush({ ...userListFixtures[4], id: 'new' });
    await settle();
    expect(dialog()).toBeNull();
    backend.expectOne('/api/admin/users').flush(userListFixtures);
    await settle();
    expect(document.body.textContent).toContain('Đã thêm người dùng');
  });

  it('keeps the drawer open and shows the 422 message on the email', async () => {
    await open('admin');
    button(el, 'Thêm người dùng').click();
    await settle();
    await type(
      field('Họ và tên').querySelector('input') as HTMLInputElement,
      'Trần Thị Mới',
    );
    await type(
      field('Email đăng nhập').querySelector('input') as HTMLInputElement,
      'trung@demo.cb',
    );
    const group = field('Phòng / nhóm').querySelector(
      'select',
    ) as HTMLSelectElement;
    await choose(group, adminMetaFixture.groups[0].id);
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    backend
      .expectOne('/api/admin/users')
      .flush(saveUserInvalid, { status: 422, statusText: 'Invalid' });
    await settle();
    expect(dialog()?.textContent).toContain(
      'Email đã được dùng cho tài khoản khác.',
    );
  });

  it('edits a user with the form prefilled, and fixes your own role and scope', async () => {
    await open('admin');
    const own = rows().find((row) =>
      row.textContent?.includes(profileFixtures['admin'].email),
    ) as Element;
    button(own, 'Sửa').click();
    await settle();
    expect(dialog()?.textContent).toContain(
      `Sửa ${profileFixtures['admin'].name}`,
    );
    const name = field('Họ và tên').querySelector('input') as HTMLInputElement;
    expect(name.value).toBe(profileFixtures['admin'].name);
    expect(
      (field('Vai trò').querySelector('select') as HTMLSelectElement).disabled,
    ).toBe(true);
    expect(dialog()?.textContent).toContain('Đặt lại mật khẩu');
  });

  it('asks the server to send a reset link', async () => {
    await open('admin');
    button(rows()[1], 'Sửa').click();
    await settle();
    button(dialog() as HTMLElement, 'Đặt lại mật khẩu').click();
    await settle();
    const post = backend.expectOne(
      `/api/admin/users/${userListFixtures[1].id}/reset-password`,
    );
    post.flush({ sentTo: userListFixtures[1].email });
    await settle();
    expect(document.body.textContent).toContain(
      'Đã gửi liên kết đặt lại mật khẩu',
    );
  });
});
