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
  userDetailFixture,
  userListFixtures,
  userNotFound,
} from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { SessionStore } from '../../../core/session/session.store';

describe('UserDetail', () => {
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

  async function open(detail = userDetailFixture, id = detail.user.id) {
    TestBed.inject(SessionStore).restore();
    await settle();
    backend.expectOne('/api/auth/profile').flush(profileFixtures['admin']);
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/admin/users/${id}`);
    await settle();
    backend.expectOne(`/api/admin/users/${id}`).flush(detail);
    backend.expectOne('/api/admin/meta').flush(adminMetaFixture);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    ) as HTMLButtonElement | undefined;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const alertDialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');
  const visiblePanel = () =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="tabpanel"]')).find(
      (p) => !p.hasAttribute('inert'),
    );

  async function selectTab(label: string) {
    Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'))
      .find((t) => t.textContent?.includes(label))
      ?.click();
    await settle();
  }

  it('shows the user with role, status and organisation', async () => {
    await open();
    const user = userDetailFixture.user;
    expect(el.querySelector('h1')?.textContent).toBe(user.name);
    expect(text()).toContain(user.email);
    expect(text()).toContain(`${user.unitName} / ${user.groupName}`);
    expect(
      el.querySelector('nav[aria-label="Đường dẫn"]')?.textContent,
    ).toContain('Người dùng');
  });

  it('lists the assigned courses first, with progress and the best score', async () => {
    await open();
    const panel = visiblePanel() as HTMLElement;
    expect(panel.querySelectorAll('tbody tr')).toHaveLength(
      userDetailFixture.courses.length,
    );
    expect(panel.textContent).toContain(userDetailFixture.courses[0].title);
    expect(panel.textContent).not.toContain('Gia hạn');
  });

  it('has no competency tab yet', async () => {
    await open();
    const labels = Array.from(el.querySelectorAll('[role="tab"]')).map((t) =>
      t.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(labels.join('|')).not.toContain('Năng lực');
    expect(labels).toHaveLength(4);
  });

  it('shows the quiz history on its tab', async () => {
    await open();
    await selectTab('Lịch sử thi');
    expect(visiblePanel()?.textContent).toContain(
      userDetailFixture.attempts[0].title,
    );
    expect(visiblePanel()?.textContent).toMatch(/Đạt|Chưa đạt/);
  });

  it('shows the role with the scope and the menus it grants', async () => {
    await open();
    await selectTab('Vai trò & menu');
    const panel = visiblePanel()?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(panel).toContain(userDetailFixture.role.name);
    expect(panel).toContain('Chỉ đơn vị: Ban QL&PT Core Banking');
    expect(panel).toContain('Trang chủ học tập');
    expect(panel).not.toContain('learn.home');
  });

  it('shows the account activity on its tab', async () => {
    await open();
    await selectTab('Hoạt động');
    expect(visiblePanel()?.textContent).toContain(
      userDetailFixture.audit[0].detail,
    );
  });

  it('locks the account after confirming, then reloads', async () => {
    await open();
    button(el, 'Khóa tài khoản')?.click();
    await settle();
    expect(alertDialog()?.textContent).toContain(
      `Khóa tài khoản ${userDetailFixture.user.name}?`,
    );
    button(alertDialog() as HTMLElement, 'Khóa tài khoản')?.click();
    await settle();
    const put = backend.expectOne(
      `/api/admin/users/${userDetailFixture.user.id}/status`,
    );
    expect(put.request.body).toEqual({ status: 'locked' });
    put.flush({ ...userDetailFixture.user, status: 'locked' });
    await settle();
    backend.expectOne(`/api/admin/users/${userDetailFixture.user.id}`).flush({
      ...userDetailFixture,
      user: { ...userDetailFixture.user, status: 'locked' },
    });
    await settle();
    expect(text()).toContain('Đã khóa');
    expect(button(el, 'Mở khóa')).toBeTruthy();
    expect(button(el, 'Khóa tài khoản')).toBeUndefined();
  });

  it('offers no lock on your own page', async () => {
    const self = userListFixtures.find(
      (u) => u.id === profileFixtures['admin'].id,
    ) as (typeof userListFixtures)[number];
    await open({ ...userDetailFixture, user: self });
    expect(button(el, 'Sửa')).toBeTruthy();
    expect(button(el, 'Khóa tài khoản')).toBeUndefined();
    expect(button(el, 'Mở khóa')).toBeUndefined();
  });

  it('opens the edit drawer prefilled with this user', async () => {
    await open();
    button(el, 'Sửa')?.click();
    await settle();
    expect(dialog()?.textContent).toContain(
      `Sửa ${userDetailFixture.user.name}`,
    );
    const name = dialog()?.querySelector<HTMLInputElement>('input');
    expect(name?.value).toBe(userDetailFixture.user.name);
  });

  it('says the user does not exist', async () => {
    TestBed.inject(SessionStore).restore();
    await settle();
    backend.expectOne('/api/auth/profile').flush(profileFixtures['admin']);
    await settle();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/users/nobody');
    await settle();
    backend
      .expectOne('/api/admin/users/nobody')
      .flush(userNotFound, { status: 404, statusText: 'Not Found' });
    backend.expectOne('/api/admin/meta').flush(adminMetaFixture);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
    expect(text()).toContain(userNotFound.message);
    expect(button(el, 'Thử lại')).toBeUndefined();
  });
});
