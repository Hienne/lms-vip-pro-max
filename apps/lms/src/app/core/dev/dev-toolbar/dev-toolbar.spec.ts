import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideAppConfig } from '../../config/app-config';
import { testAppConfig } from '../../config/app-config.testing';
import { NetworkStore } from '../../network/network.store';
import { SessionStore } from '../../session/session.store';
import { seedProfile } from '../../session/session.testing';
import type { Profile } from '../../session/profile';
import { provideEnvelopeHttpClient } from '../../http/http.testing';
import { DevToolbar } from './dev-toolbar';

class FakeSession {
  readonly user = signal<Profile | null>(seedProfile('000004'));
  readonly user$ = this.user.asReadonly();
  readonly isSignedIn$ = () => this.user() !== null;
  expire = vi.fn(() => this.user.set(null));
}

describe('DevToolbar', () => {
  let session: FakeSession;
  let router: Router;
  let el: HTMLElement;

  function create(config: Parameters<typeof testAppConfig>[0]) {
    session = new FakeSession();
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideRouter([]),
        provideAppConfig(testAppConfig(config)),
        { provide: SessionStore, useValue: session },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    el = TestBed.createComponent(DevToolbar).nativeElement as HTMLElement;
    document.body.append(el);
    TestBed.tick();
  }
  afterEach(() => {
    el.remove();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
  });

  const menu = () => document.querySelector<HTMLElement>('[role="menu"]');
  const items = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  const labels = () => items().map((i) => i.textContent?.trim());
  const item = (text: string) =>
    items().find((i) => i.textContent?.includes(text))!;

  async function open() {
    el.querySelector<HTMLButtonElement>('ui-menu button')?.click();
    TestBed.tick();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(menu()).not.toBeNull();
    });
  }

  describe('the menu', () => {
    beforeEach(() => create({ mockApi: true }));

    it('lists the incident simulations and offers no demo accounts', async () => {
      await open();
      expect(labels()).toHaveLength(4);
      expect(menu()?.textContent).not.toContain('tài khoản demo');
      expect(labels()).toContain('Mô phỏng mất kết nối');
      expect(labels()).toContain('Mở Design System');
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
      await open();
      item('Mở Design System').click();
      TestBed.tick();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/design-system');
    });
  });
});
