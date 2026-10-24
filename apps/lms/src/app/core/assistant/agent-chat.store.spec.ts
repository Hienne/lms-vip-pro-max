import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { AgentStreamEvent, PendingAction } from '@lms/contracts';
import {
  agentActionEvents,
  agentDocumentEvents,
  agentNavigateEvents,
  backendRefusal,
  envelopeOk,
  seedMe,
} from '@lms/mocks';
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { provideEnvelopeHttpClient } from '../http/http.testing';
import { NetworkStore } from '../network/network.store';
import { SessionStore } from '../session/session.store';
import {
  fakeSession,
  FakeSessionStore,
  seedProfile,
} from '../session/session.testing';
import type { AgentTurn } from './agent-chat.model';
import {
  AgentChatStore,
  CUT_OFF_MESSAGE,
  GENERIC_ERROR,
  HISTORY_TURNS,
  OFFLINE_MESSAGE,
} from './agent-chat.store';

const STREAM = '/api/v1/assistant/agent/stream';
const confirmUrl = (id: string) =>
  `/api/v1/assistant/agent/actions/${id}/confirm`;
const cancelUrl = (id: string) =>
  `/api/v1/assistant/agent/actions/${id}/cancel`;
const KEY = (userId: string) => `lms.agent-chat.v1.${userId}`;

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

  function setup(userId: string | null = '000004'): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        provideRouter([]),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
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

  const lastReply = () => store.turns$().at(-1)?.reply;
  const lastBody = (request: TestRequest) =>
    request.request.body as { messages: { role: string; content: string }[] };

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
  });

  describe('asking', () => {
    it('moves the reply along the stream: tool line, text, then the server’s final answer and sources', async () => {
      store.ask('  EOD là gì?  ');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request)).toEqual({
        messages: [{ role: 'user', content: 'EOD là gì?' }],
      });
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

  describe('history', () => {
    it('sends the finished turns, with a confirmed or cancelled card’s result, and leaves out errored and stopped ones', async () => {
      await converse('Câu một', [
        { type: 'tool', name: 'search_documents' },
        done('Trả lời một'),
      ]);
      await converse('Câu hai', [{ type: 'tool', name: 'search_documents' }]); // cut off: error
      await converse('Đổi chức danh', agentActionEvents(action('a1')));
      store.confirm(store.turns$().at(-1)?.id ?? 0);
      await settle();
      backend.expectOne(confirmUrl('a1')).flush(
        envelopeOk({
          actionId: 'a1',
          tool: 'update_profile',
          message: 'Đã cập nhật hồ sơ.',
          data: seedMe('000004'),
        }),
      );
      await settle();

      store.ask('Câu bốn');
      await settle();
      const request = backend.expectOne(STREAM);
      expect(lastBody(request).messages).toEqual([
        { role: 'user', content: 'Câu một' },
        { role: 'assistant', content: 'Trả lời một' },
        { role: 'user', content: 'Đổi chức danh' },
        {
          role: 'assistant',
          content:
            'Vui lòng kiểm tra và xác nhận thay đổi bên dưới.\nĐã cập nhật hồ sơ.',
        },
        { role: 'user', content: 'Câu bốn' },
      ]);
      finish(request, [done('x')]);
      await settle();
    });

    it('sends at most the last nine finished turns, so the request stays within the backend’s 20 messages', async () => {
      for (let i = 1; i <= HISTORY_TURNS + 3; i++) {
        await converse(`Câu ${i}`, [done(`Trả lời ${i}`)]);
      }
      store.ask('Câu cuối');
      await settle();
      const request = backend.expectOne(STREAM);
      const messages = lastBody(request).messages;
      expect(messages).toHaveLength(HISTORY_TURNS * 2 + 1);
      expect(messages[0]).toEqual({ role: 'user', content: `Câu ${4}` });
      expect(messages.at(-1)).toEqual({ role: 'user', content: 'Câu cuối' });
      finish(request, [done('x')]);
      await settle();
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
    const finished = (id: number): AgentTurn => ({
      id,
      question: `Câu ${id}`,
      reply: {
        status: 'done',
        toolName: null,
        text: `Trả lời ${id}`,
        citations: [],
        navigatedTo: null,
        action: null,
        error: null,
      },
    });

    it('writes the conversation after a finished turn and restores it for the same user', async () => {
      await converse('Một', [done('Trả lời một')]);
      store.open();
      TestBed.tick();
      expect(sessionStorage.getItem(KEY('000004'))).toContain('Trả lời một');

      setup();
      TestBed.tick();
      expect(store.turns$().map((t) => t.question)).toEqual(['Một']);
      expect(store.isOpen$()).toBe(true);
    });

    it('keeps each user’s conversation apart', async () => {
      await converse('Một', [done('Trả lời một')]);
      setup('000005');
      expect(store.turns$()).toEqual([]);
    });

    it('restores a turn that was streaming at reload as stopped', () => {
      sessionStorage.setItem(
        KEY('000004'),
        JSON.stringify({
          open: true,
          turns: [
            {
              ...finished(1),
              reply: {
                ...finished(1).reply,
                status: 'composing',
                text: 'Một nửa',
              },
            },
          ],
        }),
      );
      setup();
      expect(lastReply()).toMatchObject({ status: 'stopped', text: 'Một nửa' });
      expect(store.isAnswering$()).toBe(false);
    });

    it('numbers a new turn after the restored ones', async () => {
      sessionStorage.setItem(
        KEY('000004'),
        JSON.stringify({ open: false, turns: [finished(7)] }),
      );
      setup();
      await converse('Mới', [done('Trả lời mới')]);
      expect(store.turns$().map((t) => t.id)).toEqual([7, 8]);
    });

    it('discards data that fails its check', () => {
      sessionStorage.setItem(KEY('000004'), '{"open":true,"turns":[{"id":1}]}');
      setup();
      expect(store.turns$()).toEqual([]);
    });

    it('forgets the conversation and its storage on sign-out', async () => {
      await converse('Một', [done('Trả lời một')]);
      TestBed.tick();
      expect(sessionStorage.getItem(KEY('000004'))).not.toBeNull();
      fakeSession().user.set(null);
      TestBed.tick();
      expect(store.turns$()).toEqual([]);
      expect(sessionStorage.getItem(KEY('000004'))).toBeNull();
    });

    it('clears the conversation and its storage on request, but not while answering', async () => {
      await converse('Một', [done('Trả lời một')]);
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
      expect(sessionStorage.getItem(KEY('000004'))).toBeNull();
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
