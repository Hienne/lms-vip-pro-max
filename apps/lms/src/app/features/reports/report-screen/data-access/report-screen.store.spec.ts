import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { assessmentReportEndpoints as api } from '@lms/contracts';
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
import { envelopeOk } from '@lms/mocks';

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
  async function open(path: string) {
    signInToMockBackend('baocao');
    fakeSession().user.set(seedProfile('000006'));
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
      teamId: 1,
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
      courseId: 9,
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
  it('renders real overview charts and switches the grouped table without another report request', async () => {
    const store = await open('/reports');
    const data = store.overview$();
    if (!data) throw new Error('Overview missing');
    expect(
      store.resultChart$().reduce((sum, item) => sum + item.value, 0),
    ).toBe(data.learners);
    expect(store.resultChart$()[0].value).toBe(data.passedLearners);
    expect(store.scoreComparison$().every((g) => g.averageScore !== null)).toBe(
      true,
    );
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    const element = harness.routeNativeElement as HTMLElement;
    expect(
      element.querySelector('a[aria-current="page"]')?.textContent,
    ).toContain('Tổng quan');
    const toggle = [
      ...element.querySelectorAll<HTMLButtonElement>('button'),
    ].find((b) => b.textContent?.includes('Theo đơn vị'));
    toggle?.click();
    await settle();
    expect(store.grouping$()).toBe('org');
    expect(store.groupTotal$()).toBe(data.byOrg.length);
    expect(store.groupedRows$().map((g) => g.id)).toEqual(
      data.byOrg.slice(0, 10).map((g) => String(g.id ?? 'unknown')),
    );
    expect(spy.mock.calls.some(([e]) => e === api.overview)).toBe(false);
  });
  it('shows empty charts and missing scores instead of inventing zero-percent results', async () => {
    const backend = TestBed.inject(MockBackend),
      handle = backend.handle.bind(backend);
    vi.spyOn(backend, 'handle').mockImplementation((endpoint, request) =>
      endpoint === api.overview
        ? {
            status: 200,
            body: envelopeOk({
              gradedAttempts: 0,
              learners: 0,
              passedLearners: 0,
              passRate: null,
              averageScore: null,
              inProgressAttempts: 0,
              byQuiz: [],
              byOrg: [],
            }),
          }
        : handle(endpoint, request),
    );
    const store = await open('/reports');
    expect(store.resultChart$()).toEqual([]);
    expect(store.scoreComparison$()).toEqual([]);
    const element = harness.routeNativeElement as HTMLElement;
    expect(element.textContent).toContain('Chưa có điểm đã chấm');
    expect(element.querySelector('ui-donut-chart')).toBeNull();
    expect(
      [...element.querySelectorAll('.report-screen__metrics dd')].filter(
        (el) => el.textContent?.trim() === '—',
      ),
    ).toHaveLength(2);
  });
  it('applies the filter form to overview charts and resets both the inputs and results', async () => {
    const store = await open('/reports');
    const initial = store.overview$()?.gradedAttempts;
    const element = harness.routeNativeElement as HTMLElement;
    const field = element.querySelector<HTMLInputElement>(
      'ui-field[label="ID bài kiểm tra"] input',
    );
    if (!field) throw new Error('Quiz filter missing');
    field.value = '99999';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(store.activeFilterCount$()).toBe(1);
    expect(store.overview$()?.gradedAttempts).toBe(0);
    expect(store.resultChart$()).toEqual([]);
    const reset = [
      ...element.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.includes('Đặt lại'));
    reset?.click();
    await settle();
    expect(field.value).toBe('');
    expect(store.activeFilterCount$()).toBe(0);
    expect(store.overview$()?.gradedAttempts).toBe(initial);
    store.applyFilters({
      from: '2026-11-01T02:00:00.000Z',
      to: '2026-11-01T02:00:00.001Z',
    });
    await settle();
    expect(store.overview$()?.gradedAttempts).toBe(initial);
    store.applyFilters({ to: '2026-11-01T02:00:00.000Z' });
    await settle();
    expect(store.overview$()?.gradedAttempts).toBe(0);
  });
});
