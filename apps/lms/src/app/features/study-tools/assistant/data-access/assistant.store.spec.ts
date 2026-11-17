import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChatStreamEvent } from '@lms/contracts';
import {
  BACKEND_RESPONSES,
  backendRefusal,
  KNOWLEDGE_NOT_FOUND_ANSWER,
  knowledgeNotFoundStreamFixture,
  knowledgeAnswerFixture,
  knowledgeStreamFixture,
} from '@lms/mocks';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../../core/http/http.testing';
import { NetworkStore } from '../../../../core/network/network.store';
import { SessionStore } from '../../../../core/session/session.store';
import { FakeSessionStore } from '../../../../core/session/session.testing';
import { FakeBreakpoints, provideFakeBreakpoints } from './breakpoints.testing';
import { SourceViewerStore } from '../../../../core/assistant/source-viewer.store';
import { AssistantStore, OFFLINE_MESSAGE } from './assistant.store';

const STREAM = '/api/v1/knowledge/chat/stream';

const ndjson = (events: readonly ChatStreamEvent[]) =>
  events.map((e) => JSON.stringify(e)).join('\n') + '\n';

/** Ends a stream request the way the backend does, with the NDJSON content type. */
const finish = (request: TestRequest, events: readonly ChatStreamEvent[]) =>
  request.flush(ndjson(events), {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });

