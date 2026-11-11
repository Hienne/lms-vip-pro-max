import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type {
  AgentStreamEvent,
  PendingAction,
  StoredTurn,
} from '@lms/contracts';
import {
  agentActionEvents,
  agentDocumentEvents,
  agentNavigateEvents,
  BACKEND_RESPONSES,
  backendRefusal,
  envelopeOk,
  knowledgeDocumentFixtures,
  seedMe,
} from '@lms/mocks';
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { CourseJobTrackerStore } from '../course-jobs/course-job-tracker.store';
import { DocumentTrackerStore } from '../knowledge/document-tracker.store';
import { testAppConfig } from '../config/app-config.testing';
import { provideEnvelopeHttpClient } from '../http/http.testing';
import { NetworkStore } from '../network/network.store';
import { SessionStore } from '../session/session.store';
import {
  fakeSession,
  FakeSessionStore,
  seedProfile,
} from '../session/session.testing';
import { ConversationsStore } from './conversations.store';
import {
  AgentChatStore,
  CUT_OFF_MESSAGE,
  GENERIC_ERROR,
  OFFLINE_MESSAGE,
} from './agent-chat.store';

const STREAM = '/api/v1/assistant/agent/stream';
const confirmUrl = (id: string) =>
  `/api/v1/assistant/agent/actions/${id}/confirm`;
const cancelUrl = (id: string) =>
  `/api/v1/assistant/agent/actions/${id}/cancel`;
const KEY = (userId: string) => `lms.agent-chat.v2.${userId}`;
const LEGACY_KEY = (userId: string) => `lms.agent-chat.v1.${userId}`;
const detailUrl = (id: number) => `/api/v1/assistant/conversations/${id}`;

const storedTurn = (
  id: number,
  patch: Partial<StoredTurn> = {},
): StoredTurn => ({
  id,
  surface: 'AGENT',
  question: `Câu ${id}`,
  answer: `Trả lời ${id}`,
  citations: [],
  toolNames: [],
  navigation: null,
  actionId: null,
  action: null,
  feedback: null,
  status: 'done',
  createTime: '2026-11-10T09:00:00Z',
  ...patch,
});

const detailBody = (id: number, turns: readonly StoredTurn[]) =>
  envelopeOk({
    id,
    title: 'Tiêu đề',
    lastActivityTime: '2026-11-10T09:00:00Z',
    createTime: '2026-11-10T09:00:00Z',
    turns,
  });

const ndjson = (events: readonly AgentStreamEvent[]) =>
  events.map((e) => JSON.stringify(e)).join('\n') + '\n';

/** Ends a stream request the way the backend does, with the NDJSON content type. */
const finish = (request: TestRequest, events: readonly AgentStreamEvent[]) =>
  request.flush(ndjson(events), {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });

const action = (id = 'a1', expiresAt?: string): PendingAction => ({
  id,
  tool: 'update_profile',
  title: 'Cập nhật hồ sơ cá nhân',
  changes: [
    {
      field: 'positionName',
      label: 'Chức danh',
      from: 'Chuyên viên nghiệp vụ',
      to: 'Chuyên viên chính',
    },
  ],
  expiresAt: expiresAt ?? new Date(Date.now() + 10 * 60_000).toISOString(),
});

const done = (answer: string): AgentStreamEvent => ({
  type: 'done',
  answer,
  citations: [],
});

