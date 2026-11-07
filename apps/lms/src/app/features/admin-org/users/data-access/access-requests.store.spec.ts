import { TestBed } from '@angular/core/testing';
import { identityEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import type { MockInstance } from 'vitest';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../../core/dev/mock-api/mock-backend.testing';
import { AccessRequestsChanged } from '../../../../core/admin/access-requests-changed';
import { AccessRequestsStore } from './access-requests.store';

describe('AccessRequestsStore', () => {
  let handle: MockInstance<MockBackend['handle']>;
  const original = (endpoint: unknown, request: unknown) =>
    MockBackend.prototype.handle.call(
      TestBed.inject(MockBackend),
      endpoint as never,
      request as never,
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        AccessRequestsStore,
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  async function open(username = 'quantri') {
    signInToMockBackend(username);
    const store = TestBed.inject(AccessRequestsStore);
    store.showList();
    await settle();
    return store;
  }

  const lists = () =>
    handle.mock.calls.filter(([e]) => e === identityEndpoints.accessRequests);
  const lastQuery = () =>
    (lists().at(-1)?.[1] as { query: Record<string, unknown> }).query;

  it('starts on the pending requests and counts them', async () => {
    const store = await open();
    expect(lastQuery()).toMatchObject({ status: 'PENDING', page: '0' });
    expect(store.rows$().every((r) => r.status === 'PENDING')).toBe(true);
    expect(store.total$()).toBe(3);
    expect(store.pendingCount$()).toBe(3);
  });

  it('counts pending requests without asking for the list while the tab is closed', async () => {
    signInToMockBackend('quantri');
    const store = TestBed.inject(AccessRequestsStore);
    await settle();
    expect(store.pendingCount$()).toBe(3);
    expect(
      lists().every(
        ([, r]) => (r as { query: { size?: string } }).query.size === '1',
      ),
    ).toBe(true);
  });

  it('goes back to the first page when a filter changes', async () => {
    const store = await open();
    store.goToPage(2);
    store.filterKind('REGISTER');
    await settle();
    expect(store.page$()).toBe(1);
    expect(lastQuery()).toMatchObject({ kind: 'REGISTER', page: '0' });
    store.filterStatus('');
    await settle();
    expect(lastQuery()['status']).toBeUndefined();
    store.search('  an ');
    await settle();
    expect(lastQuery()).toMatchObject({ q: 'an', page: '0' });
  });

  it('asks the server for the chosen page size and starts again at the first page', async () => {
    const store = await open();
    store.goToPage(2);
    store.changePageSize(50);
    await settle();
    expect(store.pageSize$()).toBe(50);
    expect(store.page$()).toBe(1);
    expect(lastQuery()).toMatchObject({ size: '50', page: '0' });
  });

  it('rejects a request, reloads the list and the count, and bumps the token', async () => {
    const store = await open();
    const changed = TestBed.inject(AccessRequestsChanged);
    const before = changed.version();
    const id = store.rows$()[0].requestId;
    store.reject(id, 'Không đúng đối tượng');
    await settle();
    expect(changed.version()).toBe(before + 1);
    expect(store.rows$().map((r) => r.requestId)).not.toContain(id);
    expect(store.pendingCount$()).toBe(2);
  });

  it('reloads the count when another module resolves a request', async () => {
    const store = await open();
    TestBed.inject(AccessRequestsChanged).bump();
    await settle();
    expect(lists().length).toBeGreaterThan(2);
    expect(store.pendingCount$()).toBe(3);
  });

  it('keeps the list when a rejection is refused, and does not bump the token', async () => {
    const store = await open();
    const changed = TestBed.inject(AccessRequestsChanged);
    const before = changed.version();
    handle.mockImplementation((endpoint, request) =>
      endpoint === identityEndpoints.rejectAccessRequest
        ? backendRefusal('stateConflict')
        : original(endpoint, request),
    );
    store.reject(store.rows$()[0].requestId);
    await settle();
    expect(changed.version()).toBe(before);
    expect(store.rows$()).toHaveLength(3);
  });
});
