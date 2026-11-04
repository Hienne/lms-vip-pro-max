import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  assessmentReportEndpoints as api,
  learningReportEndpoints as learning,
} from '@lms/contracts';
import { createAppRoutes } from '../../../../app.routes';
import { provideAppConfig } from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../../core/dev/mock-api/mock-backend.testing';
import { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import { SessionStore } from '../../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../../core/session/session.testing';
import { FileSaver } from '../../../../core/files/file-saver';
import { ReportScreenStore } from './report-screen.store';

describe('assessment report integration', () => {
  let harness: RouterTestingHarness;
  const save = vi.fn();
  beforeEach(() => {
    save.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: FileSaver, useValue: { save } },
      ],
    });
  });
  async function settle() {
    for (let i = 0; i < 6; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  /** As `quantri.ban`, an admin of org 1, whose report scope holds the seeded enrolments. */
  async function open(path: string) {
    signInToMockBackend('quantri.ban');
    fakeSession().user.set(seedProfile('000003'));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    await settle();
    const store = harness.routeDebugElement?.injector.get(ReportScreenStore);
    if (!store) throw new Error('Report route missing');
    return store;
  }
  it('exports the same result filters and sort as the table, including passed=false, without pagination', async () => {
    const store = await open('/reports/results');
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    store.applyFilters({
      orgId: 1,
      courseId: 1,
      quizId: 1,
      userId: '000004',
      passed: false,
      from: '2026-10-01T00:00:00Z',
      to: '2026-12-01T00:00:00Z',
    });
    store.changeSort({ key: 'scorePercent', dir: 'asc' });
    await settle();
    const list = spy.mock.calls
      .filter(([e]) => e === api.results)
      .at(-1)?.[1].query;
    expect(store.total$()).toBe(1);
    expect(list).toMatchObject({
      orgId: '1',
      passed: 'false',
      sort: 'scorePercent,asc',
    });
    store.exportCsv();
    await settle();
    const exported = spy.mock.calls.find(([e]) => e === api.export)?.[1];
    const { page, size, ...filters } = list ?? {};
    void page;
    void size;
    expect(exported?.query).toEqual(filters);
    expect(exported?.params).toEqual({ type: 'results' });
    expect(save).toHaveBeenCalledWith(
      expect.any(Blob),
      'bao-cao-thi-results.csv',
    );
  });
  it('waits for quizId on the learners report and omits non-applicable course/date filters', async () => {
    const backend = TestBed.inject(MockBackend),
      spy = vi.spyOn(backend, 'handle');
    const store = await open('/reports/learners');
    expect(store.needsQuiz$()).toBe(true);
    expect(spy.mock.calls.some(([e]) => e === api.learners)).toBe(false);
    store.applyFilters({
      quizId: 1,
      courseId: 1,
      from: '2026-12-01T00:00:00Z',
      orgId: 1,
      learnerStatus: 'FAILED',
    });
    await settle();
    const request = spy.mock.calls.find(([e]) => e === api.learners)?.[1].query;
    expect(request).toMatchObject({
      quizId: '1',
      orgId: '1',
      learnerStatus: 'FAILED',
    });
    expect(request).not.toHaveProperty('from');
    expect(request).not.toHaveProperty('courseId');
  });
  it('does not send an unsupported legacy report dimension to an unrelated API', async () => {
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    const store = await open('/reports/programs');
    expect(store.unsupported$()).toBe(true);
    expect(
      spy.mock.calls.some(([e]) => Object.values(api).some((a) => a === e)),
    ).toBe(false);
  });
  it('applies a staff-code search from the header and updates it on a reused report route', async () => {
    const store = await open('/reports/results?userId=000004');
    expect(store.total$()).toBe(1);
    expect(store.filters$().userId).toBe('000004');
    await harness.navigateByUrl('/reports/results?userId=000099');
    await settle();
    expect(store.filters$().userId).toBe('000099');
    expect(store.total$()).toBe(0);
  });
  describe('pickers', () => {
    it('lists the units and, once one is picked, its teams', async () => {
      const store = await open('/reports/results');
      const { pickers } = store;
      expect(pickers.options$.orgId()).toEqual([
        { id: 1, name: 'Ban Quản lý và phát triển Core Banking' },
      ]);
      expect(pickers.options$.teamId()).toEqual([]);
      pickers.pick('orgId', pickers.options$.orgId()[0]);
      await settle();
      expect(pickers.options$.teamId().map((t) => t.name)).toEqual([
        'Nhóm BA&QC Tiền gửi',
        'Nhóm Tích hợp Core Banking',
      ]);
    });

    it('reads courses as "code · name" from the server search, narrowed by the unit', async () => {
      const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      const store = await open('/reports/results?orgId=1');
      expect(store.pickers.options$.courseId()).toContainEqual({
        id: 1,
        name: 'Tổng quan hệ thống Core Banking',
        meta: 'NV-101',
      });
      store.pickers.search('courseId', 'change');
      await settle();
      expect(
        spy.mock.calls.filter(([e]) => e === learning.groups).at(-1)?.[1].query,
      ).toMatchObject({ groupBy: 'course', orgId: '1', q: 'change' });
      expect(store.pickers.options$.courseId().map((c) => c.meta)).toEqual([
        'VH-201',
      ]);
    });

    it('lists the quizzes of the picked course and clears the children of a changed parent', async () => {
      const store = await open('/reports/results?orgId=1&teamId=7&courseId=1');
      const { pickers } = store;
      pickers.pick('quizId', { id: 1, name: 'Luyện tập Core Banking' });
      await settle();
      expect(pickers.options$.quizId().map((q) => q.name)).toEqual([
        'Luyện tập Core Banking',
      ]);
      pickers.pick('courseId', { id: 4, name: 'Văn hóa', meta: 'HN-101' });
      expect(pickers.picks$()).toEqual({
        orgId: 1,
        teamId: 7,
        courseId: 4,
        quizId: undefined,
      });
      pickers.pick('orgId', null);
      expect(pickers.picks$()).toEqual({
        orgId: undefined,
        teamId: undefined,
        courseId: undefined,
        quizId: undefined,
      });
      expect(store.filters$()).toMatchObject({ orgId: 1, courseId: 1 });
    });

    it('shows the names of the ids a shared link applies', async () => {
      const store = await open(
        '/reports/results?orgId=1&teamId=7&courseId=1&quizId=1',
      );
      expect(store.pickers.selected$()).toEqual({
        orgId: { id: 1, name: 'Ban Quản lý và phát triển Core Banking' },
        teamId: { id: 7, name: 'Nhóm BA&QC Tiền gửi' },
        courseId: {
          id: 1,
          name: 'Tổng quan hệ thống Core Banking',
          meta: 'NV-101',
        },
        quizId: { id: 1, name: 'Luyện tập Core Banking' },
      });
      expect(store.pickers.errors$().courseId).toBeUndefined();
    });

    it('requests no report for an id outside the scope, and says so on its picker', async () => {
      const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      const store = await open('/reports/results?courseId=9999');
      expect(store.pickers.errors$().courseId).toBe(
        'Không tìm thấy khóa học này trong phạm vi của bạn.',
      );
      expect(spy.mock.calls.some(([e]) => e === api.results)).toBe(false);
      store.pickers.pick('courseId', null);
      expect(store.pickers.errors$().courseId).toBeUndefined();
    });

    it('requests no overview for a unit outside the scope', async () => {
      const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      const store = await open('/reports?orgId=99');
      expect(store.pickers.errors$().orgId).toBe(
        'Không tìm thấy đơn vị này trong phạm vi của bạn.',
      );
      expect(spy.mock.calls.some(([e]) => e === api.overview)).toBe(false);
    });
  });

  describe('filters in the URL', () => {
    it('reads the filters and the page from the query string', async () => {
      const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      const store = await open(
        '/reports/results?orgId=1&passed=false&page=2&quizId=abc',
      );
      expect(store.filters$()).toEqual({ orgId: 1, passed: false });
      expect(store.page$()).toBe(2);
      const query = spy.mock.calls
        .filter(([e]) => e === api.results)
        .at(-1)?.[1].query;
      expect(query).toMatchObject({ orgId: '1', passed: 'false', page: '1' });
      expect(query).not.toHaveProperty('quizId');
    });

    it('writes applied filters to the URL in place, from the first page', async () => {
      const store = await open('/reports/results?page=3');
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
      store.applyFilters({ orgId: 1, userId: '', passed: false });
      await settle();
      expect(TestBed.inject(Router).url).toBe(
        '/reports/results?orgId=1&passed=false',
      );
      expect(navigate.mock.calls.at(-1)?.[1]).toMatchObject({
        replaceUrl: true,
      });
      expect(store.page$()).toBe(1);
    });

    it('keeps the page in the URL', async () => {
      const store = await open('/reports/results?orgId=1');
      store.changePage(2);
      await settle();
      expect(TestBed.inject(Router).url).toBe(
        '/reports/results?orgId=1&page=2',
      );
    });

    it('carries on each tab link the filters that tab reads', async () => {
      const store = await open(
        '/reports/results?orgId=1&quizId=4&userId=000004&passed=true',
      );
      const tabs = Object.fromEntries(
        store.tabs$().map((t) => [t.id, t.queryParams]),
      );
      expect(tabs['overview']).toEqual({ orgId: '1', quizId: '4' });
      expect(tabs['learners']).toEqual({ orgId: '1', quizId: '4' });
      expect(tabs['results']).toEqual({
        orgId: '1',
        quizId: '4',
        userId: '000004',
        passed: 'true',
      });
    });
  });
});
