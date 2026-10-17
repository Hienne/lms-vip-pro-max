import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  envelopeError,
  envelopeOk,
  orgFixtures,
  profileFixtures,
  unitAdminOrg,
} from '@lms/mocks';
import type { OrgUnit } from '@lms/contracts';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import {
  FakeSessionStore,
  fakeSession,
} from '../../../core/session/session.testing';
import { SessionStore } from '../../../core/session/session.store';

describe('Org', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
    backend.verify();
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  async function open(
    role: 'admin' | 'unit-admin' = 'admin',
    org: readonly OrgUnit[] = orgFixtures,
  ) {
    fakeSession().user.set(profileFixtures[role]);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/org');
    await settle();
    backend.expectOne('/api/admin/org').flush(envelopeOk(org));
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) =>
        b.textContent?.includes(label) ||
        b.getAttribute('aria-label')?.includes(label),
    ) as HTMLButtonElement | undefined;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const alertDialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');
  const groupCards = () => Array.from(el.querySelectorAll('article'));

  async function type(field: HTMLInputElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }
  const inputOf = (label: string) =>
    Array.from(dialog()?.querySelectorAll<HTMLElement>('ui-field') ?? [])
      .find((f) => f.querySelector('label')?.textContent?.includes(label))
      ?.querySelector('input') as HTMLInputElement;

  const [first, second] = orgFixtures;

  it('lists the units and shows the first one with its groups and admins', async () => {
    await open();
    expect(el.querySelector('h1')?.textContent).toBe('Đơn vị, phòng & nhóm');
    expect(text()).toContain(first.name);
    expect(text()).toContain(`${first.code} · ${first.members} người`);
    expect(el.querySelector('h2')?.textContent).toBe(first.name);
    expect(groupCards()).toHaveLength(first.groups.length);
    expect(text()).toContain(
      `Quản trị viên: ${first.admins[0].name} (Toàn hệ thống)`,
    );
    expect(text()).toContain('Chưa có. Chia sẻ tại màn Khóa học');
  });

  it('shows another unit when it is picked, with the courses shared with it', async () => {
    await open();
    button(el, second.name)?.click();
    await settle();
    expect(el.querySelector('h2')?.textContent).toBe(second.name);
    expect(groupCards()).toHaveLength(second.groups.length);
    expect(text()).toContain(second.sharedCourses[0].title);
    expect(button(el, second.name)?.getAttribute('aria-current')).toBe('true');
  });

  it('links each member to the user page and says "đơn vị" for a limited admin', async () => {
    await open();
    button(el, second.name)?.click();
    await settle();
    const link = el.querySelector<HTMLAnchorElement>('article a');
    expect(link?.getAttribute('href')).toMatch(/^\/admin\/users\//);
    expect(text()).toContain('Quản trị viên đơn vị');
  });

  it('cuts a long member list to five', async () => {
    const group = {
      ...first.groups[0],
      members: Array.from({ length: 7 }, (_, i) => ({
        ...(first.groups[0].members[0] ?? {
          id: 'x',
          name: 'N',
          email: 'n@demo.cb',
          roleId: 'learner',
          roleName: 'Học viên',
          scopeUnitId: null,
        }),
        id: `m${i}`,
      })),
    };
    await open('admin', [{ ...first, groups: [group] }, second]);
    expect(groupCards()[0].querySelectorAll('li a')).toHaveLength(5);
    expect(text()).toContain('+2 người khác');
  });

  it('shows a unit administrator only its unit, without creating or pausing units', async () => {
    await open('unit-admin', unitAdminOrg);
    expect(el.querySelector('h2')?.textContent).toBe(second.name);
    expect(button(el, 'Thêm đơn vị')).toBeUndefined();
    expect(button(el, 'Tạm dừng')).toBeUndefined();
    expect(button(el, 'Sửa')).toBeTruthy();
  });

  it('pauses a unit after confirming, then reloads', async () => {
    await open();
    button(el, 'Tạm dừng')?.click();
    await settle();
    expect(alertDialog()?.textContent).toContain(
      `Tạm dừng đơn vị ${first.name}?`,
    );
    backend.expectNone(`/api/admin/units/${first.id}/status`);
    button(alertDialog() as HTMLElement, 'Xác nhận')?.click();
    await settle();
    const put = backend.expectOne(`/api/admin/units/${first.id}/status`);
    expect(put.request.body).toEqual({ status: 'paused' });
    put.flush(
      envelopeOk({
        id: first.id,
        code: first.code,
        name: first.name,
        status: 'paused',
      }),
    );
    await settle();
    backend
      .expectOne('/api/admin/org')
      .flush(envelopeOk([{ ...first, status: 'paused' }, second]));
    await settle();
    expect(text()).toContain('Tạm dừng');
    expect(button(el, 'Kích hoạt')).toBeTruthy();
  });

  it('adds a unit: checks locally, then sends the command and reloads', async () => {
    await open();
    button(el, 'Thêm đơn vị')?.click();
    await settle();
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    backend.expectNone('/api/admin/units');
    expect(dialog()?.textContent).toContain('Nhập mã đơn vị.');
    expect(dialog()?.textContent).toContain('Nhập tên đơn vị.');
    await type(inputOf('Mã đơn vị'), ' CNTT ');
    await type(inputOf('Tên đơn vị'), 'Khối CNTT');
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    const post = backend.expectOne('/api/admin/units');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ code: 'CNTT', name: 'Khối CNTT' });
    post.flush(
      envelopeOk({
        id: 'u9',
        code: 'CNTT',
        name: 'Khối CNTT',
        status: 'active',
      }),
    );
    await settle();
    expect(dialog()).toBeNull();
    backend.expectOne('/api/admin/org').flush(envelopeOk(orgFixtures));
    await settle();
    expect(document.body.textContent).toContain('Đã lưu');
  });

  it('keeps the drawer open and toasts the backend message when a unit save is refused', async () => {
    await open();
    button(el, 'Thêm đơn vị')?.click();
    await settle();
    await type(inputOf('Mã đơn vị'), first.code);
    await type(inputOf('Tên đơn vị'), 'Trùng mã');
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    backend
      .expectOne('/api/admin/units')
      .flush(
        envelopeError(
          'CORE-0409',
          'Không lưu được đơn vị',
          'Mã đơn vị đã tồn tại.',
        ),
      );
    await settle();
    expect(dialog()).not.toBeNull();
    expect(inputOf('Mã đơn vị').value).toBe(first.code);
    expect(document.body.textContent).toContain('Không lưu được đơn vị');
    expect(document.body.textContent).toContain('Mã đơn vị đã tồn tại.');
  });

  it('edits the picked unit with the form prefilled and sends its id', async () => {
    await open();
    button(el, 'Sửa')?.click();
    await settle();
    expect(dialog()?.textContent).toContain('Sửa đơn vị');
    expect(inputOf('Mã đơn vị').value).toBe(first.code);
    await type(inputOf('Tên đơn vị'), 'Tên mới');
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    const post = backend.expectOne('/api/admin/units');
    expect(post.request.body).toEqual({
      id: first.id,
      code: first.code,
      name: 'Tên mới',
    });
    post.flush(envelopeOk({ ...first, name: 'Tên mới' }));
    await settle();
    backend.expectOne('/api/admin/org').flush(envelopeOk(orgFixtures));
    await settle();
  });

  it('adds a group to the picked unit', async () => {
    await open();
    button(el, 'Thêm phòng/nhóm')?.click();
    await settle();
    expect(dialog()?.textContent).toContain(
      `Thêm phòng/nhóm vào ${first.name}`,
    );
    await type(inputOf('Tên phòng/nhóm'), 'Nhóm mới');
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    const post = backend.expectOne('/api/admin/groups');
    expect(post.request.body).toEqual({ name: 'Nhóm mới', unitId: first.id });
    post.flush(envelopeOk(first.groups[0]));
    await settle();
    backend.expectOne('/api/admin/org').flush(envelopeOk(orgFixtures));
    await settle();
  });

  it('renames a group and keeps its kind', async () => {
    await open();
    const group = first.groups[0];
    button(groupCards()[0], `Đổi tên ${group.name}`)?.click();
    await settle();
    expect(dialog()?.textContent).toContain('Đổi tên phòng/nhóm');
    expect(inputOf('Tên phòng/nhóm').value).toBe(group.name);
    await type(inputOf('Tên phòng/nhóm'), 'Tên khác');
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    const post = backend.expectOne('/api/admin/groups');
    expect(post.request.body).toEqual({
      id: group.id,
      kind: group.kind,
      name: 'Tên khác',
      unitId: first.id,
    });
    post.flush(envelopeOk(group));
    await settle();
    backend.expectOne('/api/admin/org').flush(envelopeOk(orgFixtures));
    await settle();
  });

  const escape = () =>
    dialog()?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    );

  it('keeps the unit drawer open on Escape while saving, and closes it after the response', async () => {
    await open();
    button(el, 'Thêm đơn vị')?.click();
    await settle();
    await type(inputOf('Mã đơn vị'), 'CNTT');
    await type(inputOf('Tên đơn vị'), 'Khối CNTT');
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    const post = backend.expectOne('/api/admin/units');
    expect(dialog()?.textContent).toContain('Đang lưu…');

    escape();
    await settle();
    expect(dialog()).not.toBeNull();

    post.flush(
      envelopeOk({
        id: 'u9',
        code: 'CNTT',
        name: 'Khối CNTT',
        status: 'active',
      }),
    );
    await settle();
    expect(dialog()).toBeNull();
    backend.expectOne('/api/admin/org').flush(envelopeOk(orgFixtures));
    await settle();
  });

  it('keeps the group drawer open on Escape while saving, and closes it after the response', async () => {
    await open();
    button(el, 'Thêm phòng/nhóm')?.click();
    await settle();
    await type(inputOf('Tên phòng/nhóm'), 'Nhóm mới');
    button(dialog() as HTMLElement, 'Lưu')?.click();
    await settle();
    const post = backend.expectOne('/api/admin/groups');
    expect(dialog()?.textContent).toContain('Đang lưu…');

    escape();
    await settle();
    expect(dialog()).not.toBeNull();

    post.flush(envelopeOk(first.groups[0]));
    await settle();
    expect(dialog()).toBeNull();
    backend.expectOne('/api/admin/org').flush(envelopeOk(orgFixtures));
    await settle();
  });

  it('deletes a group after confirming, then reloads', async () => {
    await open();
    const group = first.groups[0];
    button(groupCards()[0], `Xóa ${group.name}`)?.click();
    await settle();
    expect(alertDialog()?.textContent).toContain('Xóa phòng/nhóm?');
    button(alertDialog() as HTMLElement, 'Xóa')?.click();
    await settle();
    const del = backend.expectOne(`/api/admin/groups/${group.id}`);
    expect(del.request.method).toBe('DELETE');
    del.flush(envelopeOk(true));
    await settle();
    backend.expectOne('/api/admin/org').flush(envelopeOk(orgFixtures));
    await settle();
    expect(document.body.textContent).toContain('Đã xóa');
  });

  it('tells the user when the server refuses to delete a group with members', async () => {
    await open();
    const group = first.groups[0];
    button(groupCards()[0], `Xóa ${group.name}`)?.click();
    await settle();
    button(alertDialog() as HTMLElement, 'Xóa')?.click();
    await settle();
    backend
      .expectOne(`/api/admin/groups/${group.id}`)
      .flush(
        envelopeError(
          'CORE-0412',
          'Không xóa được nhóm',
          'Nhóm còn thành viên — hãy chuyển thành viên sang nhóm khác trước.',
        ),
      );
    await settle();
    expect(document.body.textContent).toContain('Không xóa được nhóm');
    expect(document.body.textContent).toContain('Nhóm còn thành viên');
  });

  it('does not delete when the confirmation is cancelled', async () => {
    await open();
    button(groupCards()[0], 'Xóa')?.click();
    await settle();
    button(alertDialog() as HTMLElement, 'Hủy')?.click();
    await settle();
    backend.expectNone((req) => req.method === 'DELETE');
  });
});
