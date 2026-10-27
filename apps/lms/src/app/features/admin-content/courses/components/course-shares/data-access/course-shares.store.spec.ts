import { Dialog } from '@angular/cdk/dialog';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  courseEndpoints,
  organizationEndpoints,
  type AnyEndpoint,
  type OrganizationInfo,
} from '@lms/contracts';
import { of } from 'rxjs';
import type { MockInstance } from 'vitest';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../../../core/config/app-config';
import { testAppConfig } from '../../../../../../core/config/app-config.testing';
import { MockBackend } from '../../../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../../../../core/dev/mock-api/mock-backend.testing';
import { SessionStore } from '../../../../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../../../../core/session/session.testing';
import type { FakeReply, FakeRequest } from '@lms/mocks';
import {
  CoursesStore,
  type CourseRow,
} from '../../../data-access/courses.store';
import { CourseSharesStore, type ShareRow } from './course-shares.store';

const org = (id: number, name: string, status = 'active'): OrganizationInfo =>
  ({
    id,
    parentId: id === 1 ? null : 1,
    orgType: 'UNIT',
    code: `U${id}`,
    name,
    status,
    sortNo: id,
    memberCount: 0,
    teamCount: 0,
  }) as OrganizationInfo;

const ORGS = [
  org(1, 'Ban Quản lý và phát triển Core Banking'),
  org(2, 'Chi nhánh Hà Nội'),
  org(3, 'Chi nhánh Đà Nẵng'),
  org(4, 'Chi nhánh Huế'),
];

/** The owner of course 5 is org 1; the seeded orgs are only that one, so the list is stood in. */
const page = (items: readonly OrganizationInfo[], size = 20) => ({
  status: 200,
  body: {
    responseId: 'r',
    timestamp: '2026-10-27T10:00:00',
    status: 'SUCCESS',
    messageCode: 'CORE-OK',
    message: 'OK',
    messageTitle: 'OK',
    data: {
      items,
      page: 0,
      size,
      totalElements: items.length,
      totalPages: 1,
    },
  },
});

