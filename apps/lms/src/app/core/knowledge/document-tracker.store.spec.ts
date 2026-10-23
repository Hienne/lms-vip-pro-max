import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { KnowledgeDocument } from '@lms/contracts';
import {
  backendRefusal,
  envelopeOk,
  knowledgeDocumentFixtures,
  seedMe,
} from '@lms/mocks';
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { provideEnvelopeHttpClient } from '../http/http.testing';
import { NetworkStore } from '../network/network.store';
import { FakeSessionStore } from '../session/session.testing';
import { SessionStore } from '../session/session.store';
import { toProfile } from '../session/to-profile';
import {
  DocumentTrackerStore,
  POLL_INTERVAL_MS,
  READY_NOTICE_MS,
} from './document-tracker.store';

const LIST = '/api/v1/knowledge/documents';

const processing = knowledgeDocumentFixtures.find(
  (d) => d.status === 'processing',
) as KnowledgeDocument;
const queued: KnowledgeDocument = {
  ...processing,
  id: 9,
  fileName: 'moi-tai-len.md',
  status: 'queued',
};
const ready: KnowledgeDocument = {
  ...processing,
  status: 'ready',
  chunkCount: 3,
  processedAt: '2026-10-22T09:00:20.000Z',
};
const failed: KnowledgeDocument = {
  ...processing,
  status: 'failed',
  errorMessage: 'Tài liệu không có nội dung văn bản.',
  processedAt: '2026-10-22T09:00:20.000Z',
};

const page = (...items: KnowledgeDocument[]) =>
  envelopeOk({
    items,
    page: 0,
    size: 100,
    totalElements: items.length,
    totalPages: 1,
  });

