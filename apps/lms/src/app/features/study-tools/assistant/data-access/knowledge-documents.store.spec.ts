import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { Toaster } from '@lms/ui';
import { TestBed } from '@angular/core/testing';
import type { KnowledgeDocument } from '@lms/contracts';
import {
  backendRefusal,
  envelopeOk,
  knowledgeDocumentFixtures,
  seedMe,
} from '@lms/mocks';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../../core/http/http.testing';
import { DocumentTrackerStore } from '../../../../core/knowledge/document-tracker.store';
import { SessionStore } from '../../../../core/session/session.store';
import { FakeSessionStore } from '../../../../core/session/session.testing';
import { FakeBreakpoints, provideFakeBreakpoints } from './breakpoints.testing';
import {
  DOCUMENTS_PAGE_SIZE,
  KnowledgeDocumentsStore,
  REPLACEMENT_POLL_MS,
} from './knowledge-documents.store';

const LIST = '/api/v1/knowledge/documents';
const DUPLICATES = `${LIST}/duplicates`;

const page = (items: readonly KnowledgeDocument[], totalElements = 45) =>
  envelopeOk({
    items,
    page: 0,
    size: DOCUMENTS_PAGE_SIZE,
    totalElements,
    totalPages: Math.ceil(totalElements / DOCUMENTS_PAGE_SIZE),
  });

const queued: KnowledgeDocument = {
  ...knowledgeDocumentFixtures[0],
  id: 99,
  fileName: 'moi.md',
  status: 'queued',
};

const file = (name: string, content = 'noi dung') =>
  new File([content], name, { type: 'application/octet-stream' });

describe('KnowledgeDocumentsStore', () => {
  let backend: HttpTestingController;
  let store: KnowledgeDocumentsStore;
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
        KnowledgeDocumentsStore,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(KnowledgeDocumentsStore);
  });

  afterEach(() => {
    // The "Tài liệu trùng" read follows every change of the list; it is not what these specs are about.
    backend
      .match((r) => r.url === DUPLICATES)
      .forEach((r) => !r.cancelled && r.flush(envelopeOk([])));
    backend.verify();
  });

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

  describe('names, duplicates and replacement files', () => {
    const upload = (): TestRequest[] =>
      backend.match((r) => r.url === LIST && r.method === 'POST');
    const toasts = () => TestBed.inject(Toaster);

    it('sends the title typed for a single file and then clears it, but not for several files', async () => {
      await loadDocuments();
      store.setUploadTitle('  Quy trình EOD  ');
      store.addFiles([file('a.md')]);
      expect(store.uploadTitle$()).toBe('');
      store.setUploadTitle('Không dùng');
      store.addFiles([file('b.md'), file('c.md')]);
      await settle();
      const first = upload();
      expect((first[0].request.body as FormData).get('title')).toBe(
        'Quy trình EOD',
      );
      first[0].flush(envelopeOk(queued));
      await settle();
      const second = upload();
      expect((second[0].request.body as FormData).get('title')).toBeNull();
      second[0].flush(envelopeOk(queued));
      await settle();
      const third = upload();
      third[0].flush(envelopeOk(queued));
      await settle();
      listRequests().forEach((r) => !r.cancelled && r.flush(page([queued])));
    });

    it('says "already uploaded" on the file’s row, creates and tracks nothing, and can point at the document', async () => {
      await loadDocuments();
      const track = vi.spyOn(TestBed.inject(DocumentTrackerStore), 'track');
      const success = vi.spyOn(toasts(), 'success');
      store.addFiles([file('a.md')]);
      await settle();
      upload()[0].flush(
        envelopeOk({ ...queued, id: 7, title: 'Đã có', duplicate: true }),
      );
      await settle();

      expect(store.uploads$()).toMatchObject([
        {
          name: 'a.md',
          state: 'duplicate',
          existing: { id: 7, title: 'Đã có' },
        },
      ]);
      expect(track).not.toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
      store.setPage(3);
      store.showDocument(7);
      expect(store.highlightId$()).toBe(7);
      expect(store.page$()).toBe(1);
      await settle();
      listRequests().forEach((r) => !r.cancelled && r.flush(page([queued])));
    });

    it('renames a document and reloads the list', async () => {
      await loadDocuments();
      store.renameDocument(queued, 'Tên mới');
      const [request] = backend.match(
        (r) => r.url === `${LIST}/99` && r.method === 'PATCH',
      );
      expect(request.request.body).toEqual({ title: 'Tên mới' });
      request.flush(envelopeOk({ ...queued, title: 'Tên mới' }));
      await settle();
      const [reload] = listRequests();
      reload.flush(page([{ ...queued, title: 'Tên mới' }]));
    });

    it('sends a replacement file for a ready document and reads the list again', async () => {
      await loadDocuments();
      store.replaceDocument(queued, file('moi.pdf'));
      const [request] = backend.match(
        (r) => r.url === `${LIST}/99/file` && r.method === 'PUT',
      );
      expect((request.request.body as FormData).get('file')).toBeInstanceOf(
        File,
      );
      request.flush(
        envelopeOk({
          ...queued,
          status: 'ready',
          replacement: {
            status: 'queued',
            fileName: 'moi.pdf',
            errorMessage: null,
          },
        }),
      );
      await settle();
      const [reload] = listRequests();
      reload.flush(page([queued]));
    });

    it('refuses a replacement of the wrong type without sending anything', async () => {
      await loadDocuments();
      const error = vi.spyOn(toasts(), 'error');
      store.replaceDocument(queued, file('anh.png'));
      expect(error).toHaveBeenCalled();
      expect(backend.match((r) => r.url === `${LIST}/99/file`)).toEqual([]);
    });

    it('reads the list again every few seconds while a replacement is being indexed, and stops after', async () => {
      vi.useFakeTimers();
      try {
        await loadDocuments([
          {
            ...queued,
            status: 'ready',
            replacement: {
              status: 'processing',
              fileName: 'moi.pdf',
              errorMessage: null,
            },
          },
        ]);
        expect(listRequests()).toEqual([]);
        await vi.advanceTimersByTimeAsync(REPLACEMENT_POLL_MS);
        await settle();
        const [again] = listRequests();
        expect(again).toBeDefined();
        again.flush(page([{ ...queued, status: 'ready', replacement: null }]));
        await settle();
        await vi.advanceTimersByTimeAsync(REPLACEMENT_POLL_MS * 2);
        await settle();
        expect(listRequests()).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
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
});
