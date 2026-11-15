import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { organizationEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { invalidation } from '../../../../core/data-access/invalidation';
import { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  ReplyGate,
  signInToMockBackend,
} from '../../../../core/dev/mock-api/mock-backend.testing';
import { OrgTreeStore } from './org-tree.store';
import { SessionStore } from '../../../../core/session/session.store';
import {
  FakeSessionStore,
  seedProfile,
} from '../../../../core/session/session.testing';

describe('OrgTreeStore', () => {
  let handle: MockInstance<MockBackend['handle']>;
  let token: string;

  const treeReads = () =>
    handle.mock.calls.filter(
      ([endpoint]) => endpoint === organizationEndpoints.orgTree,
    );
  const rootReads = () =>
    treeReads().filter(([, request]) => !('parentId' in request.query)).length;

  /** Adds departments under the seeded root (id 1) before the store reads the tree. */
  const addDepartments = (count: number) => {
    for (let i = 1; i <= count; i++) {
      TestBed.inject(MockBackend).handle(organizationEndpoints.createOrg, {
        token,
        params: {},
        query: {},
        body: {
          orgType: 'DEPARTMENT',
          parentId: 1,
          code: `PB${i}`,
          name: `Phòng ${i}`,
          sortNo: i,
        },
      });
    }
  };

  const start = () => {
    const store = TestBed.inject(OrgTreeStore);
    TestBed.tick();
    return store;
  };
  const childrenOfRoot = (store: OrgTreeStore) =>
    (store.nodes$()[0].children ?? []).map((node) => node.label);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        OrgTreeStore,
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    token = signInToMockBackend('super.admin');
  });

  it('opens the parent and selects the signed-in user department', async () => {
    addDepartments(1);
    const session = TestBed.inject(SessionStore) as unknown as FakeSessionStore;
    const profile = seedProfile('000001');
    session.user.set({
      ...profile,
      org: { id: 2, code: 'PB1', name: 'Phòng 1', type: 'DEPARTMENT' },
    });
    const store = start();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
    expect(store.expanded$()).toContain('1');
    expect(store.selected$()?.name).toBe('Phòng 1');
  });
  it('reads the roots from the tree endpoint, without parentId', () => {
    const store = start();
    expect(treeReads()[0][1].query).toEqual({ page: '0', size: '50' });
    expect(
      handle.mock.calls.some(([e]) => e === organizationEndpoints.listOrgs),
    ).toBe(false);
    expect(store.nodes$().map((node) => node.id)).toEqual(['1']);
  });

  it('shows a node without children as a leaf, with no placeholder, whatever its type', () => {
    const store = start();
    expect(store.nodes$()[0].data?.orgType).toBe('UNIT');
    expect(store.nodes$()[0].children).toBeUndefined();
  });

  it('opens a node with children by reading its level with parentId', () => {
    addDepartments(2);
    const store = start();
    expect(childrenOfRoot(store)).toEqual(['Đang tải…']);

    store.expand(['1']);
    TestBed.tick();
    expect(treeReads().at(-1)?.[1].query).toEqual({
      parentId: '1',
      page: '0',
      size: '50',
    });
    expect(childrenOfRoot(store)).toEqual(['Phòng 1', 'Phòng 2']);
  });

  it('reads the next page of a level from "Xem thêm…"', () => {
    addDepartments(51);
    const store = start();
    store.expand(['1']);
    TestBed.tick();
    expect(childrenOfRoot(store)).toHaveLength(51);
    expect(childrenOfRoot(store).at(-1)).toBe('Xem thêm…');

    store.select('more:1');
    TestBed.tick();
    expect(treeReads().at(-1)?.[1].query).toMatchObject({
      parentId: '1',
      page: '1',
    });
    expect(childrenOfRoot(store)).toHaveLength(51);
    expect(childrenOfRoot(store).at(-1)).toBe('Phòng 51');
  });

  it('shows no "Xem thêm…" on the last page of a level', () => {
    addDepartments(50);
    const store = start();
    store.expand(['1']);
    TestBed.tick();
    expect(childrenOfRoot(store)).toHaveLength(50);
    expect(childrenOfRoot(store)).not.toContain('Xem thêm…');
  });

  it('reads the loaded levels again when the change token is bumped, and not before', () => {
    const store = start();
    const changes = invalidation();
    TestBed.runInInjectionContext(() => store.reloadOn(changes));
    TestBed.tick();
    expect(rootReads()).toBe(1);

    changes.bump();
    TestBed.tick();
    expect(rootReads()).toBe(2);
  });

  it('drops the answer to a level read before a reload, so no node shows twice', () => {
    addDepartments(51);
    const store = start();
    const changes = invalidation();
    TestBed.runInInjectionContext(() => store.reloadOn(changes));
    store.expand(['1']);
    TestBed.tick();

    const hold = TestBed.inject(ReplyGate).hold(organizationEndpoints.orgTree);
    store.select('more:1');
    changes.bump();
    TestBed.tick();
    expect(hold.pending()).toBe(3);
    // The second page asked before the reload lands first; the reload's first page replaces it.
    hold.release();
    TestBed.tick();

    const ids = (store.nodes$()[0].children ?? []).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(51);
    expect(ids.at(-1)).toBe('more:1');
  });

  it('drops a "Xem thêm…" answer that lands after the reload, so no node shows twice', () => {
    addDepartments(51);
    const store = start();
    const changes = invalidation();
    TestBed.runInInjectionContext(() => store.reloadOn(changes));
    store.expand(['1']);
    TestBed.tick();

    const hold = TestBed.inject(ReplyGate).hold(organizationEndpoints.orgTree);
    store.select('more:1');
    changes.bump();
    TestBed.tick();
    expect(hold.pending()).toBe(3);
    // The reload's two reads land first; the second page asked before it comes last.
    hold.releaseLast();
    hold.releaseLast();
    TestBed.tick();
    hold.release();
    TestBed.tick();

    const ids = (store.nodes$()[0].children ?? []).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(51);
    expect(ids.at(-1)).toBe('more:1');
  });

  it('reads a level again on retry after its read failed', () => {
    addDepartments(2);
    const store = start();
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((endpoint, request) =>
      endpoint === organizationEndpoints.orgTree && 'parentId' in request.query
        ? backendRefusal('internalError')
        : MockBackend.prototype.handle.call(backend, endpoint, request),
    );
    store.expand(['1']);
    TestBed.tick();
    expect(store.loadError$()).toBeDefined();

    handle.mockImplementation((endpoint, request) =>
      MockBackend.prototype.handle.call(backend, endpoint, request),
    );
    store.retry();
    TestBed.tick();
    expect(store.loadError$()).toBeUndefined();
    expect(store.expanded$()).toEqual(['1']);
    expect(childrenOfRoot(store)).toEqual(['Phòng 1', 'Phòng 2']);
  });
});