describe('CourseSharesStore', () => {
  let store: CourseSharesStore;
  let calls: MockInstance<MockBackend['handle']>;
  let confirmed: boolean;

  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  };
  const callsTo = (endpoint: unknown) =>
    calls.mock.calls.filter(([e]) => e === endpoint).map(([, r]) => r);
  const row = (name: string): ShareRow =>
    [...store.active$(), ...store.revoked$()].find((r) => r.name === name)!;
  const rights = (over = {}) => ({
    includeDescendants: false,
    canAssign: true,
    canSelfEnroll: false,
    ...over,
  });

  beforeEach(() => {
    confirmed = true;
    const course = { card: { courseId: 5 } } as CourseRow;
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: CoursesStore, useValue: { sharing$: signal(course) } },
        {
          provide: Dialog,
          useValue: { open: () => ({ closed: of(confirmed) }) },
        },
        CourseSharesStore,
      ],
    });
    signInToMockBackend('quantri');
    fakeSession().user.set(seedProfile('000002'));
    const backend = TestBed.inject(MockBackend);
    const original = backend.handle.bind(backend) as (
      e: AnyEndpoint,
      r: FakeRequest,
    ) => FakeReply;
    calls = vi
      .spyOn(backend, 'handle')
      .mockImplementation((endpoint, request) => {
        if (endpoint !== organizationEndpoints.listOrgs) {
          return original(endpoint, request);
        }
        const q = (request.query['q'] ?? '').toLowerCase();
        const status = request.query['status'];
        return page(
          ORGS.filter(
            (o) =>
              (!q || o.name.toLowerCase().includes(q)) &&
              (!status || o.status === status),
          ),
          Number(request.query['size']),
        ) as FakeReply;
      });
    store = TestBed.inject(CourseSharesStore);
  });

  const share = async (orgId: number, over = {}) => {
    store.startAdd();
    store.pick({ id: orgId, name: `U${orgId}`, code: `U${orgId}` });
    store.add({ ...rights(), ...over });
    await settle();
  };

  it('reads the shares of the course and names each unit from the orgs', async () => {
    await settle();
    expect(callsTo(courseEndpoints.shares)[0]?.params).toEqual({
      courseId: '5',
    });
    expect(store.active$()).toEqual([]);
    expect(store.revoked$()).toEqual([]);

    await share(2, { includeDescendants: true, canSelfEnroll: true });

    expect(store.active$()).toHaveLength(1);
    expect(store.active$()[0]).toMatchObject({
      name: 'Chi nhánh Hà Nội',
      rights: 'Gồm đơn vị con · Được giao học · Học viên tự đăng ký',
    });
  });

  it('names the owner unit and falls back to "Đơn vị #<id>" for a unit it cannot read', async () => {
    await share(2);
    await settle();
    expect(store.ownerName$()).toBe('Ban Quản lý và phát triển Core Banking');

    await share(9);
    expect(store.active$().map((r) => r.name)).toContain('Đơn vị #9');
  });

  it('reads the orgs in pages of 100, at most five', async () => {
    await settle();
    const [query] = callsTo(organizationEndpoints.listOrgs).map((r) => r.query);
    expect(query).toMatchObject({ size: '100' });
  });

  it('offers the active units matching the search, without the owner and the units already shared', async () => {
    await share(2);
    store.startAdd();
    await settle();
    expect(callsTo(organizationEndpoints.listOrgs).at(-1)?.query).toEqual({
      status: 'active',
      size: '20',
    });
    expect(store.options$().map((o) => o.name)).toEqual([
      'Chi nhánh Đà Nẵng',
      'Chi nhánh Huế',
    ]);

    store.search('huế');
    await settle();
    expect(callsTo(organizationEndpoints.listOrgs).at(-1)?.query).toEqual({
      q: 'huế',
      status: 'active',
      size: '20',
    });
    expect(store.options$().map((o) => o.name)).toEqual(['Chi nhánh Huế']);
  });

  it('searches units only while the add form is open', async () => {
    await settle();
    const reads = () =>
      callsTo(organizationEndpoints.listOrgs).filter(
        (r) => r.query['status'] === 'active',
      ).length;
    expect(reads()).toBe(0);

    store.startAdd();
    await settle();
    expect(reads()).toBe(1);
    store.cancelAdd();
    await settle();
    expect(store.adding$()).toBe(false);
    expect(store.pickedOrg$()).toBeNull();
  });

  it('adds a unit with the full command', async () => {
    await share(3, { canAssign: false, canSelfEnroll: true });

    expect(callsTo(courseEndpoints.share).at(-1)).toMatchObject({
      params: { courseId: '5' },
      body: {
        orgId: 3,
        includeDescendants: false,
        canAssign: false,
        canSelfEnroll: true,
        active: true,
      },
    });
    expect(store.adding$()).toBe(false);
    expect(store.pickedOrg$()).toBeNull();
    expect(store.active$().map((r) => r.name)).toEqual(['Chi nhánh Đà Nẵng']);
  });

  it('adds nothing until a unit is picked', async () => {
    store.startAdd();
    store.add(rights());
    await settle();
    expect(callsTo(courseEndpoints.share)).toEqual([]);
  });

  it('changes the rights of a share with the full command', async () => {
    await share(2);
    store.act(row('Chi nhánh Hà Nội'), 'edit');
    expect(store.editingOrgId$()).toBe(2);

    store.saveRights(row('Chi nhánh Hà Nội'), rights({ canSelfEnroll: true }));
    await settle();

    expect(callsTo(courseEndpoints.share).at(-1)?.body).toEqual({
      orgId: 2,
      includeDescendants: false,
      canAssign: true,
      canSelfEnroll: true,
      active: true,
    });
    expect(store.editingOrgId$()).toBeNull();
    expect(store.active$()[0].rights).toBe(
      'Được giao học · Học viên tự đăng ký',
    );
  });

  it('revokes only after the confirm, keeping the rights, and lists it as revoked', async () => {
    await share(2, { includeDescendants: true });

    confirmed = false;
    store.act(row('Chi nhánh Hà Nội'), 'revoke');
    await settle();
    expect(callsTo(courseEndpoints.share)).toHaveLength(1);

    confirmed = true;
    store.act(row('Chi nhánh Hà Nội'), 'revoke');
    await settle();
    expect(callsTo(courseEndpoints.share).at(-1)?.body).toEqual({
      orgId: 2,
      includeDescendants: true,
      canAssign: true,
      canSelfEnroll: false,
      active: false,
    });
    expect(store.active$()).toEqual([]);
    expect(store.revoked$().map((r) => r.name)).toEqual(['Chi nhánh Hà Nội']);
    expect(store.revoked$()[0].share.revokedAt).toBeTruthy();
  });

  it('shares a revoked unit again with the rights it had', async () => {
    await share(2, { canSelfEnroll: true });
    store.act(row('Chi nhánh Hà Nội'), 'revoke');
    await settle();

    store.act(row('Chi nhánh Hà Nội'), 'reshare');
    await settle();

    expect(callsTo(courseEndpoints.share).at(-1)?.body).toEqual({
      orgId: 2,
      includeDescendants: false,
      canAssign: true,
      canSelfEnroll: true,
      active: true,
    });
    expect(store.revoked$()).toEqual([]);
    expect(store.active$().map((r) => r.name)).toEqual(['Chi nhánh Hà Nội']);
  });

  it('offers "Sửa quyền" and "Thu hồi" on an active share, "Chia sẻ lại" on a revoked one', async () => {
    await share(2);
    const labels = (r: ShareRow) =>
      store.menuFor(r).flatMap((e) => (e.kind === 'item' ? [e.label] : []));
    expect(labels(row('Chi nhánh Hà Nội'))).toEqual(['Sửa quyền', 'Thu hồi']);

    store.act(row('Chi nhánh Hà Nội'), 'revoke');
    await settle();
    expect(labels(row('Chi nhánh Hà Nội'))).toEqual(['Chia sẻ lại']);
  });

  it('keeps the form and the pick when the server refuses', async () => {
    store.startAdd();
    store.pick({ id: 1, name: 'Chủ', code: 'U1' });
    store.add(rights());
    await settle();

    expect(store.adding$()).toBe(true);
    expect(store.pickedOrg$()).toMatchObject({ id: 1 });
    expect(store.active$()).toEqual([]);
  });

  it('says why the shares cannot be shown, and reads them again on retry', async () => {
    const backend = TestBed.inject(MockBackend);
    const reads = callsTo(courseEndpoints.shares).length;
    store.retryLoad();
    await settle();
    expect(callsTo(courseEndpoints.shares).length).toBe(reads + 1);
    expect(backend).toBeTruthy();
    expect(store.loadError$()).toBeUndefined();
  });
});
