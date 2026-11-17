import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { CatalogTree } from '@lms/contracts';
import { envelopeError, envelopeOk } from '@lms/mocks';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { TrainingCatalog } from './training-catalog';

const BASE = '/api/v1/training-catalog';

const row = {
  ownerOrgId: 1,
  description: null,
  sortNo: 0,
};
const course = {
  id: 9,
  code: 'KH-1',
  title: 'Khóa tiền gửi',
  lifecycleStatus: 'active',
  published: true,
} as const;
const tree: CatalogTree = {
  fields: [
    {
      ...row,
      id: 1,
      code: 'NV',
      name: 'Nghiệp vụ',
      description: 'Các phân hệ nghiệp vụ lõi.',
      status: 'published',
      rowVersion: 3,
      programs: [
        {
          ...row,
          id: 4,
          fieldId: 1,
          code: 'NV-01',
          name: 'Tiền gửi',
          status: 'published',
          rowVersion: 2,
          sortNo: 5,
          courses: [course],
        },
        {
          ...row,
          id: 5,
          fieldId: 1,
          code: 'NV-02',
          name: 'Tín dụng',
          status: 'draft',
          rowVersion: 0,
          courses: [],
        },
      ],
    },
    {
      ...row,
      id: 2,
      code: 'VH',
      name: 'Vận hành',
      status: 'draft',
      rowVersion: 1,
      programs: [],
    },
  ],
};

