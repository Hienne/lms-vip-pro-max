import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Citation, DocumentText } from '@lms/contracts';
import {
  backendRefusal,
  envelopeOk,
  knowledgeAnswerFixture,
  knowledgeDocumentTextFixtures,
} from '@lms/mocks';
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { provideEnvelopeHttpClient } from '../http/http.testing';
import { SourceViewerStore } from './source-viewer.store';

const TEXT = '/api/v1/knowledge/documents/1/text';
const cited = knowledgeAnswerFixture.citations[0] as Citation;

function text(from: number, to: number): DocumentText {
  const all = knowledgeDocumentTextFixtures[1];
  return {
    documentId: 1,
    fileName: 'Quy-trinh-EOD.pdf',
    aroundChunkId: 11,
    chunks: all.slice(from, to + 1),
    hasMoreBefore: from > 0,
    hasMoreAfter: to < all.length - 1,
  };
}

describe('SourceViewerStore', () => {
  let backend: HttpTestingController;
  let store: SourceViewerStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SourceViewerStore);
  });

  afterEach(() => backend.verify());

  const textRequest = (): TestRequest =>
    backend.expectOne((r) => r.url === TEXT);

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  it('is closed until a source is opened', () => {
    expect(store.citation$()).toBeNull();
    expect(store.status$()).toBe('closed');
  });

  it('reads the cited chunk with two neighbours each side and shows the text', async () => {
    store.open(cited);
    expect(store.status$()).toBe('loading');
    const request = textRequest();
    expect(request.request.params.get('around')).toBe('11');
    expect(request.request.params.get('span')).toBe('2');
    request.flush(envelopeOk(text(0, 3)));
    await settle();

    expect(store.status$()).toBe('ready');
    expect(store.text$()?.chunks.map((c) => c.chunkId)).toEqual([
      10, 11, 12, 13,
    ]);
    expect(store.citedChunkId$()).toBe(11);
  });

  it('opens a citation without a chunk id at the start of the document', async () => {
    store.open({ ...cited, chunkId: undefined });
    const request = textRequest();
    expect(request.request.params.has('around')).toBe(false);
    request.flush(envelopeOk(text(0, 2)));
    await settle();
    expect(store.status$()).toBe('ready');
  });

  it('"Xem thêm" asks for a wider span and keeps the text on screen while it loads', async () => {
    store.open(cited);
    textRequest().flush(envelopeOk(text(0, 3)));
    await settle();

    store.more();
    expect(store.status$()).toBe('ready');
    expect(store.loadingMore$()).toBe(true);
    expect(store.text$()?.chunks).toHaveLength(4);
    const request = textRequest();
    expect(request.request.params.get('span')).toBe('5');
    request.flush(envelopeOk(text(0, 4)));
    await settle();

    expect(store.loadingMore$()).toBe(false);
    expect(store.text$()?.chunks).toHaveLength(5);
    expect(store.text$()?.hasMoreAfter).toBe(false);
  });

  it('says the document is gone when the server answers not-found', async () => {
    store.open(cited);
    const refusal = backendRefusal('resourceNotFound');
    textRequest().flush(refusal.body, {
      status: refusal.status,
      statusText: 'OK',
    });
    await settle();

    expect(store.status$()).toBe('gone');
    expect(store.text$()).toBeNull();
  });

  it('reports a failure other than not-found and retries it', async () => {
    store.open(cited);
    textRequest().flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(store.status$()).toBe('failed');

    store.retry();
    expect(store.status$()).toBe('loading');
    textRequest().flush(envelopeOk(text(0, 3)));
    await settle();
    expect(store.status$()).toBe('ready');
  });

  it('ignores an answer for a source that was closed meanwhile', async () => {
    store.open(cited);
    const first = textRequest();
    store.close();
    expect(store.status$()).toBe('closed');
    first.flush(envelopeOk(text(0, 3)));
    await settle();
    expect(store.status$()).toBe('closed');
    expect(store.text$()).toBeNull();
  });

  it('closing clears the text', async () => {
    store.open(cited);
    textRequest().flush(envelopeOk(text(0, 3)));
    await settle();
    store.close();
    expect(store.citation$()).toBeNull();
    expect(store.text$()).toBeNull();
  });
});
