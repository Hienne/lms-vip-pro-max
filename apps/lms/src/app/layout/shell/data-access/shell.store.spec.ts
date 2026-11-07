import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { envelopeError, envelopeOk } from '@lms/mocks';
import { Toaster } from '@lms/ui';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { RemindersChanged } from '../../../core/learning/reminders-changed';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { ShellStore } from './shell.store';

const REMINDERS = '/api/v1/me/learning/reminders';
const NAV_COUNTS = '/api/me/nav-counts';

const reminder = (id: number) => ({
  id,
  recipientId: 40 + id,
  kind: 'DEADLINE',
  scheduledAt: '2026-10-26T09:00:00',
  dueAtSnapshot: '2026-10-30T17:00:00',
  status: 'pending',
  rowVersion: 0,
});

describe('ShellStore: the bell count', () => {
  let backend: HttpTestingController;
  let router: Router;

  function configure(mockApi: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig({ mockApi }))),
        provideRouter(createAppRoutes({ devTools: true })),
        provideEnvelopeHttpClient(),
        { provide: SessionStore, useClass: FakeSessionStore },
        ShellStore,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  }

  const pending = (url: string) =>
    backend.match(url).filter((request) => !request.cancelled);

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  async function start(userId: string) {
    fakeSession().user.set(seedProfile(userId));
    const store = TestBed.inject(ShellStore);
    await router.navigateByUrl('/learn');
    await settle();
    return store;
  }

  describe('while navCounts is served (the mock API is on)', () => {
    it('is the nav counts and never asks for reminders', async () => {
      configure(true);
      const store = await start('000004');
      expect(pending(REMINDERS)).toHaveLength(0);
      pending(NAV_COUNTS).forEach((r) =>
        r.flush(envelopeOk({ notifications: 2, inbox: 0 })),
      );
      await settle();
      expect(store.unread$()).toBe(2);
    });
  });

  describe('while navCounts is not served', () => {
    beforeEach(() => configure(false));

    describe('the notices of a badge or a level', () => {
      const notice = (id: number, kind: string, sentAt: string | null) => ({
        ...reminder(id),
        recipientId: null,
        kind,
        subject: kind === 'LEVEL_UP' ? 'Giao dịch viên' : 'Khóa học đầu tiên',
        sentAt,
      });
      const toasts = () => TestBed.inject(Toaster).toasts();

      it('shows one gentle toast for each unseen notice, tells the server, and counts them in the bell', async () => {
        const store = await start('000004');
        pending(REMINDERS).forEach((r) =>
          r.flush(
            envelopeOk([
              reminder(1),
              notice(2, 'BADGE_EARNED', null),
              notice(3, 'LEVEL_UP', null),
              notice(4, 'LEVEL_UP', '2026-11-07T08:00:00Z'),
            ]),
          ),
        );
        await settle();
        expect(toasts().map((toast) => toast.title)).toEqual([
          'Bạn đạt huy hiệu mới',
          'Bạn lên cấp mới',
        ]);
        expect(toasts().every((toast) => toast.kind === 'info')).toBe(true);
        const seen = [2, 3].map((id) =>
          backend.expectOne(`${REMINDERS}/${id}/seen`),
        );
        seen.forEach((request) => request.flush(envelopeOk(reminder(1))));
        expect(store.unread$()).toBe(4);
      });

      it('does not show the same toast again when the bell reloads', async () => {
        await start('000004');
        pending(REMINDERS).forEach((r) =>
          r.flush(envelopeOk([notice(2, 'BADGE_EARNED', null)])),
        );
        await settle();
        backend.expectOne(`${REMINDERS}/2/seen`).flush(envelopeOk(reminder(1)));
        TestBed.inject(RemindersChanged).bump();
        await settle();
        pending(REMINDERS).forEach((r) =>
          r.flush(envelopeOk([notice(2, 'BADGE_EARNED', null)])),
        );
        await settle();
        expect(toasts()).toHaveLength(1);
        backend.expectNone(`${REMINDERS}/2/seen`);
      });

      it('shows no toast for a deadline reminder', async () => {
        await start('000004');
        pending(REMINDERS).forEach((r) => r.flush(envelopeOk([reminder(1)])));
        await settle();
        expect(toasts()).toHaveLength(0);
      });
    });

    it("is the length of the learner's due reminders", async () => {
      const store = await start('000004');
      expect(pending(NAV_COUNTS)).toHaveLength(0);
      pending(REMINDERS).forEach((r) =>
        r.flush(envelopeOk([reminder(1), reminder(2), reminder(3)])),
      );
      await settle();
      expect(store.unread$()).toBe(3);
    });

    it('does not ask a user without COURSE_LEARNING, and shows 0', async () => {
      const store = await start('000002');
      expect(pending(REMINDERS)).toHaveLength(0);
      expect(store.unread$()).toBe(0);
    });

    it('reads a 403 as 0, without telling the user', async () => {
      const store = await start('000004');
      pending(REMINDERS).forEach((r) =>
        r.flush(
          envelopeError('CORE-ACCESS_DENIED', 'Không đủ quyền', 'Bị từ chối.'),
          { status: 403, statusText: 'Forbidden' },
        ),
      );
      await settle();
      expect(store.unread$()).toBe(0);
    });

    it('reads any other failure as 0 too', async () => {
      const store = await start('000004');
      pending(REMINDERS).forEach((r) => r.error(new ProgressEvent('error')));
      await settle();
      expect(store.unread$()).toBe(0);
    });

    it('asks again after a navigation', async () => {
      const store = await start('000004');
      pending(REMINDERS).forEach((r) => r.flush(envelopeOk([reminder(1)])));
      await settle();
      expect(store.unread$()).toBe(1);

      await router.navigateByUrl('/catalog');
      await settle();
      const again = pending(REMINDERS);
      expect(again).toHaveLength(1);
      again[0].flush(envelopeOk([]));
      await settle();
      expect(store.unread$()).toBe(0);
    });

    it('keeps the last count while the next read runs, so the bell does not blink', async () => {
      const store = await start('000004');
      pending(REMINDERS).forEach((r) =>
        r.flush(envelopeOk([reminder(1), reminder(2)])),
      );
      await settle();
      expect(store.unread$()).toBe(2);
      await router.navigateByUrl('/catalog');
      await settle();
      expect(store.unread$()).toBe(2);
      pending(REMINDERS).forEach((r) => r.flush(envelopeOk([reminder(1)])));
    });

    it('asks again when a reminder is read, without a navigation', async () => {
      const store = await start('000004');
      pending(REMINDERS).forEach((r) =>
        r.flush(envelopeOk([reminder(1), reminder(2)])),
      );
      await settle();
      TestBed.inject(RemindersChanged).bump();
      await settle();
      const again = pending(REMINDERS);
      expect(again).toHaveLength(1);
      again[0].flush(envelopeOk([reminder(2)]));
      await settle();
      expect(store.unread$()).toBe(1);
    });
  });
});