describe('TrainingCatalog', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<TrainingCatalog>;
  let el: HTMLElement;
  let handled: unknown[];

  beforeEach(() => {
    handled = [];
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        provideRouter([]),
        { provide: SessionStore, useClass: FakeSessionStore },
        {
          provide: ErrorHandler,
          useValue: { handleError: (e: unknown) => handled.push(e) },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fakeSession().user.set(seedProfile('000002'));
  });

  afterEach(() => {
    fixture?.destroy();
    backend.verify({ ignoreCancelled: true });
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  }

  const treeRequests = (): TestRequest[] =>
    backend.match((r) => r.url === `${BASE}/tree`);

  async function open(
    answer: CatalogTree = tree,
    initialModules: readonly unknown[] = [],
  ): Promise<void> {
    fixture = TestBed.createComponent(TrainingCatalog);
    el = fixture.nativeElement as HTMLElement;
    await settle();
    const [request] = treeRequests();
    request.flush(envelopeOk(answer));
    await settle();
    backend
      .match((r) => r.url === `${BASE}/modules`)
      .forEach((request) =>
        request.flush(
          envelopeOk({
            items: initialModules,
            page: 0,
            size: 100,
            totalPages: initialModules.length ? 1 : 0,
            totalElements: initialModules.length,
          }),
        ),
      );
    await settle();
  }

  const text = (root: ParentNode = el) =>
    (root as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  const item = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="treeitem"]'))
      .filter((i) => i.textContent?.includes(label))
      .at(-1) as HTMLElement;
  const button = (label: string, root: ParentNode = el) =>
    Array.from(root.querySelectorAll<HTMLElement>('button, a')).find((b) =>
      `${b.textContent} ${b.getAttribute('aria-label') ?? ''}`.includes(label),
    );
  const detail = () =>
    el.querySelector<HTMLElement>('[aria-label="Chi tiết"]')!;
  const alertDialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');
  const drawer = () => document.querySelector<HTMLElement>('[role="dialog"]');

  async function pick(label: string): Promise<void> {
    (item(label) ?? button(label, detail()))!.click();
    await settle();
  }

  async function confirmDialog(): Promise<void> {
    const dialog = alertDialog();
    expect(dialog).toBeTruthy();
    button('Xác nhận', dialog!)?.click();
    (
      Array.from(dialog!.querySelectorAll('button')).find(
        (b) => !b.getAttribute('aria-label') && b.textContent?.trim() !== 'Hủy',
      ) as HTMLElement
    ).click();
    await settle();
  }

  it('reads the tree of the caller org and shows the first field', async () => {
    await open();

    expect(text(el.querySelector('ui-tree')!)).toContain('Nghiệp vụ');
    expect(text(el.querySelector('ui-tree')!)).toContain('Vận hành');
    expect(text(detail())).toContain('lĩnh vực · NV');
    expect(text(detail())).toContain('Các phân hệ nghiệp vụ lõi.');
    expect(text(detail())).toContain('Chương trình (2)');
  });

  it('shows the selected field modules and opens their management form', async () => {
    await open(tree, [
      {
        id: 31,
        fieldId: 1,
        code: 'DEP',
        name: 'Tiền gửi',
        status: 'published',
        rowVersion: 0,
      },
    ]);
    expect(text(detail())).toContain('Phân hệ nghiệp vụ');
    expect(text(detail())).toContain('Tiền gửi · DEP');
    button('Quản lý phân hệ', detail())!.click();
    await settle();
    backend
      .expectOne(
        (r) => r.url === `${BASE}/modules` && r.params.get('fieldId') === '1',
      )
      .flush(
        envelopeOk({
          items: [
            {
              id: 31,
              fieldId: 1,
              code: 'DEP',
              name: 'Tiền gửi',
              status: 'published',
              rowVersion: 0,
            },
          ],
          page: 0,
          size: 100,
          totalPages: 1,
          totalElements: 1,
        }),
      );
    await settle();
    expect(text(drawer()!)).toContain('Phân hệ nghiệp vụ');
    expect(
      (drawer()!.querySelectorAll('input')[3] as HTMLInputElement).value,
    ).toBe('Tiền gửi');
  });

  it('adds multiple modules with the field in one save and removes unsaved rows immediately', async () => {
    await open();
    button('Thêm lĩnh vực')!.click();
    await settle();
    const dialog = drawer()!;
    button('Thêm phân hệ', dialog)!.click();
    await settle();
    button('Thêm phân hệ', dialog)!.click();
    await settle();
    const controls = Array.from(
      dialog.querySelectorAll<HTMLInputElement>('input'),
    );
    for (const [index, value] of [
      'NEW',
      'Lĩnh vực mới',
      'M1',
      'Thanh toán',
      'M2',
      'Tiền gửi',
    ].entries()) {
      controls[index].value = value;
      controls[index].dispatchEvent(new Event('input', { bubbles: true }));
    }
    await settle();
    button('Thêm phân hệ', dialog)!.click();
    await settle();
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
      .filter((b) => b.textContent?.includes('Xóa phân hệ'))
      .at(-1)!
      .click();
    await settle();
    expect(dialog.querySelectorAll('fieldset')).toHaveLength(2);
    (dialog.querySelector('button[type="submit"]') as HTMLElement).click();
    await settle();
    const request = backend.expectOne(`${BASE}/fields`);
    expect(request.request.body).toMatchObject({
      ownerOrgId: 1,
      code: 'NEW',
      modules: [
        { code: 'M1', name: 'Thanh toán', deleted: false },
        { code: 'M2', name: 'Tiền gửi', deleted: false },
      ],
    });
    expect(request.request.body.modules[0]).not.toHaveProperty('key');
    request.flush(
      envelopeOk({
        ...tree.fields[1],
        id: 20,
        code: 'NEW',
        name: 'Lĩnh vực mới',
      }),
    );
    await settle();
    treeRequests().forEach((r) => r.flush(envelopeOk(tree)));
  });

  it('loads all module pages before editing and stages an explicit versioned delete until save', async () => {
    await open();
    button('Sửa', detail())!.click();
    await settle();
    expect(text(drawer()!)).toContain('Đang tải phân hệ');
    const module = {
      id: 31,
      fieldId: 1,
      code: 'M1',
      name: 'Thanh toán',
      status: 'published',
      rowVersion: 4,
    };
    backend
      .expectOne(
        (r) => r.url === `${BASE}/modules` && r.params.get('page') === '0',
      )
      .flush(
        envelopeOk({
          items: [module],
          page: 0,
          size: 100,
          totalPages: 2,
          totalElements: 2,
        }),
      );
    backend
      .expectOne(
        (r) => r.url === `${BASE}/modules` && r.params.get('page') === '1',
      )
      .flush(
        envelopeOk({
          items: [{ ...module, id: 32, code: 'M2', name: 'Tiền gửi' }],
          page: 1,
          size: 100,
          totalPages: 2,
          totalElements: 2,
        }),
      );
    await settle();
    const dialog = drawer()!;
    const moduleCode = dialog.querySelectorAll<HTMLInputElement>('input')[2];
    moduleCode.value = '';
    moduleCode.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    button('Xóa phân hệ', dialog)!.click();
    await settle();
    expect(text(dialog)).toContain('Sẽ xóa: Thanh toán');
    expect(backend.match((r) => r.method === 'DELETE')).toHaveLength(0);
    (dialog.querySelector('button[type="submit"]') as HTMLElement).click();
    await settle();
    const request = backend.expectOne(`${BASE}/fields/1?expectedVersion=3`);
    expect(request.request.body.modules).toEqual([
      {
        id: 31,
        expectedVersion: 4,
        code: 'M1',
        name: 'Thanh toán',
        status: 'published',
        sortNo: 0,
        deleted: true,
      },
      {
        id: 32,
        expectedVersion: 4,
        code: 'M2',
        name: 'Tiền gửi',
        status: 'published',
        sortNo: 0,
        deleted: false,
      },
    ]);
    request.flush(envelopeOk(tree.fields[0]));
    await settle();
    treeRequests().forEach((r) => r.flush(envelopeOk(tree)));
  });

  it('asks the server for the org of the signed-in user', async () => {
    fixture = TestBed.createComponent(TrainingCatalog);
    await settle();
    const [request] = treeRequests();
    expect(request.request.params.get('ownerOrgId')).toBe('1');
    request.flush(envelopeOk(tree));
    await settle();
  });

  it('shows the program picked in the list and its courses', async () => {
    await open();
    await button('Tiền gửi', detail())!.click();
    await settle();

    expect(text(detail())).toContain('chương trình · NV-01');
    expect(text(detail())).toContain('Khóa học (1)');
    expect(text(detail())).toContain('Khóa tiền gửi');
    expect(button('Thêm khóa học', detail())?.getAttribute('href')).toBe(
      '/admin/courses/new',
    );
    expect(button('Sao chép', detail())).toBeTruthy();
    expect(button('Xóa', detail())).toBeUndefined();
  });

  it('shows ten courses per page and resets the page when selecting another node', async () => {
    const courses = Array.from({ length: 21 }, (_, index) => ({
      ...course,
      id: index + 100,
      code: 'KH-' + index,
      title: 'Khóa mẫu ' + (index + 1),
    }));
    const data: CatalogTree = {
      fields: [
        {
          ...tree.fields[0],
          programs: [
            { ...tree.fields[0].programs[0], courses },
            tree.fields[0].programs[1],
          ],
        },
        tree.fields[1],
      ],
    };
    await open(data);
    button('Tiền gửi', detail())!.click();
    await settle();
    expect(text(detail())).toContain('Khóa học (21)');
    expect(text(detail())).toContain('Khóa mẫu 10');
    expect(text(detail())).not.toContain('Khóa mẫu 11');
    button('2', detail().querySelector('ui-pagination')!)!.click();
    await settle();
    expect(text(detail())).toContain('Khóa mẫu 11');
    expect(text(detail())).not.toContain('Khóa mẫu 1 ');
    await pick('Nghiệp vụ');
    button('Tiền gửi', detail())!.click();
    await settle();
    expect(text(detail())).toContain('Khóa mẫu 10');
    expect(text(detail())).not.toContain('Khóa mẫu 11');
  });

  it('offers delete only for an empty program, and lists archive for a full one', async () => {
    await open();
    await pick('Tín dụng');

    expect(button('Xóa', detail())).toBeTruthy();
    expect(button('Lưu trữ', detail())).toBeTruthy();
    await pick('Nghiệp vụ');
    await pick('Tiền gửi');
    expect(button('Xóa', detail())).toBeUndefined();
    expect(button('Lưu trữ', detail())).toBeTruthy();
  });

  it('links a course to its own screens and offers no catalogue action on it', async () => {
    await open();
    await pick('Tiền gửi');
    await button('Khóa tiền gửi', detail())!.click();
    await settle();

    expect(text(detail())).toContain('khóa học · KH-1');
    expect(button('Sửa khóa học', detail())?.getAttribute('href')).toBe(
      '/admin/courses/9/edit',
    );
    expect(button('Xóa', detail())).toBeUndefined();
    expect(button('Tạm dừng', detail())).toBeUndefined();
  });

  it('deletes an empty program after confirming, with its row version, then reads the tree again', async () => {
    await open();
    await pick('Tín dụng');
    button('Xóa', detail())!.click();
    await settle();
    await confirmDialog();

    const request = backend.expectOne(`${BASE}/programs/5?expectedVersion=0`);
    expect(request.request.method).toBe('DELETE');
    request.flush(envelopeOk(null));
    await settle();
    expect(treeRequests()).toHaveLength(1);
  });

  it('keeps the program and tells why when the server says it is in use', async () => {
    await open();
    await pick('Tín dụng');
    button('Xóa', detail())!.click();
    await settle();
    await confirmDialog();

    backend
      .expectOne(`${BASE}/programs/5?expectedVersion=0`)
      .flush(
        envelopeError(
          'LEARNING-CATALOG_IN_USE',
          'Chưa thể xóa',
          'Mục còn nội dung bên trong.',
        ),
      );
    await settle();
    expect(treeRequests()).toHaveLength(0);
    expect(text(document.body)).toContain('Chưa thể xóa');
  });

  it('pauses a published program with a PUT of the whole row and its version', async () => {
    await open();
    await pick('Tiền gửi');
    button('Tạm dừng', detail())!.click();
    await settle();
    await confirmDialog();

    const request = backend.expectOne(`${BASE}/programs/4?expectedVersion=2`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      ownerOrgId: 1,
      fieldId: 1,
      code: 'NV-01',
      name: 'Tiền gửi',
      status: 'paused',
      sortNo: 5,
    });
    request.flush(
      envelopeOk({ ...tree.fields[0].programs[0], status: 'paused' }),
    );
    await settle();
    expect(treeRequests()).toHaveLength(1);
  });

  it('copies a program and selects the copy', async () => {
    await open();
    await pick('Tiền gửi');
    button('Sao chép', detail())!.click();
    await settle();

    const request = backend.expectOne(`${BASE}/programs/4/copy`);
    expect(request.request.method).toBe('POST');
    request.flush(
      envelopeOk({
        ...tree.fields[0].programs[0],
        id: 40,
        code: 'NV-01-COPY',
        name: 'Tiền gửi (bản sao)',
        status: 'draft',
        copiedFromProgramId: 4,
        rowVersion: 0,
      }),
    );
    await settle();
    expect(text(document.body)).toContain('Bản sao ở trạng thái Nháp');
    const [reload] = treeRequests();
    reload.flush(
      envelopeOk({
        fields: [
          {
            ...tree.fields[0],
            programs: [
              ...tree.fields[0].programs,
              {
                ...tree.fields[0].programs[0],
                id: 40,
                code: 'NV-01-COPY',
                name: 'Tiền gửi (bản sao)',
                status: 'draft',
                rowVersion: 0,
                courses: [],
              },
            ],
          },
          tree.fields[1],
        ],
      }),
    );
    await settle();
    expect(text(detail())).toContain('NV-01-COPY');
  });

  it('adds a program under the picked field as a draft, after checking the form', async () => {
    await open();
    button('Thêm chương trình', detail())!.click();
    await settle();

    const dialog = drawer()!;
    (dialog.querySelector('button[type="submit"]') as HTMLElement).click();
    await settle();
    expect(text(dialog)).toContain('Nhập mã.');
    expect(backend.match(() => true)).toHaveLength(0);

    const type = async (label: string, value: string) => {
      const control = Array.from(
        dialog.querySelectorAll<HTMLElement>('ui-field'),
      )
        .find((f) => f.querySelector('label')?.textContent?.includes(label))!
        .querySelector('input, textarea') as HTMLInputElement;
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    };
    await type('Mã', ' VH-02 ');
    await type('Tên', 'Vận hành nâng cao');
    (dialog.querySelector('button[type="submit"]') as HTMLElement).click();
    await settle();

    const request = backend.expectOne(`${BASE}/programs`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      ownerOrgId: 1,
      fieldId: 1,
      code: 'VH-02',
      name: 'Vận hành nâng cao',
      status: 'draft',
    });
  });

  it('filters the tree by name or code and keeps the ancestors of a match', async () => {
    await open();
    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'nv-02';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    await settle();

    const tree = text(el.querySelector('ui-tree')!);
    expect(tree).toContain('Nghiệp vụ');
    expect(tree).toContain('Tín dụng');
    expect(tree).not.toContain('Vận hành');
    expect(tree).not.toContain('Tiền gửi');
  });

  it('says so when nothing matches the search', async () => {
    await open();
    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'không có';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    await settle();

    expect(text(el)).toContain('Không có mục nào khớp.');
  });

  it('shows an empty state with the add button when there is no field', async () => {
    await open({ fields: [] });

    expect(text(el)).toContain('Chưa có lĩnh vực nào');
    expect(button('Thêm lĩnh vực')).toBeTruthy();
  });

  it('offers a retry when the tree cannot be read', async () => {
    fixture = TestBed.createComponent(TrainingCatalog);
    el = fixture.nativeElement as HTMLElement;
    await settle();
    treeRequests()[0].flush(
      envelopeError('CORE-INTERNAL_ERROR', 'Lỗi', 'Lỗi hệ thống.'),
      { status: 500, statusText: 'Server Error' },
    );
    await settle();

    expect(text(el)).toContain('Không tải được danh mục đào tạo');
    button('Thử lại')!.click();
    await settle();
    treeRequests()[0].flush(envelopeOk(tree));
    await settle();
    expect(text(el)).toContain('Nghiệp vụ');
  });
});