describe('DocumentTrackerStore', () => {
  let backend: HttpTestingController;
  let session: FakeSessionStore;
  let handled: unknown[];

  beforeEach(() => {
    vi.useFakeTimers();
    handled = [];
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        { provide: SessionStore, useClass: FakeSessionStore },
        {
          provide: ErrorHandler,
          useValue: { handleError: (e: unknown) => handled.push(e) },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore) as unknown as FakeSessionStore;
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  const signIn = () => session.user.set(toProfile(seedMe('000005')));

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await Promise.resolve();
  }

  async function tick(ms = POLL_INTERVAL_MS): Promise<void> {
    vi.advanceTimersByTime(ms);
    await settle();
  }

  const listRequests = (): TestRequest[] =>
    backend.match((r) => r.url === LIST);

  /** Signs in and answers the seed call with `items`. */
  async function start(...items: KnowledgeDocument[]) {
    signIn();
    const store = TestBed.inject(DocumentTrackerStore);
    await settle();
    const [seed] = listRequests();
    seed.flush(page(...items));
    await settle();
    return store;
  }

  async function answerPoll(...items: KnowledgeDocument[]): Promise<void> {
    await tick();
    const [poll] = listRequests();
    poll.flush(page(...items));
    await settle();
  }

  it('asks nothing while nobody is signed in', async () => {
    const store = TestBed.inject(DocumentTrackerStore);
    await settle();
    await tick(10_000);
    expect(store.pending$()).toEqual([]);
    expect(store.owlState$()).toBe('idle');
  });

  it('seeds the pending documents of the signed-in user, so a reload mid-processing keeps the owl busy', async () => {
    signIn();
    const store = TestBed.inject(DocumentTrackerStore);
    await settle();
    const [seed] = listRequests();
    expect(seed.request.params.get('mine')).toBe('true');
    expect(seed.request.params.getAll('status')).toEqual([
      'queued',
      'processing',
    ]);
    expect(seed.request.params.get('size')).toBe('100');
    seed.flush(page(processing));
    await settle();

    expect(store.pending$()).toEqual([processing]);
    expect(store.owlState$()).toBe('processing');
  });

  it('stays idle and does not poll when nothing is pending', async () => {
    const store = await start();
    await tick(30_000);
    expect(store.owlState$()).toBe('idle');
  });

  it('polls every few seconds while something is pending', async () => {
    await start(processing);
    await tick(POLL_INTERVAL_MS - 1);
    expect(listRequests()).toHaveLength(0);
    await tick(1);
    expect(listRequests()).toHaveLength(1);
  });

  it('tracks a document just uploaded and starts polling for it', async () => {
    const store = await start();
    store.track(queued);
    await settle();
    expect(store.pending$()).toEqual([queued]);
    expect(store.owlState$()).toBe('processing');
    await tick();
    expect(listRequests()).toHaveLength(1);
  });

  it('ignores a document that is already finished', async () => {
    const store = await start();
    store.track(ready);
    expect(store.pending$()).toEqual([]);
  });

  it('keeps a document tracked while a poll was in flight', async () => {
    signIn();
    const store = TestBed.inject(DocumentTrackerStore);
    await settle();
    const [seed] = listRequests();
    store.track(queued);
    seed.flush(page());
    await settle();
    expect(store.pending$()).toEqual([queued]);
  });

  it('stops polling while the app is offline and resumes online', async () => {
    await start(processing);
    TestBed.inject(NetworkStore).goOffline();
    await settle();
    await tick(10_000);
    expect(listRequests()).toHaveLength(0);

    TestBed.inject(NetworkStore).goOnline();
    await settle();
    await tick();
    expect(listRequests()).toHaveLength(1);
    listRequests();
  });

  it('announces a document that became ready, looks it up once and bumps finished', async () => {
    const store = await start(processing);
    const before = store.finished.version();

    await tick();
    const [poll] = listRequests();
    poll.flush(page());
    await settle();
    const lookup = backend.expectOne(`${LIST}/${processing.id}`);
    lookup.flush(envelopeOk(ready));
    await settle();

    expect(store.pending$()).toEqual([]);
    expect(store.lastFinished$()?.document).toEqual(ready);
    expect(store.owlState$()).toBe('done');
    expect(store.finished.version()).toBe(before + 1);
  });

  it('clears a ready notice by itself after a few seconds', async () => {
    const store = await start(processing);
    await tick();
    listRequests()[0].flush(page());
    await settle();
    backend.expectOne(`${LIST}/${processing.id}`).flush(envelopeOk(ready));
    await settle();
    expect(store.owlState$()).toBe('done');

    await tick(READY_NOTICE_MS - 1);
    expect(store.owlState$()).toBe('done');
    await tick(1);
    expect(store.owlState$()).toBe('idle');
    expect(store.lastFinished$()).toBeNull();
  });

  it('keeps a failed notice until it is dismissed', async () => {
    const store = await start(processing);
    await tick();
    listRequests()[0].flush(page());
    await settle();
    backend.expectOne(`${LIST}/${processing.id}`).flush(envelopeOk(failed));
    await settle();
    expect(store.owlState$()).toBe('failed');

    await tick(60_000);
    expect(store.owlState$()).toBe('failed');
    store.dismiss();
    expect(store.owlState$()).toBe('idle');
  });

  it('keeps the document pending when its lookup fails, and tries again on the next poll', async () => {
    const store = await start(processing);
    await tick();
    listRequests()[0].flush(page());
    await settle();
    const refusal = backendRefusal('internalError');
    backend
      .expectOne(`${LIST}/${processing.id}`)
      .flush(refusal.body, { status: refusal.status, statusText: 'Error' });
    await settle();
    expect(store.pending$()).toEqual([processing]);
    expect(store.lastFinished$()).toBeNull();

    await tick();
    listRequests()[0].flush(page());
    await settle();
    backend.expectOne(`${LIST}/${processing.id}`).flush(envelopeOk(ready));
    await settle();
    expect(store.owlState$()).toBe('done');
  });

  it('keeps polling after a poll fails and shows nothing', async () => {
    const store = await start(processing);
    await tick();
    const refusal = backendRefusal('internalError');
    listRequests()[0].flush(refusal.body, {
      status: refusal.status,
      statusText: 'Error',
    });
    await settle();
    expect(store.pending$()).toEqual([processing]);
    expect(store.owlState$()).toBe('processing');

    await tick();
    expect(listRequests()).toHaveLength(1);
  });

  it('forgets everything and stops polling when the user signs out', async () => {
    const store = await start(processing);
    session.user.set(null);
    await settle();
    expect(store.pending$()).toEqual([]);
    expect(store.lastFinished$()).toBeNull();
    expect(store.owlState$()).toBe('idle');
    await tick(10_000);
    expect(listRequests()).toHaveLength(0);
  });

  it('starts from nothing for the next user', async () => {
    const store = await start(processing);
    session.user.set(toProfile(seedMe('000004')));
    await settle();
    expect(store.pending$()).toEqual([]);
    const [seed] = listRequests();
    seed.flush(page());
    await settle();
    expect(store.owlState$()).toBe('idle');
  });

  it('reports a contract mismatch to the ErrorHandler', async () => {
    signIn();
    TestBed.inject(DocumentTrackerStore);
    await settle();
    listRequests()[0].flush(envelopeOk({ items: 'oops' }));
    await settle();
    expect(handled).toHaveLength(1);
  });

  it('applies the answer of a poll that lists a still-pending document with its newer status', async () => {
    const store = await start(queued);
    await answerPoll({ ...queued, status: 'processing' });
    expect(store.pending$().map((d) => d.status)).toEqual(['processing']);
  });
});