describe('AssistantStore', () => {
  let backend: HttpTestingController;
  let store: AssistantStore;
  let breakpoints: FakeBreakpoints;

  beforeEach(() => {
    breakpoints = new FakeBreakpoints();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
        provideFakeBreakpoints(breakpoints),
        AssistantStore,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AssistantStore);
  });

  afterEach(() => backend.verify());

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await Promise.resolve();
  }

  /** The chat reads no documents; this only lets creation settle. */
  const loadDocuments = settle;

  describe('asking', () => {
    const stream = () => backend.expectOne(STREAM);

    it('shows the question at once and the answer as it is composed', async () => {
      await loadDocuments();
      store.ask('  Quy trình EOD gồm những bước nào?  ');
      expect(store.isAnswering$()).toBe(true);
      expect(store.turns$()).toMatchObject([
        {
          question: 'Quy trình EOD gồm những bước nào?',
          answer: { status: 'searching', text: '' },
        },
      ]);

      const request = stream();
      expect(request.request.body).toEqual({
        question: 'Quy trình EOD gồm những bước nào?',
      });
      request.event({
        type: 3,
        loaded: 1,
        partialText: ndjson(knowledgeStreamFixture.slice(0, 2)),
      } as never);
      await settle();
      expect(store.turns$()[0].answer).toMatchObject({
        status: 'composing',
        retrieved: 2,
        text: 'Chạy EOD phải đối chiếu số dư sổ cái trước, ',
      });

      finish(request, knowledgeStreamFixture);
      await settle();
      const { answer } = store.turns$()[0];
      expect(answer.status).toBe('done');
      expect(answer.found).toBe(true);
      expect(answer.text).toContain('khóa ngày giao dịch [1].');
      expect(answer.citations.length).toBeGreaterThan(0);
      expect(store.isAnswering$()).toBe(false);
    });

    it('gives the fixed sentence and no citations when nothing was found', async () => {
      await loadDocuments();
      store.ask('Thủ đô của nước Pháp là gì?');
      finish(stream(), knowledgeNotFoundStreamFixture);
      await settle();
      expect(store.turns$()[0].answer).toMatchObject({
        status: 'done',
        found: false,
        text: KNOWLEDGE_NOT_FOUND_ANSWER,
        citations: [],
      });
    });

    it('keeps grounded false from the done line and has none otherwise', async () => {
      await loadDocuments();
      store.ask('CIF là gì?');
      finish(stream(), [
        { type: 'retrieved', count: 2 },
        { type: 'delta', text: 'CIF là mã khách hàng.' },
        {
          type: 'done',
          found: true,
          answer: 'CIF là mã khách hàng.',
          citations: [],
          grounded: false,
        },
      ]);
      await settle();
      expect(store.turns$()[0].answer.grounded).toBe(false);
    });

    it("replaces the streamed text with the server's final answer", async () => {
      await loadDocuments();
      store.ask('Giá vàng hôm nay?');
      finish(stream(), [
        { type: 'retrieved', count: 3 },
        { type: 'delta', text: KNOWLEDGE_NOT_FOUND_ANSWER },
        { type: 'delta', text: '[1][2][3]' },
        {
          type: 'done',
          found: false,
          answer: KNOWLEDGE_NOT_FOUND_ANSWER,
          citations: [],
        },
      ]);
      await settle();
      expect(store.turns$()[0].answer).toMatchObject({
        status: 'done',
        found: false,
        text: KNOWLEDGE_NOT_FOUND_ANSWER,
        citations: [],
      });
    });

    it('ignores a blank question and a second one while an answer is on its way', async () => {
      await loadDocuments();
      store.ask('   ');
      expect(store.turns$()).toEqual([]);
      store.ask('một');
      store.ask('hai');
      expect(store.turns$().map((t) => t.question)).toEqual(['một']);
      finish(stream(), knowledgeNotFoundStreamFixture);
    });

    it('stops the answer, keeps what arrived and frees the box', async () => {
      await loadDocuments();
      store.ask('Hỏi');
      const request = stream();
      request.event({
        type: 3,
        loaded: 1,
        partialText: ndjson(knowledgeStreamFixture.slice(0, 2)),
      } as never);
      await settle();
      store.stop();
      expect(request.cancelled).toBe(true);
      expect(store.turns$()[0].answer).toMatchObject({
        status: 'stopped',
        text: 'Chạy EOD phải đối chiếu số dư sổ cái trước, ',
      });
      expect(store.isAnswering$()).toBe(false);
    });

    it('shows a refusal before the first line as the answer error, and retries the same question', async () => {
      await loadDocuments();
      store.ask('Hỏi');
      const refusal = backendRefusal('aiUnavailable');
      stream().flush(refusal.body, {
        status: refusal.status,
        statusText: 'OK',
      });
      await settle();
      expect(store.turns$()[0].answer).toMatchObject({
        status: 'error',
        error: 'Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại sau.',
      });
      expect(store.isAnswering$()).toBe(false);

      store.retry(store.turns$()[0].id);
      expect(store.turns$()[0].answer.status).toBe('searching');
      expect(store.turns$()).toHaveLength(1);
      finish(stream(), knowledgeNotFoundStreamFixture);
      await settle();
      expect(store.turns$()[0].answer.status).toBe('done');
    });

    it('sends the conversation id the first line named with the next question, and starts over on request', async () => {
      await loadDocuments();
      store.ask('Hỏi một');
      const first = stream();
      expect(
        (first.request.body as { conversationId?: number }).conversationId,
      ).toBeUndefined();
      finish(first, [
        { type: 'conversation', conversationId: 9 },
        ...knowledgeStreamFixture,
      ]);
      await settle();

      store.ask('Còn ngoại lệ?');
      const second = stream();
      expect(second.request.body).toEqual({
        question: 'Còn ngoại lệ?',
        conversationId: 9,
      });
      finish(second, knowledgeNotFoundStreamFixture);
      await settle();

      store.newConversation();
      expect(store.turns$()).toEqual([]);
      store.ask('Chuyện khác');
      const third = stream();
      expect(third.request.body).toEqual({ question: 'Chuyện khác' });
      finish(third, knowledgeNotFoundStreamFixture);
      await settle();
    });

    it('shows an error event sent in the middle of the stream', async () => {
      await loadDocuments();
      store.ask('Hỏi');
      finish(stream(), [
        { type: 'retrieved', count: 1 },
        {
          type: 'error',
          messageCode: 'KNOWLEDGE-AI_UNAVAILABLE',
          message: 'Mô hình không phản hồi.',
        },
      ]);
      await settle();
      expect(store.turns$()[0].answer).toMatchObject({
        status: 'error',
        error: 'Mô hình không phản hồi.',
      });
    });

    it('shows the hourly limit’s message with the wait', async () => {
      await loadDocuments();
      store.ask('Hỏi');
      finish(stream(), [
        {
          type: 'error',
          messageCode: BACKEND_RESPONSES.assistantRateLimited.code,
          message: BACKEND_RESPONSES.assistantRateLimited.message,
        },
      ]);
      await settle();
      expect(store.turns$()[0].answer).toMatchObject({
        status: 'error',
        error: 'Bạn đã hỏi nhiều, thử lại sau 57 phút.',
      });
      expect(store.isAnswering$()).toBe(false);
    });

    it('reports a stream that ends without a final line as cut off', async () => {
      await loadDocuments();
      store.ask('Hỏi');
      finish(stream(), knowledgeStreamFixture.slice(0, 2));
      await settle();
      expect(store.turns$()[0].answer).toMatchObject({
        status: 'error',
        error: 'Kết nối bị ngắt khi đang trả lời.',
      });
      expect(store.isAnswering$()).toBe(false);
    });

    it('does not send the question while offline', async () => {
      await loadDocuments();
      TestBed.inject(NetworkStore).goOffline();
      store.ask('Hỏi');
      backend.expectNone(STREAM);
      expect(store.turns$()[0].answer).toMatchObject({
        status: 'error',
        error: OFFLINE_MESSAGE,
      });
      expect(store.isAnswering$()).toBe(false);
    });

    it('announces progress and the finished answer to a screen reader', async () => {
      await loadDocuments();
      expect(store.announcement$()).toBe('');
      store.ask('Hỏi');
      expect(store.announcement$()).toBe('Đang tìm trong tài liệu…');
      finish(stream(), knowledgeNotFoundStreamFixture);
      await settle();
      expect(store.announcement$()).toBe(
        `Trợ lý trả lời: ${KNOWLEDGE_NOT_FOUND_ANSWER}`,
      );
    });
  });

  describe('source pane', () => {
    const viewer = () => TestBed.inject(SourceViewerStore);
    const citation = knowledgeAnswerFixture.citations[0];

    afterEach(() => backend.match(() => true));

    it('docks an opened source beside the chat on a wide screen', () => {
      TestBed.tick();
      expect(viewer().docked$()).toBe(true);
      expect(store.sourceBeside$()).toBe(false);
      viewer().open(citation);
      expect(store.sourceBeside$()).toBe(true);
    });

    it('leaves an opened source to the shell’s drawer on a narrow screen', () => {
      breakpoints.wide.next(false);
      TestBed.tick();
      expect(viewer().docked$()).toBe(false);
      viewer().open(citation);
      expect(store.sourceBeside$()).toBe(false);
    });
  });
});
