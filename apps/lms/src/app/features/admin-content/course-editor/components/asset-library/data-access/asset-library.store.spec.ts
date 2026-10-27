import { TestBed } from '@angular/core/testing';
import type { MockInstance } from 'vitest';
import { assetEndpoints } from '@lms/contracts';
import { MockBackend } from '../../../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../../../../core/dev/mock-api/mock-backend.testing';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../../../core/config/app-config';
import { testAppConfig } from '../../../../../../core/config/app-config.testing';
import { SessionStore } from '../../../../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../../../../core/session/session.testing';
import { AssetLibraryStore } from './asset-library.store';

describe('AssetLibraryStore', () => {
  let store: AssetLibraryStore;
  let calls: MockInstance<MockBackend['handle']>;

  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  };
  const queries = () =>
    calls.mock.calls
      .filter(([endpoint]) => endpoint === assetEndpoints.listAssets)
      .map(([, request]) => request.query);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        { provide: SessionStore, useClass: FakeSessionStore },
        AssetLibraryStore,
      ],
    });
    signInToMockBackend('quantri');
    fakeSession().user.set(seedProfile('000002'));
    calls = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    store = TestBed.inject(AssetLibraryStore);
  });

  it('reads nothing until a block asks for the library', async () => {
    await settle();
    expect(queries()).toEqual([]);
    expect(store.target$()).toBeNull();
  });

  it.each([
    ['video', 'video'],
    ['pdf', 'document'],
    ['image', 'image'],
    ['attachment', 'attachment'],
  ] as const)(
    'lists the ready files of the kind a %s block holds (%s)',
    async (blockType, mediaType) => {
      store.open('k1', blockType);
      await settle();

      expect(queries()).toEqual([
        {
          page: '0',
          size: '20',
          mediaType,
          status: 'ready',
          sort: 'createTime,desc',
        },
      ]);
      expect(
        store.rows$().every((row) => row.asset.mediaType === mediaType),
      ).toBe(true);
    },
  );

  it('searches by name, sorts and pages on the server, starting again from page 1', async () => {
    store.open('k1', 'pdf');
    await settle();
    expect(store.total$()).toBeGreaterThan(0);

    store.search('  van-hanh ');
    await settle();
    expect(queries().at(-1)).toMatchObject({ q: 'van-hanh', page: '0' });
    expect(store.rows$().map((r) => r.name)).toEqual([
      'huong-dan-van-hanh.pdf',
    ]);

    store.search('');
    store.sortBy({ key: 'name', dir: 'asc' });
    await settle();
    expect(queries().at(-1)).toMatchObject({ sort: 'name,asc' });
    expect(queries().at(-1)).not.toHaveProperty('q');

    store.goToPage(2);
    await settle();
    expect(queries().at(-1)).toMatchObject({ page: '1' });
    store.sortBy({ key: 'uploaded', dir: 'desc' });
    await settle();
    expect(queries().at(-1)).toMatchObject({
      page: '0',
      sort: 'createTime,desc',
    });
  });

  it('forgets the search and the page when it is opened for another block', async () => {
    store.open('k1', 'pdf');
    store.search('van-hanh');
    await settle();

    store.close();
    store.open('k2', 'image');
    await settle();

    expect(store.target$()).toEqual({ blockKey: 'k2', blockType: 'image' });
    expect(store.query$()).toBe('');
    expect(queries().at(-1)).toMatchObject({ mediaType: 'image', page: '0' });
    expect(queries().at(-1)).not.toHaveProperty('q');
  });

  it('has no kind for a block without a file', async () => {
    store.open('k1', 'text');
    await settle();
    expect(queries()).toEqual([]);
  });
});
