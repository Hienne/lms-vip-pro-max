import type { MockInstance } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { organizationEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import { Toaster } from '@lms/ui';
import { throwError } from 'rxjs';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  ReplyGate,
  signInToMockBackend,
} from '../../../../core/dev/mock-api/mock-backend.testing';
import { FileSaver } from '../../../../core/files/file-saver';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { ORG_IMPORT_TEMPLATE_NAME, OrgImportStore } from './org-import.store';
import { OrgStore } from './org.store';

describe('OrgImportStore', () => {
  let store: OrgImportStore;
  let handle: MockInstance<MockBackend['handle']>;
  const save = vi.fn();
  const org = {
    selected$: signal({ id: 1, code: 'BIDV110B803' }),
    canManageOrgs$: signal(true),
    closeImport: vi.fn(),
    finishImport: vi.fn(),
  };

  const xlsx = (name = 'don-vi.xlsx', bytes = 10) =>
    new File([new Uint8Array(bytes)], name);
  const imports = () =>
    handle.mock.calls.filter(
      ([endpoint]) => endpoint === organizationEndpoints.importOrgs,
    );
  const answer = (
    endpoint: unknown,
    reply: ReturnType<typeof backendRefusal>,
  ) => {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((e, request) =>
      e === endpoint
        ? reply
        : MockBackend.prototype.handle.call(backend, e, request),
    );
  };
  /** A refusal of a blob endpoint arrives as a Blob and is read before it fails. */
  const settle = async () => {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
  };

  beforeEach(() => {
    save.mockReset();
    org.closeImport.mockReset();
    org.finishImport.mockReset();
    org.canManageOrgs$.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        { provide: FileSaver, useValue: { save } },
        { provide: OrgStore, useValue: org },
        OrgImportStore,
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    signInToMockBackend('super.admin');
    store = TestBed.inject(OrgImportStore);
  });

  it('saves the template under its name', async () => {
    store.downloadTemplate();
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(save.mock.calls[0][1]).toBe(ORG_IMPORT_TEMPLATE_NAME);
  });

  it('toasts a refused template download and saves nothing', async () => {
    const toast = vi.spyOn(TestBed.inject(Toaster), 'error');
    answer(
      organizationEndpoints.orgImportTemplate,
      backendRefusal('accessDenied'),
    );
    store.downloadTemplate();
    await vi.waitFor(async () => {
      await settle();
      expect(toast).toHaveBeenCalledWith(
        'Không có quyền truy cập',
        'Bạn không có quyền thực hiện thao tác này.',
      );
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a wrong type or a file over 5 MB without sending it', () => {
    store.pick(xlsx('don-vi.xls'));
    expect(store.fileError$()).toBe('Chỉ nhận tệp Excel .xlsx.');
    expect(store.file$()).toBeUndefined();
    store.pick(xlsx('don-vi.xlsx', 5 * 1024 * 1024 + 1));
    expect(store.fileError$()).toBe('Tệp lớn hơn 5 MB.');
    store.check();
    TestBed.tick();
    expect(imports()).toHaveLength(0);
    expect(store.canCheck$()).toBe(false);
  });

  it('states the limits from ORG_IMPORT_LIMITS', () => {
    expect(store.limitsHint).toBe(
      'Tệp .xlsx, tối đa 5 MB và 1000 dòng dữ liệu.',
    );
  });

  it('accepts a file of exactly 5 MB and an upper-case extension', () => {
    store.pick(xlsx('DON-VI.XLSX', 5 * 1024 * 1024));
    expect(store.fileError$()).toBeUndefined();
    expect(store.file$()?.name).toBe('DON-VI.XLSX');
    expect(store.canCheck$()).toBe(true);
  });

  it('clears the file and its error when the pick is empty', () => {
    store.pick(xlsx());
    store.pick(undefined);
    expect(store.file$()).toBeUndefined();
    store.pick(xlsx('don-vi.xls'));
    store.pick(undefined);
    expect(store.fileError$()).toBeUndefined();
    expect(store.canCheck$()).toBe(false);
  });

  it('checks the file with dryRun and allows the import only then', () => {
    store.pick(xlsx());
    expect(store.fileError$()).toBeUndefined();
    expect(store.canImport$()).toBe(false);
    store.check();
    TestBed.tick();
    expect(imports()[0][1].query).toEqual({ dryRun: 'true' });
    expect(store.checked$()).toMatchObject({
      dryRun: true,
      organizationCount: 1,
      teamCount: 1,
    });
    expect(store.canImport$()).toBe(true);
  });

  it('a new file clears the check result', () => {
    store.pick(xlsx());
    store.check();
    TestBed.tick();
    store.pick(xlsx('khac.xlsx'));
    expect(store.checked$()).toBeUndefined();
    expect(store.canImport$()).toBe(false);
  });

  it('toasts an invalid file and leaves no check result', () => {
    const toast = vi.spyOn(TestBed.inject(Toaster), 'error');
    store.pick(xlsx('du-lieu-loi.xlsx'));
    store.check();
    TestBed.tick();
    expect(toast).toHaveBeenCalledWith(
      'Dữ liệu nhập chưa hợp lệ',
      'Tệp nhập chưa hợp lệ. Vui lòng kiểm tra các lỗi chi tiết.',
    );
    expect(store.checked$()).toBeUndefined();
    expect(store.canImport$()).toBe(false);
    expect(store.file$()?.name).toBe('du-lieu-loi.xlsx');
  });

  it('sends one import however often it is asked while pending, then closes and reloads once', () => {
    store.pick(xlsx());
    store.check();
    TestBed.tick();

    const hold = TestBed.inject(ReplyGate).hold(
      organizationEndpoints.importOrgs,
    );
    store.import();
    TestBed.tick();
    expect(store.canImport$()).toBe(false);
    store.import();
    store.check();
    TestBed.tick();
    expect(hold.pending()).toBe(1);
    hold.release();
    TestBed.tick();

    expect(imports()).toHaveLength(2);
    expect(imports()[1][1].query).toEqual({ dryRun: 'false' });
    expect(org.finishImport).toHaveBeenCalledTimes(1);
  });

  it('ignores a new file while the import is out, so the import still lands', () => {
    store.pick(xlsx());
    store.check();
    TestBed.tick();
    const hold = TestBed.inject(ReplyGate).hold(
      organizationEndpoints.importOrgs,
    );
    store.import();
    TestBed.tick();

    store.pick(xlsx('khac.xlsx'));
    store.pick(undefined);
    expect(store.file$()?.name).toBe('don-vi.xlsx');
    expect(store.isImporting$()).toBe(true);
    hold.release();
    TestBed.tick();

    expect(org.finishImport).toHaveBeenCalledTimes(1);
  });

  it('clears the check result when the import itself is refused', () => {
    store.pick(xlsx());
    store.check();
    TestBed.tick();
    answer(
      organizationEndpoints.importOrgs,
      backendRefusal('orgImportInvalid'),
    );
    store.import();
    TestBed.tick();
    expect(store.checked$()).toBeUndefined();
    expect(store.canImport$()).toBe(false);
    expect(org.finishImport).not.toHaveBeenCalled();
  });

  it('checks the same file again when it is picked again after a refusal', () => {
    const file = xlsx('du-lieu-loi.xlsx');
    store.pick(file);
    store.check();
    TestBed.tick();
    store.pick(file);
    expect(store.canCheck$()).toBe(true);
    store.check();
    TestBed.tick();
    expect(imports()).toHaveLength(2);
    expect(imports()[1][1].query).toEqual({ dryRun: 'true' });
  });

  it('toasts a refused import (403) and keeps the drawer open', () => {
    const toast = vi.spyOn(TestBed.inject(Toaster), 'error');
    store.pick(xlsx());
    store.check();
    TestBed.tick();
    answer(organizationEndpoints.importOrgs, backendRefusal('accessDenied'));
    store.import();
    TestBed.tick();
    expect(toast).toHaveBeenCalledWith(
      'Không có quyền truy cập',
      'Bạn không có quyền thực hiện thao tác này.',
    );
    expect(org.finishImport).not.toHaveBeenCalled();
    expect(org.closeImport).not.toHaveBeenCalled();
    expect(store.file$()?.name).toBe('don-vi.xlsx');
  });

  it('toasts the network message when the import cannot reach the server', () => {
    const toast = vi.spyOn(TestBed.inject(Toaster), 'error');
    store.pick(xlsx());
    store.check();
    TestBed.tick();
    const client = TestBed.inject(EndpointClient);
    const call = client.call.bind(client) as (...args: unknown[]) => unknown;
    vi.spyOn(client, 'call').mockImplementation(((
      endpoint: unknown,
      ...rest: unknown[]
    ) =>
      endpoint === organizationEndpoints.importOrgs
        ? throwError(() => new HttpErrorResponse({ status: 0 }))
        : call(endpoint, ...rest)) as EndpointClient['call']);
    store.import();
    TestBed.tick();
    expect(toast.mock.calls.flat()).toContain(
      'Không có kết nối mạng. Kiểm tra kết nối và thử lại.',
    );
    expect(org.finishImport).not.toHaveBeenCalled();
    expect(store.isImporting$()).toBe(false);
  });

  it('tells an org administrator that the file holds teams only', () => {
    expect(store.teamsOnly$()).toBe(false);
    org.canManageOrgs$.set(false);
    expect(store.teamsOnly$()).toBe(true);
    expect(store.selectedCode$()).toBe('BIDV110B803');
  });
});
