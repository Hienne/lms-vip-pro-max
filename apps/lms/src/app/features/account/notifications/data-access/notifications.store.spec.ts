import { TestBed } from '@angular/core/testing';
import { learnerEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import { NOW } from '@lms/ui';
import type { MockInstance } from 'vitest';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../../core/dev/mock-api/mock-backend.testing';
import { RemindersChanged } from '../../../../core/learning/reminders-changed';
import { SessionStore } from '../../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../../core/session/session.testing';
import { NotificationsStore } from './notifications.store';

describe('NotificationsStore', () => {
  let handle: MockInstance<MockBackend['handle']>;
  const original = (endpoint: unknown, request: unknown) =>
    MockBackend.prototype.handle.call(
      TestBed.inject(MockBackend),
      endpoint as never,
      request as never,
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: NOW, useValue: () => Date.now() },
        NotificationsStore,
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
    const store = TestBed.inject(NotificationsStore);
    await settle();
    return store;
  }

  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);
  const ids = (store: NotificationsStore) => store.items$().map((i) => i.id);

  it('lists the due reminders by due date, the soonest first, and counts them', async () => {
    const store = await open();
    expect(store.count$()).toBe(3);
    const due = store.items$().map((i) => i.reminder.dueAtSnapshot ?? '');
    expect(due).toEqual([...due].sort());
  });

  it('marks the overdue one by comparing its due date with the clock', async () => {
    const store = await open();
    const flags = store.items$().map((i) => i.isOverdue);
    expect(flags).toEqual([true, false, false]);
  });

  it('asks for nothing when the user has no COURSE_LEARNING function', async () => {
    const store = await open('quantri', '000002');
    expect(calls(learnerEndpoints.reminders)).toHaveLength(0);
    expect(store.items$()).toEqual([]);
    expect(store.loadError$()).toBeUndefined();
  });

  it('reads a 403 as an empty list, not an error', async () => {
    handle.mockImplementation((endpoint, request) =>
      endpoint === learnerEndpoints.reminders
        ? backendRefusal('accessDenied')
        : original(endpoint, request),
    );
    const store = await open();
    expect(store.items$()).toEqual([]);
    expect(store.loadError$()).toBeUndefined();
  });

  it('keeps any other failure as an error that retry reads again', async () => {
    handle.mockImplementation((endpoint, request) =>
      endpoint === learnerEndpoints.reminders
        ? backendRefusal('internalError')
        : original(endpoint, request),
    );
    const store = await open();
    expect(store.loadError$()).toBeTruthy();
    handle.mockImplementation(original);
    store.retry();
    await settle();
    expect(store.count$()).toBe(3);
  });

  it('removes a read reminder after the reload and tells the bell once', async () => {
    const store = await open();
    const changed = TestBed.inject(RemindersChanged);
    const [first, ...rest] = ids(store);
    store.markRead(first);
    await settle();
    expect(ids(store)).toEqual(rest);
    expect(changed.version()).toBe(1);
    expect(calls(learnerEndpoints.reminders)).toHaveLength(2);
  });

  it('marks every shown reminder in order, reloads once and tells the bell', async () => {
    const store = await open();
    const changed = TestBed.inject(RemindersChanged);
    const shown = ids(store);
    store.markAllRead();
    await settle();
    expect(
      calls(learnerEndpoints.markReminderRead).map(
        ([, r]) => r.params['reminderId'],
      ),
    ).toEqual(shown.map(String));
    expect(store.items$()).toEqual([]);
    expect(calls(learnerEndpoints.reminders)).toHaveLength(2);
    expect(changed.version()).toBe(1);
  });

  it('stops at the first refusal, keeps the ones it did mark and still reloads', async () => {
    handle.mockImplementation((endpoint, request) => {
      const call = calls(learnerEndpoints.markReminderRead).length;
      return endpoint === learnerEndpoints.markReminderRead && call === 2
        ? backendRefusal('internalError')
        : original(endpoint, request);
    });
    const store = await open();
    const shown = ids(store);
    store.markAllRead();
    await settle();
    expect(calls(learnerEndpoints.markReminderRead)).toHaveLength(2);
    expect(ids(store)).toEqual(shown.slice(1));
    expect(TestBed.inject(RemindersChanged).version()).toBe(1);
  });
});
