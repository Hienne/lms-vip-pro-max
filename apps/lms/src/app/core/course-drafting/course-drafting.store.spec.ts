import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  draftingSessionFixture,
  draftingStepFixture,
  envelopeOk,
} from '@lms/mocks';
import type { DraftingSession } from '@lms/contracts';
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { provideEnvelopeHttpClient } from '../http/http.testing';
import { SessionStore } from '../session/session.store';
import { FakeSessionStore } from '../session/session.testing';
import {
  CourseDraftingStore,
  DRAFTING_POLL_INTERVAL_MS,
} from './course-drafting.store';

const SESSION = '/api/v1/assistant/drafting-sessions/1';
const STOP = `${SESSION}/stop`;

const proposing = (): DraftingSession => ({
  ...draftingSessionFixture(1),
  steps: [draftingStepFixture(1, 'proposing')],
});

describe('CourseDraftingStore', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await Promise.resolve();
  }

  const reads = (): TestRequest[] =>
    backend.match((r) => r.url === SESSION && r.method === 'GET');

  async function open(session: DraftingSession) {
    const store = TestBed.inject(CourseDraftingStore);
    store.load(1);
    await settle();
    reads()[0].flush(envelopeOk(session));
    await settle();
    return store;
  }

  it('asks nothing until a session is loaded', async () => {
    TestBed.inject(CourseDraftingStore);
    await settle();
    vi.advanceTimersByTime(DRAFTING_POLL_INTERVAL_MS * 3);
    await settle();

    expect(reads()).toHaveLength(0);
  });

  it('reads the session and tells its current step', async () => {
    const store = await open(draftingSessionFixture(1));

    expect(store.session$()?.id).toBe(1);
    expect(store.step$()?.step).toBe(1);
    expect(store.step$()?.state).toBe('proposed');
    expect(store.isProposing$()).toBe(false);
  });

  it('asks again every few seconds while a step is proposing, and stops once it is proposed', async () => {
    const store = await open(proposing());
    expect(store.isProposing$()).toBe(true);

    vi.advanceTimersByTime(DRAFTING_POLL_INTERVAL_MS);
    await settle();
    const again = reads();
    expect(again).toHaveLength(1);
    again[0].flush(envelopeOk(draftingSessionFixture(1)));
    await settle();

    expect(store.step$()?.state).toBe('proposed');
    vi.advanceTimersByTime(DRAFTING_POLL_INTERVAL_MS * 3);
    await settle();
    expect(reads()).toHaveLength(0);
  });

  it('stops a proposing step and reads the session again', async () => {
    const store = await open(proposing());

    store.stop();
    await settle();
    backend
      .expectOne((r) => r.url === STOP && r.method === 'POST')
      .flush(
        envelopeOk({
          ...proposing(),
          steps: [draftingStepFixture(1, 'manual')],
        }),
      );
    await settle();
    reads()[0].flush(
      envelopeOk({ ...proposing(), steps: [draftingStepFixture(1, 'manual')] }),
    );
    await settle();

    expect(store.step$()?.state).toBe('manual');
    expect(store.isProposing$()).toBe(false);
  });

  it('does not call stop when nothing is proposing', async () => {
    const store = await open(draftingSessionFixture(1));

    store.stop();
    await settle();

    backend.expectNone((r) => r.url === STOP);
  });

  it('follows the session that drafted a course, and none when the course has none', async () => {
    const store = TestBed.inject(CourseDraftingStore);
    const forCourse = (courseId: number) =>
      backend.expectOne(
        (r) =>
          r.url === `/api/v1/assistant/drafting-sessions/course/${courseId}` &&
          r.method === 'GET',
      );

    store.loadForCourse(77);
    await settle();
    forCourse(77).flush(
      envelopeOk({ ...draftingSessionFixture(2), courseId: 77 }),
    );
    await settle();
    reads()[0].flush(
      envelopeOk({ ...draftingSessionFixture(2), courseId: 77 }),
    );
    await settle();
    expect(store.session$()?.courseId).toBe(77);
    expect(store.step$()?.step).toBe(2);

    store.loadForCourse(78);
    await settle();
    forCourse(78).flush(envelopeOk(null));
    await settle();
    expect(store.session$()).toBeUndefined();
  });

  it('confirms through the page that shows the session, and only that one', async () => {
    const store = await open(draftingSessionFixture(1));
    const confirm = vi.fn();

    expect(store.confirm(1)).toBe(false);
    const unregister = store.registerPageConfirm(2, confirm);
    expect(store.confirm(1)).toBe(false);
    unregister();
    store.registerPageConfirm(1, confirm);

    expect(store.confirm(1)).toBe(true);
    expect(confirm).toHaveBeenCalledExactlyOnceWith(1);
  });

  describe('"Đã chốt" on the chat card', () => {
    it('runs the confirm of the page that shows that session', () => {
      const store = TestBed.inject(CourseDraftingStore);
      const navigate = vi
        .spyOn(TestBed.inject(Router), 'navigateByUrl')
        .mockResolvedValue(true);
      const confirm = vi.fn();
      store.registerPageConfirm(7, confirm);

      store.confirmFromChat(7, 2, 40);

      expect(confirm).toHaveBeenCalledExactlyOnceWith(2);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('opens the draft course at that step when no page shows the session', () => {
      const store = TestBed.inject(CourseDraftingStore);
      const navigate = vi
        .spyOn(TestBed.inject(Router), 'navigateByUrl')
        .mockResolvedValue(true);
      const confirm = vi.fn();
      store.registerPageConfirm(8, confirm);

      store.confirmFromChat(7, 3, 40);

      expect(confirm).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledExactlyOnceWith(
        '/admin/courses/40/edit?step=2',
      );
    });

    it('opens the new course page of the session before step 1 made the course', () => {
      const store = TestBed.inject(CourseDraftingStore);
      const navigate = vi
        .spyOn(TestBed.inject(Router), 'navigateByUrl')
        .mockResolvedValue(true);

      store.confirmFromChat(7, 1, null);

      expect(navigate).toHaveBeenCalledExactlyOnceWith(
        '/admin/courses/new?session=7',
      );
    });
  });
});
