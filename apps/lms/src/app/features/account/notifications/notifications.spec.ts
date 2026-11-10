import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { feedbackEndpoints, learnerEndpoints } from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
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

  describe('a learner with a badge notice and a level notice', () => {
    beforeEach(() => open('hocvien.tichhop', '000007'));

    it('lists the newest notice first, each with its own copy', () => {
      expect(items()).toHaveLength(2);
      expect(items()[0].textContent).toContain('Bạn lên cấp mới');
      expect(items()[0].textContent).toContain(
        'Bạn đã đạt cấp Giao dịch viên.',
      );
      expect(items()[1].textContent).toContain('Bạn đạt huy hiệu mới');
      expect(items()[1].textContent).toContain('Huy hiệu Khóa học đầu tiên.');
    });

    it('links a notice to the profile and never calls it overdue', () => {
      for (const li of items()) {
        expect(li.querySelector('a')?.getAttribute('href')).toBe('/profile');
        expect(li.textContent).not.toContain('quá hạn');
        expect(li.querySelector('.reminder-item__due--overdue')).toBeNull();
      }
    });

    it('keeps the notice as read under the unread one', async () => {
      items()[0].querySelector('button')!.click();
      await settle();
      expect(items()).toHaveLength(2);
      expect(items()[0].textContent).toContain('Bạn đạt huy hiệu mới');
      expect(items()[1].textContent).toContain('Đã đọc');
    });
  });

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
        overdue.querySelector('.reminder-item__due--overdue'),
      ).not.toBeNull();
      for (const li of upcoming) {
        expect(li.textContent).toContain('Khóa học được giao sắp đến hạn');
        expect(li.querySelector('.reminder-item__due--overdue')).toBeNull();
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

    it('clears the unread highlight without removing the item', async () => {
      items()[0].querySelector('button')!.click();
      await settle();
      expect(items()).toHaveLength(3);
      expect(el.querySelectorAll('.notifications__item--unread')).toHaveLength(
        2,
      );
      expect(items().at(-1)?.textContent).toContain('Đã đọc');
      expect(
        document.body.querySelector('ui-toaster [role=status]'),
      ).toBeNull();
    });

    it('marks them all while keeping the read history', async () => {
      button('Đánh dấu đã đọc tất cả')!.click();
      await settle();
      expect(
        handle.mock.calls.filter(
          ([e]) => e === learnerEndpoints.markReminderRead,
        ),
      ).toHaveLength(3);
      expect(items()).toHaveLength(3);
      expect(el.querySelectorAll('.notifications__item--unread')).toHaveLength(
        0,
      );
      expect(text()).toContain('0 chưa đọc');
      expect(button('Đánh dấu đã đọc tất cả')).toBeUndefined();
    });

    it('deletes only after confirmation and leaves other notifications in the inbox', async () => {
      const deletions = () =>
        handle.mock.calls.filter(
          ([e]) => e === learnerEndpoints.deleteReminder,
        );
      const deleteButton = () =>
        items()[0].querySelector<HTMLButtonElement>(
          'button[aria-label="Xóa thông báo"]',
        )!;
      const dialogButton = (label: string) =>
        Array.from(
          document.body.querySelectorAll<HTMLButtonElement>(
            'ui-confirm-dialog button',
          ),
        ).find((node) => node.textContent?.trim() === label)!;

      deleteButton().click();
      await settle();
      expect(deletions()).toHaveLength(0);
      dialogButton('Hủy').click();
      await settle();
      expect(deletions()).toHaveLength(0);

      deleteButton().click();
      await settle();
      dialogButton('Xóa thông báo').click();
      await settle();
      expect(deletions()).toHaveLength(1);
      expect(items()).toHaveLength(2);
      expect(el.querySelectorAll('.notifications__item--unread')).toHaveLength(
        2,
      );
    });
  });

  describe('someone who is not a learner', () => {
    it('sees no reminders and no request for them, only the questions of learners', async () => {
      const original: MockBackend['handle'] = (endpoint, request) =>
        MockBackend.prototype.handle.call(
          TestBed.inject(MockBackend),
          endpoint,
          request,
        );
      handle.mockImplementation((endpoint, request) =>
        endpoint === feedbackEndpoints.instructorFeedback
          ? {
              status: 200,
              body: envelopeOk({
                items: [],
                page: 0,
                size: 10,
                totalElements: 0,
                totalPages: 0,
              }),
            }
          : original(endpoint, request),
      );
      await open('quantri', '000002');
      expect(text()).toContain('Câu hỏi của học viên');
      expect(text()).toContain('Không có câu hỏi nào chờ trả lời.');
      expect(text()).not.toContain('Không có nhắc hạn nào.');
      expect(el.querySelector('ui-error-state')).toBeNull();
      expect(
        handle.mock.calls.filter(([e]) => e === learnerEndpoints.reminderInbox),
      ).toHaveLength(0);
    });
  });

  describe('a failed read', () => {
    it('shows the error with a retry that lists the reminders once the server answers', async () => {
      const backend = TestBed.inject(MockBackend);
      const original: MockBackend['handle'] = (endpoint, request) =>
        MockBackend.prototype.handle.call(backend, endpoint, request);
      handle.mockImplementation((endpoint, request) =>
        endpoint === learnerEndpoints.reminderInbox
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
