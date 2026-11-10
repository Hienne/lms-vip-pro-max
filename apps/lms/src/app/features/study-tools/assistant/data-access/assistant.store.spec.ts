import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChatStreamEvent, KnowledgeDocument } from '@lms/contracts';
import {
  BACKEND_RESPONSES,
  backendRefusal,
  envelopeOk,
  KNOWLEDGE_NOT_FOUND_ANSWER,
  knowledgeDocumentFixtures,
  knowledgeNotFoundStreamFixture,
  knowledgeStreamFixture,
  seedMe,
} from '@lms/mocks';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../../core/http/http.testing';
import { DocumentTrackerStore } from '../../../../core/knowledge/document-tracker.store';
import { NetworkStore } from '../../../../core/network/network.store';
import { SessionStore } from '../../../../core/session/session.store';
import { FakeSessionStore } from '../../../../core/session/session.testing';
import { FakeBreakpoints, provideFakeBreakpoints } from './breakpoints.testing';
import {
  AssistantStore,
  DOCUMENTS_PAGE_SIZE,
  OFFLINE_MESSAGE,
} from './assistant.store';

const LIST = '/api/v1/knowledge/documents';
const STREAM = '/api/v1/knowledge/chat/stream';

const page = (items: readonly KnowledgeDocument[], totalElements = 45) =>
  envelopeOk({
    items,
    page: 0,
    size: DOCUMENTS_PAGE_SIZE,
    totalElements,
    totalPages: Math.ceil(totalElements / DOCUMENTS_PAGE_SIZE),
  });

const ndjson = (events: readonly ChatStreamEvent[]) =>
  events.map((e) => JSON.stringify(e)).join('\n') + '\n';

/** Ends a stream request the way the backend does, with the NDJSON content type. */
const finish = (request: TestRequest, events: readonly ChatStreamEvent[]) =>
  request.flush(ndjson(events), {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });

const queued: KnowledgeDocument = {
  ...knowledgeDocumentFixtures[0],
  id: 99,
  fileName: 'moi.md',
  status: 'queued',
};

