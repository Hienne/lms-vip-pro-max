import { HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Profile } from '@lms/contracts';
import { demoAccountFixtures, envelopeOk, profileFixtures } from '@lms/mocks';
import { provideAppConfig } from '../../config/app-config';
import { testAppConfig } from '../../config/app-config.testing';
import { NetworkStore } from '../../network/network.store';
import { SessionStore } from '../../session/session.store';
import { MockScenario } from '../mock-scenario';
import { DevToolbar } from './dev-toolbar';
import { provideEnvelopeHttpClient } from '../../http/http.testing';

class FakeSession {
  readonly user = signal<Profile | null>(profileFixtures['learner']);
  readonly user$ = this.user.asReadonly();
  readonly isSignedIn$ = () => this.user() !== null;
  signInDemo = vi.fn();
  expire = vi.fn(() => this.user.set(null));
}

describe('DevToolbar', () => {
  let session: FakeSession;
  let backend: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(() => {
    sessionStorage.clear();
    session = new FakeSession();
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideRouter([]),
        provideAppConfig(testAppConfig({ mockApi: true })),
        { provide: SessionStore, useValue: session },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    el = TestBed.createComponent(DevToolbar).nativeElement as HTMLElement;
    document.body.append(el);
    TestBed.tick();
  });
  afterEach(() => {
    el.remove();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
    backend.verify();
  });

  const menu = () => document.querySelector<HTMLElement>('[role="menu"]');
  const items = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  const labels = () => items().map((i) => i.textContent?.trim());
  const item = (text: string) =>
    items().find((i) => i.textContent?.includes(text))!;

  async function open() {
    const wrapper = el.querySelector('.dev-toolbar')!;
    wrapper.dispatchEvent(new Event('pointerenter'));
    TestBed.tick();
    backend
      .expectOne('/api/auth/demo-accounts')
      .flush(envelopeOk(demoAccountFixtures));
    el.querySelector<HTMLButtonElement>('ui-menu button')?.click();
    TestBed.tick();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(menu()).not.toBeNull();
      expect(items().length).toBeGreaterThan(demoAccountFixtures.length);
    });
  }

  it('asks for nothing until it is touched', () => {
    backend.expectNone('/api/auth/demo-accounts');
    expect(el.querySelector('ui-menu button')?.textContent).toContain('Demo');
  });

  it('lists a quick sign-in per demo account and the incident simulations', async () => {
    await open();
    expect(labels()).toHaveLength(demoAccountFixtures.length + 4);
    expect(labels()).toContain('Mô phỏng mất kết nối');
    expect(labels()).toContain('Mô phỏng hết phiên đăng nhập');
    expect(labels()).toContain('Mở Design System');
    expect(menu()?.textContent).toContain('Đăng nhập nhanh theo vai trò');
    expect(item('Quản trị viên đơn vị')).toBeDefined();
  });

  it('switches role: remembers the example, signs in, then goes home and says so', async () => {
    await open();
    const unitAdmin = demoAccountFixtures.find(
      (a) => a.roleId === 'admin' && a.scopeUnitId,
    )!;
    item('Quản trị viên đơn vị').click();
    TestBed.tick();
    expect(TestBed.inject(MockScenario).role$()).toBe('unit-admin');
    expect(session.signInDemo).toHaveBeenCalledWith(unitAdmin.id);
    expect(router.navigateByUrl).not.toHaveBeenCalled();

    session.user.set({ ...profileFixtures['unit-admin'], id: unitAdmin.id });
    TestBed.tick();
    await vi.waitFor(() =>
      expect(router.navigateByUrl).toHaveBeenCalledWith('/'),
    );
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        'Đã chuyển sang Quản trị viên đơn vị',
      ),
    );
  });

  it('disables the account that is signed in', async () => {
    await open();
    const current = demoAccountFixtures.find(
      (a) => a.id === profileFixtures['learner'].id,
    )!;
    const row = items().find((i) => i.textContent?.includes(current.name));
    expect(row?.getAttribute('aria-disabled')).toBe('true');
  });

  it('switches the connection off and back on', async () => {
    await open();
    item('Mô phỏng mất kết nối').click();
    TestBed.tick();
    expect(TestBed.inject(NetworkStore).offline$()).toBe(true);
    el.querySelector<HTMLButtonElement>('ui-menu button')?.click();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(labels()).toContain('Bật lại kết nối mạng');
    });
    item('Bật lại kết nối mạng').click();
    TestBed.tick();
    expect(TestBed.inject(NetworkStore).offline$()).toBe(false);
  });

  it('ends the session and asks to sign in again where the user was', async () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/catalog?q=a');
    await open();
    item('Mô phỏng hết phiên đăng nhập').click();
    TestBed.tick();
    expect(session.expire).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { next: '/catalog?q=a' },
    });
  });

  it('tries an admin URL and opens the design system', async () => {
    await open();
    item('Thử truy cập URL quản trị').click();
    TestBed.tick();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/users');
    el.querySelector<HTMLButtonElement>('ui-menu button')?.click();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(menu()).not.toBeNull();
    });
    item('Mở Design System').click();
    TestBed.tick();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/design-system');
  });
});

describe('DevToolbar against a real backend', () => {
  it('offers no role list, since the role only drives the mock API', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideRouter([]),
        provideAppConfig(testAppConfig({ mockApi: false })),
        { provide: SessionStore, useValue: new FakeSession() },
      ],
    });
    const el = TestBed.createComponent(DevToolbar).nativeElement as HTMLElement;
    document.body.append(el);
    TestBed.tick();
    el.querySelector<HTMLButtonElement>('ui-menu button')?.click();
    TestBed.tick();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(document.querySelector('[role="menu"]')?.textContent).toContain(
        'Mô phỏng mất kết nối',
      );
    });
    expect(document.querySelector('[role="menu"]')?.textContent).not.toContain(
      'Đăng nhập nhanh theo vai trò',
    );
    el.remove();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
  });
});
