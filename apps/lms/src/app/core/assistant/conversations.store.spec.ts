import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ConversationSummary } from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { provideEnvelopeHttpClient } from '../http/http.testing';
import { SessionStore } from '../session/session.store';
import {
  fakeSession,
  FakeSessionStore,
  seedProfile,
} from '../session/session.testing';
import { ConversationsStore } from './conversations.store';

const LIST = '/api/v1/assistant/conversations';

const row = (id: number, title = `Hội thoại ${id}`): ConversationSummary => ({
  id,
  title,
  lastActivityTime: '2026-11-10T09:00:00Z',
  createTime: '2026-11-10T09:00:00Z',
});

const page = (items: readonly ConversationSummary[]) =>
  envelopeOk({
    items,
    page: 0,
    size: 50,
    totalElements: items.length,
    totalPages: 1,
  });

describe('ConversationsStore', () => {
  let backend: HttpTestingController;
  let store: ConversationsStore;

  function setup(userId: string | null = '000004'): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    if (userId) fakeSession().user.set(seedProfile(userId));
    store = TestBed.inject(ConversationsStore);
  }

  beforeEach(() => setup());
  afterEach(() => {
    backend.verify();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  const lists = (): TestRequest[] =>
    backend.match((r) => r.url === LIST && r.method === 'GET');

  async function watching(items: readonly ConversationSummary[]) {
    store.watch();
    await settle();
    const [first] = lists();
    first.flush(page(items));
    await settle();
  }

  /** Clicks the confirm button of the dialog the store opened. */
  async function confirmDialog(label: string): Promise<void> {
    await vi.waitFor(() =>
      expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(),
    );
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role="alertdialog"] button',
      ),
    ).find((b) => b.textContent?.trim() === label);
    button?.click();
    await settle();
  }

  it('reads nothing until a screen shows the list', async () => {
    await settle();
    backend.expectNone((r) => r.url === LIST);
    expect(store.items$()).toEqual([]);
  });

  it('lists the caller’s conversations, newest first as the server sends them, once watched', async () => {
    await watching([row(2), row(1)]);
    expect(store.items$().map((c) => c.id)).toEqual([2, 1]);
    expect(store.total$()).toBe(2);
    expect(store.isEmpty$()).toBe(false);
  });

  it('says nothing is saved when the list is empty and no search is typed', async () => {
    await watching([]);
    expect(store.isEmpty$()).toBe(true);
    store.setQuery('eod');
    await settle();
    lists()[0].flush(page([]));
    await settle();
    expect(store.isEmpty$()).toBe(false);
  });

  it('searches by title with the trimmed query, and clears the search', async () => {
    await watching([row(1)]);
    store.setQuery('  EOD ');
    await settle();
    const [search] = lists();
    expect(search.request.params.get('q')).toBe('EOD');
    expect(search.request.params.get('size')).toBe('50');
    search.flush(page([row(3, 'Quy trình EOD')]));
    await settle();
    expect(store.items$().map((c) => c.title)).toEqual(['Quy trình EOD']);

    store.setQuery('');
    await settle();
    expect(lists()[0].request.params.has('q')).toBe(false);
  });

  it('shows a failure to load and reads again on retry', async () => {
    store.watch();
    await settle();
    const refusal = backendRefusal('accessDenied');
    lists()[0].flush(refusal.body, {
      status: refusal.status,
      statusText: 'Forbidden',
    });
    await settle();
    expect(store.loadError$()).toBeDefined();

    store.retryLoad();
    await settle();
    lists()[0].flush(page([row(1)]));
    await settle();
    expect(store.items$()).toHaveLength(1);
  });

  it('keeps another user’s list apart: signing in as someone else reads theirs', async () => {
    await watching([row(1)]);
    fakeSession().user.set(seedProfile('000005'));
    await settle();
    expect(store.items$()).toEqual([]);
    lists()[0].flush(page([row(9)]));
    await settle();
    expect(store.items$().map((c) => c.id)).toEqual([9]);
  });

  it('reads nothing for a visitor', async () => {
    setup(null);
    store.watch();
    await settle();
    backend.expectNone((r) => r.url === LIST);
  });

  it('renames through the server and reads the list again', async () => {
    await watching([row(1)]);
    store.rename(1, 'Tên mới');
    await settle();
    const request = backend.expectOne(`${LIST}/1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ title: 'Tên mới' });
    request.flush(envelopeOk(row(1, 'Tên mới')));
    await settle();
    lists()[0].flush(page([row(1, 'Tên mới')]));
    await settle();
    expect(store.items$()[0].title).toBe('Tên mới');
  });

  it('asks before deleting, deletes only after Xoá, then tells the chats which one is gone', async () => {
    await watching([row(1), row(2)]);
    const gone: (number | 'all')[] = [];
    store.removed.subscribe((id) => gone.push(id));

    store.remove(row(1));
    await confirmDialog('Hủy');
    backend.expectNone(`${LIST}/1`);
    expect(gone).toEqual([]);

    store.remove(row(1));
    await confirmDialog('Xoá');
    const request = backend.expectOne(`${LIST}/1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(envelopeOk(null));
    await settle();
    expect(gone).toEqual([1]);
    lists()[0].flush(page([row(2)]));
    await settle();
    expect(store.items$().map((c) => c.id)).toEqual([2]);
  });

  it('keeps the conversation and says nothing is gone when the server refuses a delete', async () => {
    await watching([row(1)]);
    const gone: (number | 'all')[] = [];
    store.removed.subscribe((id) => gone.push(id));

    store.remove(row(1));
    await confirmDialog('Xoá');
    const refusal = backendRefusal('assistantConversationNotFound');
    backend
      .expectOne(`${LIST}/1`)
      .flush(refusal.body, { status: refusal.status, statusText: 'OK' });
    await settle();

    expect(gone).toEqual([]);
  });

  it('deletes everything only after the user agrees', async () => {
    await watching([row(1), row(2)]);
    const gone: (number | 'all')[] = [];
    store.removed.subscribe((id) => gone.push(id));

    store.removeAll();
    await confirmDialog('Hủy');
    backend.expectNone((r) => r.url === LIST && r.method === 'DELETE');

    store.removeAll();
    await confirmDialog('Xoá tất cả');
    const request = backend.expectOne(
      (r) => r.url === LIST && r.method === 'DELETE',
    );
    request.flush(envelopeOk(null));
    await settle();
    expect(gone).toEqual(['all']);
    lists()[0].flush(page([]));
    await settle();
    expect(store.items$()).toEqual([]);
  });

  it('reads a conversation with its turns for a chat that reopens it', async () => {
    let received: unknown;
    store.detail(4).subscribe((detail) => (received = detail));
    await settle();
    backend.expectOne(`${LIST}/4`).flush(envelopeOk({ ...row(4), turns: [] }));
    await settle();
    expect(received).toMatchObject({ id: 4, turns: [] });
  });

  it('reads the list again after a chat saved a turn', async () => {
    await watching([row(1)]);
    store.touch();
    await settle();
    expect(lists()).toHaveLength(1);
  });
});