describe('AgentChatStore', () => {
  let backend: HttpTestingController;
  let store: AgentChatStore;
  let router: Router;
  const trackById = vi.fn();

  function setup(userId: string | null = '000004'): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        provideRouter([]),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
        // The background trackers poll the server on their own; this spec is about the chat.
        { provide: CourseJobTrackerStore, useValue: { trackById } },
        { provide: DocumentTrackerStore, useValue: { track: vi.fn() } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    if (userId) fakeSession().user.set(seedProfile(userId));
    store = TestBed.inject(AgentChatStore);
  }

  beforeEach(() => setup());
  afterEach(() => backend.verify());

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await Promise.resolve();
  }

  /** Sends a question and answers it with `events`. */
  async function converse(
    question: string,
    events: readonly AgentStreamEvent[],
  ): Promise<void> {
    store.ask(question);
    await settle();
    finish(backend.expectOne(STREAM), events);
    await settle();
  }

  /** The history reads the list once it is shown; this answers it with an empty one. */
  async function listed(): Promise<void> {
    await settle();
    backend.expectOne('/api/v1/assistant/conversations?size=50').flush(
      envelopeOk({
        items: [],
        page: 0,
        size: 50,
        totalElements: 0,
        totalPages: 0,
      }),
    );
    await settle();
  }

  const lastReply = () => store.turns$().at(-1)?.reply;
  const lastBody = (request: TestRequest) =>
    request.request.body as { message: string; conversationId?: number };
  const conversation = (conversationId: number): AgentStreamEvent => ({
    type: 'conversation',
    conversationId,
  });

  describe('availability and the panel', () => {
    it('is available to a signed-in user with the assistant function', () => {
      expect(store.available$()).toBe(true);
    });

    it('is not available to a visitor, to a user without the function, or while a temporary password is in use', () => {
      fakeSession().user.set(null);
      expect(store.available$()).toBe(false);
      const profile = seedProfile('000004');
      fakeSession().user.set({
        ...profile,
        menus: profile.menus.filter((code) => code !== 'AI_ASSISTANT'),
      });
      expect(store.available$()).toBe(false);
      fakeSession().user.set({ ...profile, mustChangePassword: true });
      expect(store.available$()).toBe(false);
    });

    it('opens, closes and toggles without sending anything', () => {
      expect(store.isOpen$()).toBe(false);
      store.open();
      expect(store.isOpen$()).toBe(true);
      store.close();
      expect(store.isOpen$()).toBe(false);
      store.toggle();
      expect(store.isOpen$()).toBe(true);
      backend.expectNone(STREAM);
    });

    it('docks only an open panel, and keeps the choice for the next opening', () => {
      store.toggleDocked();
      expect(store.isDocked$()).toBe(false);
      store.open();
      expect(store.isDocked$()).toBe(true);
      store.close();
      expect(store.isDocked$()).toBe(false);
      store.open();
      expect(store.isDocked$()).toBe(true);
      store.toggleDocked();
      expect(store.isDocked$()).toBe(false);
    });
  });

  describe('asking', () => {
    it('moves the reply along the stream: tool line, text, then the server’s final answer and sources', async () => {
      store.ask('  EOD là gì?  ');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({ message: 'EOD là gì?' });
      expect(lastReply()).toMatchObject({ status: 'waiting', text: '' });
      expect(store.isAnswering$()).toBe(true);

      finish(request, agentDocumentEvents);
      await settle();
      const reply = lastReply();
      expect(reply?.status).toBe('done');
      expect(reply?.text).toContain('đối chiếu số dư sổ cái');
      expect(reply?.citations).toHaveLength(2);
      expect(reply?.toolName).toBe('search_documents');
      expect(store.isAnswering$()).toBe(false);
    });

    it('shows the tool line and the streamed text while the answer is on its way', async () => {
      store.ask('EOD là gì?');
      await settle();
      const request = backend.expectOne(STREAM);
      // A partial body: the first lines have arrived, the stream is still open.
      request.event({
        type: 3,
        loaded: 1,
        partialText:
          JSON.stringify({ type: 'tool', name: 'search_documents' }) +
          '\n' +
          JSON.stringify({ type: 'delta', text: 'Chạy ' }) +
          '\n',
      } as never);
      await settle();
      expect(lastReply()).toMatchObject({
        status: 'composing',
        toolName: 'search_documents',
        text: 'Chạy ',
      });
      finish(request, [
        { type: 'tool', name: 'search_documents' },
        { type: 'delta', text: 'Chạy ' },
        done('Chạy EOD.'),
      ]);
      await settle();
      expect(lastReply()?.text).toBe('Chạy EOD.');
    });

    it('ignores an empty question and a second one while answering', async () => {
      store.ask('   ');
      expect(store.turns$()).toEqual([]);
      store.ask('Một');
      store.ask('Hai');
      await settle();
      expect(store.turns$()).toHaveLength(1);
      backend
        .expectOne(STREAM)
        .flush('', { headers: { 'Content-Type': 'application/x-ndjson' } });
    });

    it('says so when the stream ends without a done line', async () => {
      await converse('Một', [{ type: 'tool', name: 'search_documents' }]);
      expect(lastReply()).toMatchObject({
        status: 'error',
        error: CUT_OFF_MESSAGE,
      });
      expect(store.isAnswering$()).toBe(false);
    });

    it('shows an error event’s message', async () => {
      await converse('Một', [
        { type: 'tool', name: 'search_documents' },
        {
          type: 'error',
          messageCode: 'ASSISTANT-AI_UNAVAILABLE',
          message: 'Dịch vụ AI tạm thời không phản hồi.',
        },
      ]);
      expect(lastReply()).toMatchObject({
        status: 'error',
        error: 'Dịch vụ AI tạm thời không phản hồi.',
      });
    });

    it('shows the hourly limit’s message with the wait', async () => {
      await converse('Một', [
        {
          type: 'error',
          messageCode: BACKEND_RESPONSES.assistantRateLimited.code,
          message: BACKEND_RESPONSES.assistantRateLimited.message,
        },
      ]);
      expect(lastReply()).toMatchObject({
        status: 'error',
        error: 'Bạn đã hỏi nhiều, thử lại sau 57 phút.',
      });
      expect(store.isAnswering$()).toBe(false);
    });

    it('shows the message of a refusal that comes before the stream', async () => {
      store.ask('Một');
      await settle();
      const refusal = backendRefusal('assistantAiUnavailable');
      backend.expectOne(STREAM).flush(refusal.body, {
        status: refusal.status,
        statusText: 'OK',
      });
      await settle();
      expect(lastReply()).toMatchObject({
        status: 'error',
        error: 'Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại sau.',
      });
    });

    it('refuses while offline with the offline message and sends nothing', async () => {
      TestBed.inject(NetworkStore).goOffline();
      store.ask('Một');
      await settle();
      backend.expectNone(STREAM);
      expect(lastReply()).toMatchObject({
        status: 'error',
        error: OFFLINE_MESSAGE,
      });
      expect(store.isAnswering$()).toBe(false);
    });

    it('can still stop a new answer after the previous stream closes late', async () => {
      const doneLine = JSON.stringify(done('Trả lời một')) + '\n';
      store.ask('Một');
      await settle();
      const first = backend.expectOne(STREAM);
      // The done line has arrived, but the connection has not closed yet.
      first.event({ type: 3, loaded: 1, partialText: doneLine } as never);
      await settle();
      store.ask('Hai');
      await settle();
      const second = backend.expectOne(STREAM);

      finish(first, [done('Trả lời một')]);
      await settle();
      store.stop();
      expect(second.cancelled).toBe(true);
      expect(lastReply()?.status).toBe('stopped');
    });

    it('stops the answer and keeps what has arrived', async () => {
      store.ask('Một');
      await settle();
      const request = backend.expectOne(STREAM);
      request.event({
        type: 3,
        loaded: 1,
        partialText: JSON.stringify({ type: 'delta', text: 'Một nửa' }) + '\n',
      } as never);
      await settle();
      store.stop();
      expect(lastReply()).toMatchObject({ status: 'stopped', text: 'Một nửa' });
      expect(store.isAnswering$()).toBe(false);
      expect(request.cancelled).toBe(true);
    });
  });

  describe('retrying', () => {
    it('asks a failed question again and replaces its reply', async () => {
      store.ask('EOD là gì?');
      await settle();
      finish(backend.expectOne(STREAM), [
        {
          type: 'error',
          messageCode: 'ASSISTANT-AI_UNAVAILABLE',
          message: 'Lỗi tạm thời',
        },
      ]);
      await settle();
      expect(lastReply()?.status).toBe('error');

      store.retry(1);
      await settle();
      expect(lastReply()?.status).toBe('waiting');
      const request = backend.expectOne(STREAM);
      expect(lastBody(request).message).toBe('EOD là gì?');
      finish(request, [done('Đây là EOD.')]);
      await settle();
      expect(store.turns$()).toHaveLength(1);
      expect(lastReply()).toMatchObject({
        status: 'done',
        text: 'Đây là EOD.',
        error: null,
      });
    });

    it('retries a stopped reply but not a finished one', async () => {
      store.ask('Câu một');
      await settle();
      backend.expectOne(STREAM);
      store.stop();
      expect(lastReply()?.status).toBe('stopped');
      store.retry(1);
      await settle();
      expect(lastReply()?.status).toBe('waiting');
      finish(backend.expectOne(STREAM), [done('Xong')]);
      await settle();
      store.retry(1);
      await settle();
      backend.expectNone(STREAM);
    });

    it('is refused while another reply streams', async () => {
      store.ask('Câu một');
      await settle();
      backend.expectOne(STREAM);
      store.stop();
      store.ask('Câu hai');
      await settle();
      backend.expectOne(STREAM);
      store.retry(1);
      await settle();
      backend.expectNone(STREAM);
      expect(store.turns$()[0].reply.status).toBe('stopped');
    });
  });

  describe('conversation', () => {
    it('sends no history: the first question has no conversation id', async () => {
      store.ask('Câu một');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({ message: 'Câu một' });
      expect(JSON.stringify(request.request.body)).not.toContain('messages');
      finish(request, [conversation(42), done('Trả lời một')]);
      await settle();
    });

    it('sends the conversation id the first line named with every later question', async () => {
      await converse('Câu một', [conversation(42), done('Trả lời một')]);

      store.ask('Câu hai');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({
        conversationId: 42,
        message: 'Câu hai',
      });
      finish(request, [done('x')]);
      await settle();
    });

    it('retries a failed question inside the same conversation', async () => {
      await converse('Câu một', [conversation(7), done('Trả lời một')]);
      await converse('Câu hai', [{ type: 'tool', name: 'search_documents' }]);
      expect(lastReply()?.status).toBe('error');

      store.retry(2);
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({
        conversationId: 7,
        message: 'Câu hai',
      });
      finish(request, [done('x')]);
      await settle();
    });

    it('starts a new conversation after the chat is cleared', async () => {
      await converse('Câu một', [conversation(42), done('Trả lời một')]);
      store.clear();

      store.ask('Câu mới');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({ message: 'Câu mới' });
      finish(request, [done('x')]);
      await settle();
    });

    it('keeps the conversation id for this tab, so a reload continues it', async () => {
      await converse('Câu một', [conversation(42), done('Trả lời một')]);
      TestBed.tick();
      await settle();

      setup();
      TestBed.tick();
      await settle();
      backend.expectOne(detailUrl(42)).flush(detailBody(42, [storedTurn(1)]));
      await settle();
      store.ask('Sau khi tải lại');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request).conversationId).toBe(42);
      finish(request, [done('x')]);
      await settle();
    });
  });

  describe('a conversation about a lesson', () => {
    const lesson = {
      courseId: 5,
      revisionId: 50,
      lessonId: 9,
      label: 'Tín dụng › Lãi suất',
    };
    const context = { courseId: 5, revisionId: 50, lessonId: 9 };

    it('opens the panel on a new conversation and sends the lesson with the question and the skill', async () => {
      store.askAboutLesson(lesson, 'Tóm tắt bài này', 'tom_tat_bai');
      await settle();

      expect(store.isOpen$()).toBe(true);
      expect(store.lesson$()).toEqual(lesson);
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({
        message: 'Tóm tắt bài này',
        skill: 'tom_tat_bai',
        context,
      });
      finish(request, [conversation(11), done('x')]);
      await settle();
    });

    it('sends the lesson with every later question of the conversation', async () => {
      store.askAboutLesson(lesson, 'Bài này nói gì?');
      await settle();
      finish(backend.expectOne(STREAM), [conversation(11), done('x')]);
      await settle();

      store.ask('Còn gì nữa?');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({
        conversationId: 11,
        message: 'Còn gì nữa?',
        context,
      });
      finish(request, [done('y')]);
      await settle();
    });

    it('continues the conversation already open on the same lesson, and starts a new one for another lesson', async () => {
      store.askAboutLesson(lesson, 'Bài này nói gì?');
      await settle();
      finish(backend.expectOne(STREAM), [conversation(11), done('x')]);
      await settle();

      store.askAboutLesson(lesson, 'Tóm tắt bài này', 'tom_tat_bai');
      await settle();
      expect(lastBody(backend.expectOne(STREAM))).toMatchObject({
        conversationId: 11,
      });
    });

    it('starts a new conversation for a different lesson and drops the lesson when the chat is cleared', async () => {
      store.askAboutLesson(lesson, 'Bài này nói gì?');
      await settle();
      finish(backend.expectOne(STREAM), [conversation(11), done('x')]);
      await settle();

      store.askAboutLesson({ ...lesson, lessonId: 10 }, 'Bài này nói gì?');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({
        message: 'Bài này nói gì?',
        context: { ...context, lessonId: 10 },
      });
      finish(request, [conversation(12), done('y')]);
      await settle();

      store.clear();
      expect(store.lesson$()).toBeNull();
    });

    it('shows the lesson label again when the saved conversation is reopened', async () => {
      store.openConversation(9);
      await settle();
      backend.expectOne(detailUrl(9)).flush(
        envelopeOk({
          id: 9,
          title: 'Tiêu đề',
          lastActivityTime: '2026-11-10T09:00:00Z',
          createTime: '2026-11-10T09:00:00Z',
          context: lesson,
          turns: [storedTurn(1)],
        }),
      );
      await settle();

      expect(store.lesson$()).toEqual(lesson);
      store.ask('Tiếp');
      await settle();
      expect(lastBody(backend.expectOne(STREAM))).toEqual({
        conversationId: 9,
        message: 'Tiếp',
        context,
      });
    });
  });

  describe('saved conversations', () => {
    it('reopens a saved conversation with its answers, sources and each card in the state the server holds', async () => {
      store.showHistory();
      await listed();
      store.openConversation(9);
      expect(store.isOpening$()).toBe(true);
      await settle();
      backend.expectOne(detailUrl(9)).flush(
        detailBody(9, [
          storedTurn(1, {
            citations: [
              {
                n: 1,
                documentId: 3,
                fileName: 'quy-trinh.pdf',
                page: 2,
                lineStart: 4,
                lineEnd: 6,
                snippet: 'Đối chiếu số dư.',
              },
            ],
          }),
          storedTurn(2, {
            navigation: { path: '/courses', title: 'Khóa học' },
            actionId: 'a1',
            action: {
              ...action('a1'),
              status: 'expired',
              message: null,
            },
          }),
          storedTurn(3, { answer: null, status: 'stopped' }),
        ]),
      );
      await settle();

      expect(store.isOpening$()).toBe(false);
      expect(store.isHistoryOpen$()).toBe(false);
      expect(store.conversationId$()).toBe(9);
      const turns = store.turns$();
      expect(turns.map((t) => t.reply.status)).toEqual([
        'done',
        'done',
        'stopped',
      ]);
      expect(turns[0].reply.citations).toHaveLength(1);
      expect(turns[1].reply.navigatedTo).toEqual({
        path: '/courses',
        title: 'Khóa học',
      });
      expect(turns[1].reply.action).toMatchObject({
        status: 'expired',
        pending: { id: 'a1' },
      });
    });

    it('continues the reopened conversation with the next question', async () => {
      store.openConversation(9);
      await settle();
      backend.expectOne(detailUrl(9)).flush(detailBody(9, [storedTurn(1)]));
      await settle();

      store.ask('Tiếp');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({ conversationId: 9, message: 'Tiếp' });
      finish(request, [done('x')]);
      await settle();
      expect(store.turns$().map((t) => t.id)).toEqual([1, 2]);
    });

    it('says why a conversation could not be opened and keeps the one on screen', async () => {
      await converse('Một', [conversation(5), done('Trả lời một')]);
      store.showHistory();
      await listed();
      store.openConversation(9);
      await settle();
      const refusal = backendRefusal('assistantConversationNotFound');
      backend
        .expectOne(detailUrl(9))
        .flush(refusal.body, { status: refusal.status, statusText: 'OK' });
      await settle();

      expect(store.openError$()).toBe(refusal.body.message);
      expect(store.isHistoryOpen$()).toBe(true);
      expect(store.conversationId$()).toBe(5);
      expect(store.turns$().map((t) => t.question)).toEqual(['Một']);
    });

    it('does not open another conversation while a reply is on its way', async () => {
      store.ask('Một');
      await settle();
      store.openConversation(9);
      await settle();
      backend.expectNone(detailUrl(9));
      backend
        .expectOne(STREAM)
        .flush('', { headers: { 'Content-Type': 'application/x-ndjson' } });
    });

    it('shows and hides the history', () => {
      store.showHistory();
      expect(store.isHistoryOpen$()).toBe(true);
      store.hideHistory();
      expect(store.isHistoryOpen$()).toBe(false);
    });

    it('empties the panel when the open conversation is deleted from the history, and only that one', async () => {
      await converse('Một', [conversation(5), done('Trả lời một')]);
      const gone = (
        TestBed.inject(ConversationsStore) as unknown as {
          gone: { next: (value: number | 'all') => void };
        }
      ).gone;

      gone.next(6);
      expect(store.turns$()).toHaveLength(1);

      gone.next(5);
      expect(store.turns$()).toEqual([]);
      expect(store.conversationId$()).toBeNull();

      await converse('Hai', [conversation(8), done('Trả lời hai')]);
      gone.next('all');
      expect(store.turns$()).toEqual([]);
      expect(store.conversationId$()).toBeNull();
    });
  });

  describe('a file attached to a course request', () => {
    it('uploads it as a personal document, then asks the course skill with its id', async () => {
      store.askWithFile('Tạo khóa học từ tệp này', new File(['x'], 'q.md'));
      await settle();
      const upload = backend.expectOne('/api/v1/knowledge/documents');
      expect((upload.request.body as FormData).get('scope')).toBe('personal');
      upload.flush(
        envelopeOk({
          ...knowledgeDocumentFixtures[0],
          id: 77,
          status: 'queued',
        }),
      );
      await settle();

      const stream = backend.expectOne(STREAM);
      expect(stream.request.body).toMatchObject({
        message: 'Tạo khóa học từ tệp này',
        skill: 'tao_khoa_hoc',
        attachmentDocumentId: 77,
      });
      finish(stream, [done('Còn thiếu: chương trình đào tạo.')]);
      await settle();
      expect(lastReply()?.text).toBe('Còn thiếu: chương trình đào tạo.');
    });

    it('shows the upload refusal as the reply and asks nothing', async () => {
      store.askWithFile('Tạo khóa học', new File(['x'], 'q.md'));
      await settle();
      const refusal = backendRefusal('fileTooLarge');
      backend
        .expectOne('/api/v1/knowledge/documents')
        .flush(refusal.body, { status: refusal.status, statusText: 'x' });
      await settle();

      backend.expectNone(STREAM);
      expect(lastReply()?.status).toBe('error');
    });
  });

  describe('navigation', () => {
    it('opens a screen that is in the user’s own menu', async () => {
      await converse(
        'mở trang quản lý người dùng',
        agentNavigateEvents('/profile', 'Hồ sơ cá nhân'),
      );
      expect(router.navigateByUrl).toHaveBeenCalledWith('/profile');
      expect(lastReply()).toMatchObject({
        status: 'done',
        navigatedTo: { path: '/profile', title: 'Hồ sơ cá nhân' },
        text: 'Đã mở trang Hồ sơ cá nhân.',
      });
    });

    it('does not navigate to a path outside the user’s menu and shows the generic error', async () => {
      await converse(
        'mở trang quản lý người dùng',
        agentNavigateEvents('/admin/users', 'Quản lý người dùng'),
      );
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(lastReply()).toMatchObject({
        status: 'error',
        error: GENERIC_ERROR,
        navigatedTo: null,
      });
      expect(store.isAnswering$()).toBe(false);
    });
  });

  describe('a proposed change', () => {
    const turnId = () => store.turns$().at(-1)?.id ?? 0;
    const card = () => lastReply()?.action;
    const ok = (id: string) =>
      envelopeOk({
        actionId: id,
        tool: 'update_profile',
        message: 'Đã cập nhật hồ sơ.',
        data: seedMe('000004'),
      });

    it('shows the card as pending and does nothing until it is confirmed', async () => {
      await converse('Đổi chức danh', agentActionEvents(action('a1')));
      expect(card()).toMatchObject({ status: 'pending', message: null });
      expect(card()?.pending.changes[0].to).toBe('Chuyên viên chính');
      backend.expectNone(confirmUrl('a1'));
    });

    it('confirms once, applies the refreshed profile to the session and shows the server’s message', async () => {
      await converse('Đổi chức danh', agentActionEvents(action('a1')));
      store.confirm(turnId());
      expect(card()?.status).toBe('confirming');
      expect(store.isConfirming$()).toBe(true);
      await settle();
      backend.expectOne(confirmUrl('a1')).flush(ok('a1'));
      await settle();
      expect(card()).toMatchObject({
        status: 'confirmed',
        message: 'Đã cập nhật hồ sơ.',
      });
      expect(fakeSession().apply).toHaveBeenCalledWith(seedMe('000004'));
      expect(store.isConfirming$()).toBe(false);
      store.confirm(turnId());
      await settle();
      backend.expectNone(confirmUrl('a1'));
    });

    it('confirms a card that starts a course, follows the job in the background and links to its review screen', async () => {
      const startCourse = {
        id: 'c1',
        tool: 'start_course_job' as const,
        title: 'Tạo khóa học bằng AI',
        changes: [
          {
            field: 'level',
            label: 'Trình độ',
            from: null,
            to: 'Cơ bản',
          },
        ],
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      await converse('Tạo khóa học', agentActionEvents(startCourse));
      store.confirm(turnId());
      await settle();
      backend.expectOne(confirmUrl('c1')).flush(
        envelopeOk({
          actionId: 'c1',
          tool: 'start_course_job',
          message: 'Đã bắt đầu tạo khóa học.',
          data: { jobId: 11, path: '/admin/courses/ai-drafts/11' },
        }),
      );
      await settle();

      expect(card()).toMatchObject({
        status: 'confirmed',
        link: { path: '/admin/courses/ai-drafts/11' },
      });
      expect(trackById).toHaveBeenCalledWith(11);
      expect(fakeSession().apply).not.toHaveBeenCalled();
    });

    it('shows a card as expired when the server no longer has the action', async () => {
      await converse('Đổi chức danh', agentActionEvents(action('a1')));
      store.confirm(turnId());
      await settle();
      const refusal = backendRefusal('assistantActionNotFound');
      backend
        .expectOne(confirmUrl('a1'))
        .flush(refusal.body, { status: refusal.status, statusText: 'OK' });
      await settle();
      expect(card()).toMatchObject({
        status: 'expired',
        message:
          'Yêu cầu này đã hết hạn hoặc đã được xử lý. Vui lòng yêu cầu lại trợ lý.',
      });
      expect(fakeSession().apply).not.toHaveBeenCalled();
    });

    it('shows a stale or otherwise refused card as failed with the server’s message', async () => {
      await converse('Đổi chức danh', agentActionEvents(action('a1')));
      store.confirm(turnId());
      await settle();
      const refusal = backendRefusal('assistantActionStale');
      backend
        .expectOne(confirmUrl('a1'))
        .flush(refusal.body, { status: refusal.status, statusText: 'OK' });
      await settle();
      expect(card()).toMatchObject({
        status: 'failed',
        message:
          'Dữ liệu đã thay đổi từ lúc trợ lý đề xuất. Vui lòng yêu cầu lại.',
      });
    });

    it('makes no request for a card whose time has passed', async () => {
      await converse(
        'Đổi chức danh',
        agentActionEvents(
          action('a1', new Date(Date.now() - 1000).toISOString()),
        ),
      );
      store.confirm(turnId());
      await settle();
      backend.expectNone(confirmUrl('a1'));
      expect(card()?.status).toBe('expired');
    });

    it('lets one card confirm at a time', async () => {
      await converse('Một', agentActionEvents(action('a1')));
      const first = turnId();
      await converse('Hai', agentActionEvents(action('a2')));
      const second = turnId();
      store.confirm(first);
      store.confirm(second);
      await settle();
      backend.expectNone(confirmUrl('a2'));
      backend.expectOne(confirmUrl('a1')).flush(ok('a1'));
      await settle();
      store.confirm(second);
      await settle();
      backend.expectOne(confirmUrl('a2')).flush(ok('a2'));
      await settle();
    });

    it('cancels without changing the profile', async () => {
      await converse('Đổi chức danh', agentActionEvents(action('a1')));
      store.cancel(turnId());
      await settle();
      backend.expectOne(cancelUrl('a1')).flush(envelopeOk(null));
      await settle();
      expect(card()).toMatchObject({ status: 'cancelled' });
      expect(fakeSession().apply).not.toHaveBeenCalled();
    });

    it('drops a confirm or cancel still on its way when the user signs out or another user signs in', async () => {
      await converse('Đổi chức danh', agentActionEvents(action('a1')));
      store.confirm(turnId());
      await settle();
      const confirming = backend.expectOne(confirmUrl('a1'));
      fakeSession().user.set(null);
      TestBed.tick();
      expect(confirming.cancelled).toBe(true);
      expect(store.isConfirming$()).toBe(false);

      fakeSession().user.set(seedProfile('000004'));
      TestBed.tick();
      await converse('Đổi chức danh', agentActionEvents(action('a2')));
      store.cancel(turnId());
      await settle();
      const cancelling = backend.expectOne(cancelUrl('a2'));
      fakeSession().user.set(seedProfile('000002'));
      TestBed.tick();
      expect(cancelling.cancelled).toBe(true);
      expect(fakeSession().apply).not.toHaveBeenCalled();
    });

    it('ignores a confirm answer that arrives after the user changed, before the store noticed', async () => {
      await converse('Đổi chức danh', agentActionEvents(action('a1')));
      store.confirm(turnId());
      await settle();
      const confirming = backend.expectOne(confirmUrl('a1'));
      fakeSession().user.set(seedProfile('000002'));
      confirming.flush(ok('a1'));
      await settle();
      expect(fakeSession().apply).not.toHaveBeenCalled();
      expect(store.turns$()).toEqual([]);
    });

    it('keeps the card pending with the offline message when confirming without a connection', async () => {
      await converse('Đổi chức danh', agentActionEvents(action('a1')));
      TestBed.inject(NetworkStore).goOffline();
      store.confirm(turnId());
      await settle();
      backend.expectNone(confirmUrl('a1'));
      expect(card()).toMatchObject({
        status: 'pending',
        message: OFFLINE_MESSAGE,
      });
    });
  });

  describe('persistence', () => {
    it('keeps only where the panel is and which conversation is open, never the turns', async () => {
      await converse('Một', [conversation(42), done('Trả lời một')]);
      store.open();
      TestBed.tick();

      const raw = sessionStorage.getItem(KEY('000004')) ?? '';
      expect(JSON.parse(raw)).toEqual({ open: true, conversationId: 42 });
      expect(raw).not.toContain('Trả lời một');
      expect(raw).not.toContain('Một');
    });

    it('reads the open conversation back from the server after a reload', async () => {
      sessionStorage.setItem(
        KEY('000004'),
        JSON.stringify({ open: true, conversationId: 42 }),
      );
      setup();
      TestBed.tick();
      await settle();
      expect(store.isOpen$()).toBe(true);
      expect(store.isOpening$()).toBe(true);
      backend
        .expectOne(detailUrl(42))
        .flush(detailBody(42, [storedTurn(1), storedTurn(2)]));
      await settle();

      expect(store.turns$().map((t) => t.question)).toEqual(['Câu 1', 'Câu 2']);
      expect(store.conversationId$()).toBe(42);
      expect(store.isOpening$()).toBe(false);
    });

    it('starts a new conversation when the saved one is gone', async () => {
      sessionStorage.setItem(
        KEY('000004'),
        JSON.stringify({ open: true, conversationId: 42 }),
      );
      setup();
      TestBed.tick();
      await settle();
      const refusal = backendRefusal('assistantConversationNotFound');
      backend
        .expectOne(detailUrl(42))
        .flush(refusal.body, { status: refusal.status, statusText: 'OK' });
      await settle();

      expect(store.turns$()).toEqual([]);
      expect(store.conversationId$()).toBeNull();
      expect(store.openError$()).toBeNull();
      store.ask('Mới');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({ message: 'Mới' });
      finish(request, [done('x')]);
      await settle();
    });

    it('does not let a question asked during the restore be replaced by the saved turns', async () => {
      sessionStorage.setItem(
        KEY('000004'),
        JSON.stringify({ open: true, conversationId: 42 }),
      );
      setup();
      TestBed.tick();
      await settle();
      store.ask('Nhanh tay');
      await settle();
      backend.expectOne(detailUrl(42)).flush(detailBody(42, [storedTurn(1)]));
      await settle();

      expect(store.turns$().map((t) => t.question)).toEqual(['Nhanh tay']);
      backend
        .expectOne(STREAM)
        .flush('', { headers: { 'Content-Type': 'application/x-ndjson' } });
    });

    it('restores a docked panel docked', () => {
      store.open();
      store.toggleDocked();
      TestBed.tick();
      expect(sessionStorage.getItem(KEY('000004'))).toContain('"docked":true');

      setup();
      TestBed.tick();
      expect(store.isDocked$()).toBe(true);
    });

    it('keeps each user’s conversation apart', async () => {
      await converse('Một', [conversation(42), done('Trả lời một')]);
      TestBed.tick();
      setup('000005');
      TestBed.tick();
      await settle();
      backend.expectNone(detailUrl(42));
      expect(store.turns$()).toEqual([]);
      expect(store.conversationId$()).toBeNull();
    });

    it('ignores and removes an entry that still carries turns', async () => {
      sessionStorage.setItem(
        LEGACY_KEY('000004'),
        JSON.stringify({ open: true, conversationId: 42, turns: [] }),
      );
      setup();
      TestBed.tick();
      await settle();

      backend.expectNone(detailUrl(42));
      expect(store.turns$()).toEqual([]);
      expect(store.isOpen$()).toBe(false);
      expect(sessionStorage.getItem(LEGACY_KEY('000004'))).toBeNull();
    });

    it('discards data that fails its check', () => {
      sessionStorage.setItem(KEY('000004'), '{"open":"yes"}');
      setup();
      expect(store.isOpen$()).toBe(false);
      expect(store.conversationId$()).toBeNull();
    });

    it('leaves no other user’s entry in this tab once a user is signed in', () => {
      sessionStorage.setItem(KEY('000005'), '{"open":true}');
      setup('000004');
      TestBed.tick();
      expect(sessionStorage.getItem(KEY('000005'))).toBeNull();
    });

    it('forgets the conversation and its storage on sign-out', async () => {
      await converse('Một', [conversation(42), done('Trả lời một')]);
      TestBed.tick();
      expect(sessionStorage.getItem(KEY('000004'))).not.toBeNull();
      fakeSession().user.set(null);
      TestBed.tick();
      expect(store.turns$()).toEqual([]);
      expect(store.conversationId$()).toBeNull();
      expect(sessionStorage.getItem(KEY('000004'))).toBeNull();
    });

    it('starts a new conversation on request, but not while answering', async () => {
      await converse('Một', [conversation(42), done('Trả lời một')]);
      TestBed.tick();
      store.ask('Hai');
      await settle();
      store.clear();
      expect(store.turns$()).toHaveLength(2);
      backend
        .expectOne(STREAM)
        .flush('', { headers: { 'Content-Type': 'application/x-ndjson' } });
      await settle();
      store.clear();
      TestBed.tick();
      expect(store.turns$()).toEqual([]);
      expect(store.conversationId$()).toBeNull();
      expect(sessionStorage.getItem(KEY('000004'))).toBeNull();
    });
  });

  describe('follow-up suggestions and skill hints', () => {
    it('keeps the suggestions the done line carried on that turn', async () => {
      await converse('Câu hỏi', [
        conversation(7),
        {
          type: 'done',
          answer: 'Xong.',
          citations: [],
          suggestions: ['Còn gì nữa?', 'Ví dụ?'],
        },
      ]);
      expect(store.turns$()[0].suggestions).toEqual(['Còn gì nữa?', 'Ví dụ?']);
    });

    it('has none when the done line carried none', async () => {
      await converse('Câu hỏi', [
        conversation(7),
        { type: 'done', answer: 'Xong.', citations: [] },
      ]);
      expect(store.turns$()[0].suggestions).toEqual([]);
    });

    it('sends the skill a button names and nothing when there is none', async () => {
      store.ask('Mở trang Hồ sơ cá nhân', 'dieu_huong');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({
        message: 'Mở trang Hồ sơ cá nhân',
        skill: 'dieu_huong',
      });
      finish(request, [
        conversation(7),
        { type: 'done', answer: 'Ok.', citations: [] },
      ]);
      await settle();
      store.ask('Câu tiếp');
      await settle();
      expect(lastBody(backend.expectOne(STREAM))).toEqual({
        conversationId: 7,
        message: 'Câu tiếp',
      });
    });
  });

  describe('feedback on an answer', () => {
    const RATE = (id: number) => `/api/v1/assistant/turns/${id}/feedback`;
    const saved = { helpful: false, reasonCode: 'outdated', note: null };

    async function answered(turnId: number | null = 31): Promise<number> {
      await converse('Câu hỏi', [
        conversation(7),
        {
          type: 'done',
          answer: 'Câu trả lời.',
          citations: [],
          ...(turnId === null ? {} : { turnId }),
        },
      ]);
      return store.turns$()[0].id;
    }

    it('learns the stored turn from the done line and has no rating yet', async () => {
      await answered();
      expect(store.turns$()[0]).toMatchObject({
        serverTurnId: 31,
        feedback: null,
      });
    });

    it('sends the thumbs against the stored turn and keeps the server’s copy', async () => {
      const id = await answered();
      store.rate(id, { helpful: false, reasonCode: 'outdated' });
      expect(store.ratingId$()).toBe(id);
      await settle();
      const request = backend.expectOne(RATE(31));
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({
        helpful: false,
        reasonCode: 'outdated',
      });
      request.flush(envelopeOk(saved));
      await settle();
      expect(store.turns$()[0].feedback).toEqual(saved);
      expect(store.ratingId$()).toBeNull();
      expect(store.ratingFailedId$()).toBeNull();
    });

    it('can change the rating, replacing the earlier one', async () => {
      const id = await answered();
      store.rate(id, { helpful: false });
      await settle();
      backend
        .expectOne(RATE(31))
        .flush(envelopeOk({ helpful: false, reasonCode: null, note: null }));
      await settle();
      store.rate(id, { helpful: true });
      await settle();
      backend
        .expectOne(RATE(31))
        .flush(envelopeOk({ helpful: true, reasonCode: null, note: null }));
      await settle();
      expect(store.turns$()[0].feedback?.helpful).toBe(true);
    });

    it('keeps the earlier choice and says so when saving fails', async () => {
      const id = await answered();
      store.rate(id, { helpful: true });
      await settle();
      backend
        .expectOne(RATE(31))
        .flush(envelopeOk({ helpful: true, reasonCode: null, note: null }));
      await settle();
      store.rate(id, { helpful: false });
      await settle();
      backend
        .expectOne(RATE(31))
        .error(new ProgressEvent('error'), { status: 500 });
      await settle();
      expect(store.turns$()[0].feedback?.helpful).toBe(true);
      expect(store.ratingFailedId$()).toBe(id);
      expect(store.ratingId$()).toBeNull();
    });

    it('sends nothing for an answer the server did not store', async () => {
      const id = await answered(null);
      store.rate(id, { helpful: true });
      await settle();
      backend.expectNone(RATE(31));
      expect(store.ratingId$()).toBeNull();
    });

    it('reads the saved rating of a reopened turn', async () => {
      store.openConversation(9);
      await settle();
      backend.expectOne(detailUrl(9)).flush(
        detailBody(9, [
          storedTurn(5, {
            feedback: { helpful: true, reasonCode: null, note: null },
          }),
        ]),
      );
      await settle();
      expect(store.turns$()[0]).toMatchObject({
        serverTurnId: 5,
        feedback: { helpful: true },
      });
    });
  });

  describe('what a screen reader hears', () => {
    it('follows the reply: the tool, the composing, then the answer', async () => {
      expect(store.announcement$()).toBe('');
      store.ask('EOD là gì?');
      await settle();
      expect(store.announcement$()).toBe('Đang xử lý…');
      finish(backend.expectOne(STREAM), [
        { type: 'tool', name: 'search_documents' },
        done('Câu trả lời.'),
      ]);
      await settle();
      expect(store.announcement$()).toBe('Trợ lý trả lời: Câu trả lời.');
    });
  });
});
