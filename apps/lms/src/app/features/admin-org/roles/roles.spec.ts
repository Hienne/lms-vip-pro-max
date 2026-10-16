import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  deleteRoleInvalid,
  profileFixtures,
  roleFixtures,
  saveRoleInvalid,
} from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { SessionStore } from '../../../core/session/session.store';

describe('Roles', () => {
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

  async function open() {
    TestBed.inject(SessionStore).restore();
    await settle();
    backend.expectOne('/api/auth/profile').flush(profileFixtures['admin']);
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/roles');
    await settle();
    backend.expectOne('/api/admin/roles').flush(roleFixtures);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) =>
        b.textContent?.includes(label) ||
        b.getAttribute('aria-label')?.includes(label),
    ) as HTMLButtonElement | undefined;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const alertDialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');
  const card = (name: string) =>
    Array.from(el.querySelectorAll('article')).find(
      (a) => a.querySelector('h2')?.textContent === name,
    ) as HTMLElement;
  const box = (label: string) =>
    Array.from(
      dialog()?.querySelectorAll<HTMLLabelElement>('label.role-form__option') ??
        [],
    )
      .find((l) => l.textContent?.includes(label))
      ?.querySelector('input') as HTMLInputElement;
  const inputOf = (label: string) =>
    Array.from(dialog()?.querySelectorAll<HTMLElement>('ui-field') ?? [])
      .find((f) => f.querySelector('label')?.textContent?.includes(label))
      ?.querySelector('input, textarea') as HTMLInputElement;

  async function type(field: HTMLInputElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }
  async function check(input: HTMLInputElement, on: boolean) {
    input.checked = on;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  const [learner, , admin, , custom] = roleFixtures;

  it('lists every role with its kind, users and menus by their sidebar names', async () => {
    await open();
    expect(el.querySelector('h1')?.textContent).toBe('Vai trò & phân quyền');
    expect(el.querySelectorAll('article')).toHaveLength(roleFixtures.length);
    expect(card(learner.name).textContent).toContain('Hệ thống');
    expect(card(learner.name).textContent).toContain(
      `${learner.userCount} người dùng`,
    );
    expect(card(learner.name).textContent).toContain('Trang chủ học tập');
    expect(card(custom.name).textContent).toContain('Tùy chỉnh');
    expect(card(custom.name).textContent).toContain('Khóa học');
  });

  it('locks the admin role: no edit and no delete', async () => {
    await open();
    expect(card(admin.name).textContent).toContain('Đã khóa');
    expect(button(card(admin.name), 'Sửa')).toBeUndefined();
    expect(button(card(admin.name), 'Xóa')).toBeUndefined();
  });

  it('lets the other system roles be edited but not deleted', async () => {
    await open();
    expect(button(card(learner.name), 'Sửa')).toBeTruthy();
    expect(button(card(learner.name), 'Xóa')).toBeUndefined();
  });

  it('disables deleting a custom role that users still hold', async () => {
    const held = { ...custom, userCount: 2 };
    TestBed.inject(SessionStore).restore();
    await settle();
    backend.expectOne('/api/auth/profile').flush(profileFixtures['admin']);
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/roles');
    await settle();
    backend
      .expectOne('/api/admin/roles')
      .flush(roleFixtures.map((r) => (r.id === held.id ? held : r)));
    await settle();
    el = harness.routeNativeElement as HTMLElement;
    expect(button(card(held.name), 'Xóa')?.disabled).toBe(true);
    expect(card(held.name).textContent).toContain('chưa xóa được');
  });

  it('offers the sidebar menus by section, with the role’s own ticked', async () => {
    await open();
    button(card(custom.name), 'Sửa')?.click();
    await settle();
    expect(dialog()?.textContent).toContain(`Sửa vai trò ${custom.name}`);
    expect(inputOf('Tên vai trò').value).toBe(custom.name);
    expect(dialog()?.querySelectorAll('input[type=checkbox]')).toHaveLength(22);
    expect(box('Khóa học').checked).toBe(true);
    expect(box('Người dùng').checked).toBe(false);
  });

  it('adds a role: checks the name locally, then sends name, description and menus', async () => {
    await open();
    button(el, 'Thêm vai trò')?.click();
    await settle();
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    backend.expectNone('/api/admin/roles');
    expect(dialog()?.textContent).toContain('Nhập tên vai trò.');
    await type(inputOf('Tên vai trò'), ' Kiểm soát ');
    await type(inputOf('Mô tả'), 'Xem báo cáo');
    await check(box('Báo cáo'), true);
    await check(box('Người dùng'), true);
    await check(box('Người dùng'), false);
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    const post = backend.expectOne('/api/admin/roles');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      name: 'Kiểm soát',
      description: 'Xem báo cáo',
      menus: ['reports'],
    });
    post.flush(custom);
    await settle();
    expect(dialog()).toBeNull();
    backend.expectOne('/api/admin/roles').flush(roleFixtures);
    await settle();
    expect(document.body.textContent).toContain('Đã thêm vai trò');
  });

  it('edits a role and sends its id with the changed menus', async () => {
    await open();
    button(card(custom.name), 'Sửa')?.click();
    await settle();
    await check(box('Khóa học'), false);
    await check(box('Nhập dữ liệu'), true);
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    const post = backend.expectOne('/api/admin/roles');
    expect(post.request.body.id).toBe(custom.id);
    expect([...post.request.body.menus].sort()).toEqual(
      [
        ...custom.menus.filter((m: string) => m !== 'content.courses'),
        'content.import',
      ].sort(),
    );
    post.flush(custom);
    await settle();
    backend.expectOne('/api/admin/roles').flush(roleFixtures);
    await settle();
  });

  it('keeps the drawer open and shows the 422 message on the name', async () => {
    await open();
    button(el, 'Thêm vai trò')?.click();
    await settle();
    await type(inputOf('Tên vai trò'), learner.name);
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    backend
      .expectOne('/api/admin/roles')
      .flush(saveRoleInvalid, { status: 422, statusText: 'Invalid' });
    await settle();
    expect(dialog()?.textContent).toContain('Tên vai trò đã tồn tại.');
  });

  it('keeps the drawer open on Escape while saving, and closes it after the response', async () => {
    await open();
    button(el, 'Thêm vai trò')?.click();
    await settle();
    await type(inputOf('Tên vai trò'), 'Kiểm soát');
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    const post = backend.expectOne('/api/admin/roles');
    expect(dialog()?.textContent).toContain('Đang lưu…');

    dialog()?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    );
    await settle();
    expect(dialog()).not.toBeNull();

    post.flush(custom);
    await settle();
    expect(dialog()).toBeNull();
    backend.expectOne('/api/admin/roles').flush(roleFixtures);
    await settle();
  });

  it('deletes a custom role after confirming, then reloads', async () => {
    await open();
    button(card(custom.name), 'Xóa')?.click();
    await settle();
    expect(alertDialog()?.textContent).toContain(`Xóa vai trò ${custom.name}?`);
    backend.expectNone(`/api/admin/roles/${custom.id}`);
    button(alertDialog() as HTMLElement, 'Xóa')?.click();
    await settle();
    const del = backend.expectOne(`/api/admin/roles/${custom.id}`);
    expect(del.request.method).toBe('DELETE');
    del.flush(true);
    await settle();
    backend.expectOne('/api/admin/roles').flush(roleFixtures);
    await settle();
    expect(document.body.textContent).toContain('Đã xóa vai trò');
  });

  it('shows the server’s refusal when the role turns out to be in use', async () => {
    await open();
    button(card(custom.name), 'Xóa')?.click();
    await settle();
    button(alertDialog() as HTMLElement, 'Xóa')?.click();
    await settle();
    backend
      .expectOne(`/api/admin/roles/${custom.id}`)
      .flush(deleteRoleInvalid, { status: 422, statusText: 'Invalid' });
    await settle();
    expect(document.body.textContent).toContain(deleteRoleInvalid.message);
    expect(text()).toContain(custom.name);
  });

  it('does not delete when the confirmation is cancelled', async () => {
    await open();
    button(card(custom.name), 'Xóa')?.click();
    await settle();
    button(alertDialog() as HTMLElement, 'Hủy')?.click();
    await settle();
    backend.expectNone((req) => req.method === 'DELETE');
  });
});