const file = (name: string, content = 'noi dung') =>
  new File([content], name, { type: 'application/octet-stream' });

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

  const listRequests = (): TestRequest[] =>
    backend.match((r) => r.url === LIST && r.method === 'GET');

  /** Answers the first page the store asks for on creation. */
  async function loadDocuments(
    items: readonly KnowledgeDocument[] = knowledgeDocumentFixtures,
  ): Promise<void> {
    await settle();
    listRequests()[0].flush(page(items));
    await settle();
  }

  describe('documents', () => {
    it('shows the first page the server sends, with the total for the pager', async () => {
      await settle();
      const [request] = listRequests();
      expect(request.request.params.get('page')).toBe('0');
      expect(request.request.params.get('size')).toBe(
        String(DOCUMENTS_PAGE_SIZE),
      );
      expect(store.isLoading$()).toBe(true);
      request.flush(page(knowledgeDocumentFixtures, 45));
      await settle();
      expect(store.documents$()).toEqual(knowledgeDocumentFixtures);
      expect(store.totalDocuments$()).toBe(45);
      expect(store.isLoading$()).toBe(false);
    });

    it('asks for the next page, counted from zero on the wire', async () => {
      await loadDocuments();
      store.setPage(2);
      await settle();
      const [request] = listRequests();
      expect(request.request.params.get('page')).toBe('1');
      request.flush(page([]));
    });

    it('reports a failed load and loads again on retry', async () => {
      await settle();
      const refusal = backendRefusal('internalError');
      listRequests()[0].flush(refusal.body, {
        status: refusal.status,
        statusText: 'Error',
      });
      await settle();
      expect(store.loadError$()).toBeDefined();
      expect(store.documents$()).toEqual([]);

      store.retryLoad();
      await settle();
      listRequests()[0].flush(page(knowledgeDocumentFixtures));
      await settle();
      expect(store.loadError$()).toBeUndefined();
      expect(store.documents$()).toEqual(knowledgeDocumentFixtures);
    });
  });

  describe('uploads', () => {
    const upload = (): TestRequest[] =>
      backend.match((r) => r.url === LIST && r.method === 'POST');

    it('keeps a file of the wrong type out of the queue and says why', async () => {
      await loadDocuments();
      store.addFiles([file('anh.png')]);
      await settle();
      expect(upload()).toEqual([]);
      expect(store.uploads$()).toMatchObject([
        {
          name: 'anh.png',
          state: 'error',
          error: 'Chỉ hỗ trợ tệp .pdf, .md hoặc .docx.',
        },
      ]);
    });

    it('lets a refused file be dismissed', async () => {
      await loadDocuments();
      store.addFiles([file('anh.png')]);
      store.dismissUpload(store.uploads$()[0].id);
      expect(store.uploads$()).toEqual([]);
    });

    it('sends files one after another and hands each to the tracker', async () => {
      await loadDocuments();
      const tracker = TestBed.inject(DocumentTrackerStore);
      const track = vi.spyOn(tracker, 'track');
      store.addFiles([file('a.md'), file('b.pdf')]);
      await settle();

      const first = upload();
      expect(first).toHaveLength(1);
      expect(store.uploads$().map((u) => u.state)).toEqual([
        'uploading',
        'waiting',
      ]);
      first[0].flush(envelopeOk(queued), {
        status: 201,
        statusText: 'Created',
      });
      await settle();
      expect(track).toHaveBeenCalledWith(queued);
      expect(store.uploads$().map((u) => u.name)).toEqual(['b.pdf']);

      const second = upload();
      expect(second).toHaveLength(1);
      second[0].flush(envelopeOk({ ...queued, id: 100, fileName: 'b.pdf' }));
      await settle();
      expect(store.uploads$()).toEqual([]);
      listRequests()
        .filter((r) => !r.cancelled)
        .forEach((r) => r.flush(page([queued])));
    });

    it('sends the scope chosen before the file was added, my unit by default', async () => {
      await loadDocuments();
      store.addFiles([file('a.md')]);
      store.setUploadScope('personal');
      store.addFiles([file('b.md')]);
      await settle();
      const first = upload();
      expect((first[0].request.body as FormData).get('scope')).toBe('unit');
      first[0].flush(envelopeOk(queued));
      await settle();
      const second = upload();
      expect((second[0].request.body as FormData).get('scope')).toBe(
        'personal',
      );
      second[0].flush(envelopeOk(queued));
      await settle();
      listRequests().forEach((r) => !r.cancelled && r.flush(page([queued])));
    });

    it('offers the whole system to admins only', async () => {
      await loadDocuments();
      const session = TestBed.inject(
        SessionStore,
      ) as unknown as FakeSessionStore;
      session.apply(seedMe('000004'));
      expect(store.canShareGlobally$()).toBe(false);
      session.apply(seedMe('000002'));
      expect(store.canShareGlobally$()).toBe(true);
    });

    it('goes back to the first page and reloads the list once a file is in', async () => {
      await loadDocuments();
      store.setPage(3);
      await settle();
      listRequests()[0].flush(page([]));
      await settle();

      store.addFiles([file('a.md')]);
      await settle();
      upload()[0].flush(envelopeOk(queued));
      await settle();
      expect(store.page$()).toBe(1);
      const [reload] = listRequests();
      expect(reload.request.params.get('page')).toBe('0');
      reload.flush(page([queued]));
    });

    it("keeps the server's refusal on that file's row and goes on with the next one", async () => {
      await loadDocuments();
      store.addFiles([file('hong.pdf'), file('tot.md')]);
      await settle();
      const refusal = backendRefusal('fileInvalid');
      upload()[0].flush(refusal.body, {
        status: refusal.status,
        statusText: 'OK',
      });
      await settle();
      expect(store.uploads$()[0]).toMatchObject({
        name: 'hong.pdf',
        state: 'error',
        error: 'Tệp rỗng, bị hỏng hoặc nội dung không khớp với loại tệp.',
      });
      expect(upload()).toHaveLength(1);
      upload()[0]?.flush(envelopeOk(queued));
    });
  });

  describe('removing a document', () => {
    const del = () =>
      backend.match((r) => r.url === `${LIST}/99` && r.method === 'DELETE');

    async function confirmDialog(label: string): Promise<void> {
      await vi.waitFor(() =>
        expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(),
      );
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[role="alertdialog"] button',
        ),
      )
        .find((b) => b.textContent?.trim() === label)
        ?.click();
      await settle();
    }

    afterEach(() => {
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((c) => (c.innerHTML = ''));
    });

    it('lets the owner remove a document, and an admin one that is not personal', async () => {
      await loadDocuments();
      const session = TestBed.inject(
        SessionStore,
      ) as unknown as FakeSessionStore;
      session.apply(seedMe('000005'));
      const mine = {
        ...queued,
        uploadedBy: { userId: '000005', fullName: 'A' },
      };
      expect(store.canRemove(mine)).toBe(true);
      expect(
        store.canRemove({
          ...mine,
          uploadedBy: { userId: '000004', fullName: 'B' },
        }),
      ).toBe(false);
      session.apply(seedMe('000002'));
      expect(store.canRemove({ ...queued, scope: 'unit' })).toBe(true);
      expect(store.canRemove({ ...queued, scope: 'personal' })).toBe(false);
    });

    it('asks first, deletes only after Xoá, then reloads the list', async () => {
      await loadDocuments();
      store.removeDocument(queued);
      await confirmDialog('Hủy');
      expect(del()).toEqual([]);

      store.removeDocument(queued);
      await confirmDialog('Xoá');
      const [request] = del();
      request.flush(envelopeOk(null));
      await settle();
      const [reload] = listRequests();
      reload.flush(page([]));
    });

    it('keeps the list and says so when the server refuses', async () => {
      await loadDocuments();
      store.removeDocument(queued);
      await confirmDialog('Xoá');
      const refusal = backendRefusal('accessDenied');
      del()[0].flush(refusal.body, {
        status: refusal.status,
        statusText: 'OK',
      });
      await settle();
      expect(listRequests()).toEqual([]);
    });
  });

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

  describe('documents panel', () => {
    // The list request the store makes on creation is not under test here.
    afterEach(() => backend.match(() => true));

    it('starts open beside the chat on a wide screen and toggles', () => {
      expect(store.panelOpen$()).toBe(true);
      expect(store.panelBeside$()).toBe(true);
      expect(store.panelInDrawer$()).toBe(false);
      store.togglePanel();
      expect(store.panelOpen$()).toBe(false);
      expect(store.panelBeside$()).toBe(false);
      store.togglePanel();
      expect(store.panelBeside$()).toBe(true);
    });

    it('is a closed drawer on a narrow screen until opened, and closes again', () => {
      breakpoints.wide.next(false);
      expect(store.panelOpen$()).toBe(false);
      store.togglePanel();
      expect(store.panelInDrawer$()).toBe(true);
      expect(store.panelBeside$()).toBe(false);
      store.closePanel();
      expect(store.panelInDrawer$()).toBe(false);
    });

    it('follows the screen when it crosses the breakpoint', () => {
      store.closePanel();
      breakpoints.wide.next(false);
      expect(store.panelOpen$()).toBe(false);
      breakpoints.wide.next(true);
      expect(store.panelBeside$()).toBe(true);
    });
  });
});
