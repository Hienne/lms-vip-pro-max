import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import type { MockInstance } from 'vitest';
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
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';

describe('Notifications', () => {
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

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  async function open(username = 'hocvien', userId = '000004') {
    signInToMockBackend(username);
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/notifications');
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const items = () => Array.from(el.querySelectorAll('li'));
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) =>
        b.textContent?.includes(label) ||
        b.getAttribute('aria-label') === label,
    );

  describe('a learner with three due reminders', () => {
    beforeEach(() => open());

    it('has the heading and lists one item per reminder, the soonest due first', () => {
      expect(el.querySelector('h1')?.textContent).toContain('Thông báo');
      expect(items()).toHaveLength(3);
      const dates = items().map(
        (li) => li.textContent?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0],
      );
      expect(dates.every(Boolean)).toBe(true);
    });

    it('says "đã quá hạn" and colours the date only on the overdue item', () => {
      const [overdue, ...upcoming] = items();
      expect(overdue.textContent).toContain('Khóa học được giao đã quá hạn');
      expect(
        overdue.querySelector('.notifications__due--overdue'),
      ).not.toBeNull();
      for (const li of upcoming) {
        expect(li.textContent).toContain('Khóa học được giao sắp đến hạn');
        expect(li.querySelector('.notifications__due--overdue')).toBeNull();
      }
    });

    it('links each item to the progress table by due date, with overdue only on the overdue one', () => {
      const hrefs = items().map((li) =>
        li.querySelector('a')?.getAttribute('href'),
      );
      expect(hrefs[0]).toBe('/progress?sort=dueAt,asc&overdue=true');
      expect(hrefs[1]).toBe('/progress?sort=dueAt,asc');
    });

    it('offers "Đánh dấu đã đọc" on every item as a native button, and one for all', () => {
      for (const li of items()) {
        const read = li.querySelector('button');
        expect(read?.getAttribute('aria-label')).toBe('Đánh dấu đã đọc');
        expect(read?.tabIndex).toBe(0);
      }
      expect(button('Đánh dấu đã đọc tất cả')).toBeTruthy();
    });

    it('removes a read item and shows no toast: the item leaving is the feedback', async () => {
      items()[0].querySelector('button')!.click();
      await settle();
      expect(items()).toHaveLength(2);
      expect(
        document.body.querySelector('ui-toaster [role=status]'),
      ).toBeNull();
    });

    it('marks all of them, in order, and shows the empty line', async () => {
      button('Đánh dấu đã đọc tất cả')!.click();
      await settle();
      expect(
        handle.mock.calls.filter(
          ([e]) => e === learnerEndpoints.markReminderRead,
        ),
      ).toHaveLength(3);
      expect(text()).toContain('Không có nhắc hạn nào.');
      expect(button('Đánh dấu đã đọc tất cả')).toBeUndefined();
    });
  });

  describe('someone who is not a learner', () => {
    it('sees the empty line, no error and no request', async () => {
      await open('quantri', '000002');
      expect(text()).toContain('Không có nhắc hạn nào.');
      expect(el.querySelector('ui-error-state')).toBeNull();
      expect(
        handle.mock.calls.filter(([e]) => e === learnerEndpoints.reminders),
      ).toHaveLength(0);
    });
  });

  describe('a failed read', () => {
    it('shows the error with a retry that lists the reminders once the server answers', async () => {
      const backend = TestBed.inject(MockBackend);
      const original: MockBackend['handle'] = (endpoint, request) =>
        MockBackend.prototype.handle.call(backend, endpoint, request);
      handle.mockImplementation((endpoint, request) =>
        endpoint === learnerEndpoints.reminders
          ? backendRefusal('internalError')
          : original(endpoint, request),
      );
      await open();
      expect(text()).toContain('Không tải được thông báo');
      handle.mockImplementation(original);
      button('Thử lại')!.click();
      await settle();
      expect(items()).toHaveLength(3);
    });
  });
});
