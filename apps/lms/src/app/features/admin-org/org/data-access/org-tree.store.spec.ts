import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { organizationEndpoints } from '@lms/contracts';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { invalidation } from '../../../../core/data-access/invalidation';
import { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../../core/dev/mock-api/mock-backend.testing';
import { OrgTreeStore } from './org-tree.store';

describe('OrgTreeStore', () => {
  let store: OrgTreeStore;
  let handle: MockInstance<MockBackend['handle']>;

  const rootReads = () =>
    handle.mock.calls.filter(
      ([endpoint, request]) =>
        endpoint === organizationEndpoints.listOrgs &&
        request.query['rootOnly'] === 'true',
    ).length;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        OrgTreeStore,
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    signInToMockBackend('super.admin');
    store = TestBed.inject(OrgTreeStore);
  });

  it('reads the loaded levels again when the change token is bumped, and not before', () => {
    const changes = invalidation();
    TestBed.runInInjectionContext(() => store.reloadOn(changes));
    TestBed.tick();
    expect(rootReads()).toBe(1);

    changes.bump();
    TestBed.tick();
    expect(rootReads()).toBe(2);
  });
});
