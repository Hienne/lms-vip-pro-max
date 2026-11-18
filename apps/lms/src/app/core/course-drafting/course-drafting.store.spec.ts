import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  draftingSessionFixture,
  draftingStepFixture,
  envelopeOk,
} from '@lms/mocks';
import type { DraftingSession } from '@lms/contracts';
import { AgentChatStore } from '../assistant/agent-chat.store';
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
  const chat = {
    conversationId$: signal<number | null>(null),
    isOpen$: signal(false),
    isAnswering$: signal(false),
    reloadConversation: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    chat.conversationId$.set(null);
    chat.isOpen$.set(false);
    chat.isAnswering$.set(false);
    chat.reloadConversation.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        provideRouter([]),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
        { provide: AgentChatStore, useValue: chat },
        // Provided by the shell in the app.
        CourseDraftingStore,
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

  /** An editor page shows session 1. */
  const editorPage = signal<number | undefined>(1);

  async function open(session: DraftingSession, shownInEditor = true) {
    const store = TestBed.inject(CourseDraftingStore);
    if (shownInEditor) store.showInEditor(editorPage);
    else store.follow(1);
    await settle();
    reads()[0].flush(envelopeOk(session));
    await settle();
    return store;
  }

  const poll = async () => {
    vi.advanceTimersByTime(DRAFTING_POLL_INTERVAL_MS);
    await settle();
    return reads();
  };

  it('asks nothing until a session is followed', async () => {
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

  it('asks again every few seconds while the editor shows a proposing step, and stops once it is proposed', async () => {
    const store = await open(proposing());
    expect(store.isProposing$()).toBe(true);

    const again = await poll();
    expect(again).toHaveLength(1);
    again[0].flush(envelopeOk(draftingSessionFixture(1)));
    await settle();

    expect(store.step$()?.state).toBe('proposed');
    vi.advanceTimersByTime(DRAFTING_POLL_INTERVAL_MS * 3);
    await settle();
    expect(reads()).toHaveLength(0);
  });

  it('stops asking once the editor page is left and no chat card shows the session', async () => {
    const store = await open(proposing());

    store.leaveEditor(editorPage);
    await settle();

    expect(store.sessionId$()).toBe(1);
    expect(await poll()).toHaveLength(0);
  });

  it('asks while the chat panel is open on the conversation that started the session', async () => {
    chat.conversationId$.set(5);
    const store = await open({ ...proposing(), conversationId: 5 }, false);
    expect(await poll()).toHaveLength(0);

    chat.isOpen$.set(true);
    await settle();

    expect(store.isProposing$()).toBe(true);
    expect(await poll()).toHaveLength(1);
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

  describe('"Đã chốt" on the chat card', () => {
    const card = {
      sessionId: 1,
      step: 2 as const,
      state: 'proposed' as const,
      courseId: 40,
    };

    it('asks the editor page that shows the session to confirm it', async () => {
      const store = await open(draftingSessionFixture(1));
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

      store.confirmFromChat(card);

      expect(store.confirmRequest$()).toEqual({ sessionId: 1, step: 2 });
      expect(navigate).not.toHaveBeenCalled();
      store.confirmRequestTaken();
      expect(store.confirmRequest$()).toBeNull();
    });

    it('opens the editor at that step when no page shows the session', async () => {
      const store = TestBed.inject(CourseDraftingStore);
      const navigate = vi
        .spyOn(TestBed.inject(Router), 'navigateByUrl')
        .mockResolvedValue(true);

      store.confirmFromChat(card);
      store.openEditor({ ...card, courseId: null, step: 1 });

      expect(store.confirmRequest$()).toBeNull();
      expect(navigate.mock.calls.map(([url]) => url)).toEqual([
        '/admin/courses/40/edit?step=1',
        '/admin/courses/new?session=1',
      ]);
    });
  });

  describe('the conversation that started the session', () => {
    it('is read again when a step of the session moves on, once per change', async () => {
      chat.conversationId$.set(5);
      const store = await open({ ...proposing(), conversationId: 5 });
      expect(chat.reloadConversation).toHaveBeenCalledExactlyOnceWith(5);

      const again = await poll();
      again[0].flush(
        envelopeOk({ ...draftingSessionFixture(1), conversationId: 5 }),
      );
      await settle();
      store.refresh();
      await settle();
      reads()[0].flush(
        envelopeOk({ ...draftingSessionFixture(1), conversationId: 5 }),
      );
      await settle();

      expect(chat.reloadConversation).toHaveBeenCalledTimes(2);
    });

    it('waits for the answer on its way', async () => {
      chat.conversationId$.set(5);
      chat.isAnswering$.set(true);
      await open({ ...draftingSessionFixture(1), conversationId: 5 });
      expect(chat.reloadConversation).not.toHaveBeenCalled();

      chat.isAnswering$.set(false);
      await settle();

      expect(chat.reloadConversation).toHaveBeenCalledExactlyOnceWith(5);
    });

    it('is not read for a session another conversation started', async () => {
      chat.conversationId$.set(5);
      await open({ ...draftingSessionFixture(1), conversationId: 6 });

      expect(chat.reloadConversation).not.toHaveBeenCalled();
    });
  });
});
