import {
  createEnvironmentInjector,
  EnvironmentInjector,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { courseEndpoints } from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
import type { MockInstance } from 'vitest';
import { parseAppConfig, provideAppConfig } from '../../core/config/app-config';
import { testAppConfig } from '../../core/config/app-config.testing';
import { MockBackend } from '../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../core/dev/mock-api/mock-backend.testing';
import { EndpointClient } from '../../core/http/endpoint-client';
import { coverPreviews } from './cover-image';

describe('coverPreviews', () => {
  let handle: MockInstance<MockBackend['handle']>;
  const original = {
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
      ],
    });
    signInToMockBackend('hocvien');
    let next = 0;
    URL.createObjectURL = vi.fn(() => `blob:cover-${++next}`);
    URL.revokeObjectURL = vi.fn();
    handle = vi
      .spyOn(TestBed.inject(MockBackend), 'handle')
      .mockImplementation((endpoint, request) =>
        endpoint === courseEndpoints.getAssetContent
          ? request.params['assetId'] === '9'
            ? backendRefusal('accessDenied')
            : {
                status: 200,
                body: envelopeOk(null),
                file: new Blob(['png'], { type: 'image/png' }),
              }
          : undefined,
      );
  });

  afterEach(() => {
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  /** The helper in a scope of its own, so the test can end it like a page store. */
  function create(ids: () => readonly (number | null)[]) {
    const scope = createEnvironmentInjector(
      [],
      TestBed.inject(EnvironmentInjector),
    );
    const covers = coverPreviews(TestBed.inject(EndpointClient), scope, ids);
    return { covers, scope };
  }

  const reads = () =>
    handle.mock.calls.filter(([e]) => e === courseEndpoints.getAssetContent)
      .length;

  it('reads each cover once, skips cards without one, and maps it by asset id', async () => {
    const { covers } = create(() => [5, null, 6, 5]);
    await settle();
    expect(reads()).toBe(2);
    expect(covers().get(5)).toEqual({ state: 'ready', src: 'blob:cover-1' });
    expect(covers().get(6)).toEqual({ state: 'ready', src: 'blob:cover-2' });
  });

  it('marks a refused cover failed', async () => {
    const { covers } = create(() => [9]);
    await settle();
    expect(covers().get(9)).toEqual({ state: 'failed' });
  });

  it('keeps a cover it read when the list changes and comes back, without reading it again', async () => {
    const ids = signal<readonly number[]>([5]);
    const { covers } = create(() => ids());
    await settle();
    ids.set([6]);
    await settle();
    ids.set([5]);
    await settle();
    expect(reads()).toBe(2);
    expect(covers().get(5)).toEqual({ state: 'ready', src: 'blob:cover-1' });
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revokes every object URL when its owner is destroyed', async () => {
    const { scope } = create(() => [5, 6]);
    await settle();
    scope.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover-2');
  });
});
