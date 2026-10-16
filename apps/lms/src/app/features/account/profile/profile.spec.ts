import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { envelopeError, envelopeOk, profileFixtures } from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SessionStore } from '../../../core/session/session.store';

describe('Profile', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
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

  async function open(role: keyof typeof profileFixtures = 'admin') {
    TestBed.inject(SessionStore).restore();
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures[role]));
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/profile');
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const input = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('ui-field'))
      .find((f) => f.textContent?.includes(label))
      ?.querySelector<HTMLInputElement>('input') as HTMLInputElement;

  async function type(field: HTMLInputElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  const submitOf = (title: string) =>
    Array.from(el.querySelectorAll('section'))
      .find((s) => s.textContent?.includes(title))
      ?.querySelector<HTMLButtonElement>('button[type="submit"]');

  it('shows who is signed in, with the organisation facts and the role', async () => {
    await open('admin');
    expect(el.querySelector('h1')?.textContent).toBe('Hồ sơ cá nhân');
    expect(text()).toContain(profileFixtures['admin'].name);
    expect(text()).toContain('Mã cán bộ CB1001');
    expect(text()).toContain('Phạm vi dữ liệuToàn hệ thống');
    expect(text()).toContain('Vai trò Quản trị viên');
    expect(input('Họ và tên').value).toBe(profileFixtures['admin'].name);
  });

  it('says "đơn vị" for an admin limited to one unit', async () => {
    await open('unit-admin');
    expect(text()).toContain('Vai trò Quản trị viên đơn vị');
  });

  it('lists the menus the role grants by their sidebar names', async () => {
    await open('viewer');
    const section = text().split('Menu được cấp')[1] ?? '';
    expect(section).toContain('Báo cáo');
    expect(section).not.toContain('Người dùng');
  });

  it('saves the personal fields, then reloads the profile', async () => {
    await open('admin');
    await type(input('Họ và tên'), '  Phạm Trang  ');
    await type(input('Chức danh'), 'Trưởng nhóm');
    submitOf('Thông tin cá nhân')?.click();
    await settle();
    const put = backend.expectOne('/api/auth/profile');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      name: 'Phạm Trang',
      title: 'Trưởng nhóm',
    });
    put.flush(envelopeOk(profileFixtures['admin']));
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk({ ...profileFixtures['admin'], name: 'Phạm Trang' }));
    await settle();
    expect(input('Họ và tên').value).toBe('Phạm Trang');
    expect(document.body.textContent).toContain('Đã lưu hồ sơ');
  });

  it('refuses a name that is too short before calling the server', async () => {
    await open('admin');
    await type(input('Họ và tên'), 'A');
    submitOf('Thông tin cá nhân')?.click();
    await settle();
    backend.expectNone('/api/auth/profile');
    expect(text()).toContain('Họ tên tối thiểu 2 ký tự.');
  });

  it('toasts the backend message when a profile save is refused, and keeps the form', async () => {
    await open('admin');
    await type(input('Họ và tên'), 'Phạm Trang');
    submitOf('Thông tin cá nhân')?.click();
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(
        envelopeError(
          'CORE-0422',
          'Không lưu được hồ sơ',
          'Họ tên không hợp lệ.',
        ),
      );
    await settle();
    backend.expectNone('/api/auth/profile');
    expect(document.body.textContent).toContain('Không lưu được hồ sơ');
    expect(document.body.textContent).toContain('Họ tên không hợp lệ.');
    expect(document.body.textContent).not.toContain('Đã lưu hồ sơ');
    expect(input('Họ và tên').value).toBe('Phạm Trang');
  });

  it('checks the confirmation locally and sends the three fields otherwise', async () => {
    await open('admin');
    await type(input('Mật khẩu hiện tại'), 'abc123');
    await type(input('Mật khẩu mới'), 'Abcdef12');
    await type(input('Nhập lại mật khẩu mới'), 'Abcdef13');
    submitOf('Đổi mật khẩu')?.click();
    await settle();
    backend.expectNone('/api/auth/change-password');
    expect(text()).toContain('Mật khẩu nhập lại không khớp.');

    await type(input('Nhập lại mật khẩu mới'), 'Abcdef12');
    submitOf('Đổi mật khẩu')?.click();
    await settle();
    const post = backend.expectOne('/api/auth/change-password');
    expect(post.request.body).toEqual({
      cur: 'abc123',
      next: 'Abcdef12',
      confirm: 'Abcdef12',
    });
    post.flush(envelopeOk(true));
    await settle();
    expect(document.body.textContent).toContain('Đã đổi mật khẩu');
    expect(input('Mật khẩu hiện tại').value).toBe('');
    expect(input('Mật khẩu mới').value).toBe('');
  });

  it('toasts the backend message when a password change is refused, and keeps the fields', async () => {
    await open('admin');
    await type(input('Mật khẩu hiện tại'), 'abc123');
    await type(input('Mật khẩu mới'), 'weak');
    await type(input('Nhập lại mật khẩu mới'), 'weak');
    submitOf('Đổi mật khẩu')?.click();
    await settle();
    backend
      .expectOne('/api/auth/change-password')
      .flush(
        envelopeError(
          'CORE-0422',
          'Không đổi được mật khẩu',
          'Tối thiểu 8 ký tự, gồm chữ hoa và chữ số.',
        ),
      );
    await settle();
    expect(document.body.textContent).toContain('Không đổi được mật khẩu');
    expect(document.body.textContent).toContain(
      'Tối thiểu 8 ký tự, gồm chữ hoa và chữ số.',
    );
    expect(document.body.textContent).not.toContain('Đã đổi mật khẩu');
    expect(input('Mật khẩu hiện tại').value).toBe('abc123');
    expect(input('Mật khẩu mới').value).toBe('weak');
    expect(input('Nhập lại mật khẩu mới').value).toBe('weak');
  });
});
