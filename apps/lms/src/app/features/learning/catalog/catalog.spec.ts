import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  courseEndpoints,
  learnerEndpoints,
  LearnerFacetsSchema,
  trainingCatalogEndpoints,
  type LearnerFacets,
} from '@lms/contracts';
import { backendRefusal, envelopeOk, type FakeReply } from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { SessionStore } from '../../../core/session/session.store';
import { DEFAULT_COURSE_COVER } from '../../../shared/course/course-card';

/**
 * Gives the first card of every `list` reply the cover asset 77, whose file the server answers
 * (`readable`) or refuses; everything else is the mock's.
 */
function withCover(
  handle: MockInstance<MockBackend['handle']>,
  list: unknown,
  readable: boolean,
) {
  const backend = TestBed.inject(MockBackend);
  URL.createObjectURL = vi.fn(() => 'blob:cover');
  URL.revokeObjectURL = vi.fn();
  handle.mockImplementation((endpoint, request) => {
    if (endpoint === courseEndpoints.getAssetContent) {
      return readable
        ? {
            status: 200,
            body: envelopeOk(null),
            file: new Blob(['png'], { type: 'image/png' }),
          }
        : backendRefusal('accessDenied');
    }
    const reply = MockBackend.prototype.handle.call(backend, endpoint, request);
    if (endpoint === list && reply && 'body' in reply) {
      const page = reply.body.data as { items: Record<string, unknown>[] };
      if (page.items[0]) page.items[0]['coverAssetId'] = 77;
    }
    return reply;
  });
}

describe('Catalog', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
  }

  /** Opens the catalogue as `hocvien` (000004), the learner with every course state. */
  async function open(url = '/catalog') {
    signInToMockBackend('hocvien');
    fakeSession().user.set(seedProfile('000004'));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const titles = () =>
    Array.from(el.querySelectorAll('.course-card__title')).map((t) =>
      t.textContent?.trim(),
    );
  const select = (label: string) =>
    el.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  const lastQuery = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint).at(-1)?.[1].query;
  const optionTexts = (label: string) =>
    Array.from(select(label).options)
      .slice(1)
      .map((o) => o.textContent?.trim());
  /** What the one `facets` call answered, so the page can be checked against the server's names. */
  const facets = (): LearnerFacets => {
    const at = handle.mock.calls.findIndex(
      ([endpoint]) => endpoint === learnerEndpoints.facets,
    );
    return LearnerFacetsSchema.parse(
      (handle.mock.results[at].value as FakeReply).body.data,
    );
  };
  const callsOf = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);
  const choose = async (label: string, value: string) => {
    const box = select(label);
    box.value = value;
    box.dispatchEvent(new Event('change'));
    await settle();
  };

  it('lists the published courses with the server progress and the filters of the caller org', async () => {
    await open();

    expect(titles()).toContain('Tổng quan hệ thống Core Banking');
    expect(titles()).not.toContain('An toàn thông tin cho cán bộ CNTT');
    expect(text()).toContain('6 khóa học phù hợp');
    expect(text()).toContain('62%');
    expect(text()).toContain('Quá hạn');
    expect(optionTexts('Lĩnh vực')).toEqual(facets().fields.map((f) => f.name));
    expect(optionTexts('Chương trình')).toEqual(
      facets().programs.map((p) => p.name),
    );
    expect(optionTexts('Phân hệ')).toEqual(facets().modules.map((m) => m.name));
    expect(select('Chương trình').textContent).toContain('Hội nhập cán bộ mới');
  });

  it('reads the names of the selects from one facets call and never from the training catalogue', async () => {
    await open();

    expect(callsOf(learnerEndpoints.facets).length).toBe(1);
    expect(
      callsOf(trainingCatalogEndpoints.listFields).length +
        callsOf(trainingCatalogEndpoints.listPrograms).length +
        callsOf(trainingCatalogEndpoints.listModules).length,
    ).toBe(0);
  });

  it('shows the programme name of the card from the server', async () => {
    await open();

    const programs = facets().programs.map((p) => p.name);
    const domains = Array.from(el.querySelectorAll('app-course-card')).map(
      (card) => card.textContent?.replace(/\s+/g, ' '),
    );
    expect(domains.length).toBeGreaterThan(0);
    expect(
      domains.some((d) => programs.some((name) => d?.includes(name))),
    ).toBe(true);
  });

  it('lists only the programmes and modules of the chosen field, and clears a choice that no longer fits', async () => {
    await open();
    const all = facets();
    const field = all.fields.find((f) =>
      all.modules.some((m) => m.fieldId === f.id),
    )!;
    const other = all.modules.find((m) => m.fieldId !== field.id)!;
    await choose('Phân hệ', String(other.id));
    expect(lastQuery(learnerEndpoints.catalog)).toMatchObject({
      moduleId: String(other.id),
    });

    await choose('Lĩnh vực', String(field.id));

    expect(optionTexts('Phân hệ')).toEqual(
      all.modules.filter((m) => m.fieldId === field.id).map((m) => m.name),
    );
    expect(optionTexts('Chương trình')).toEqual(
      all.programs.filter((p) => p.fieldId === field.id).map((p) => p.name),
    );
    expect(lastQuery(learnerEndpoints.catalog)).toMatchObject({
      fieldId: String(field.id),
    });
    expect(lastQuery(learnerEndpoints.catalog)).not.toHaveProperty('moduleId');
    expect(TestBed.inject(Router).url).toBe(`/catalog?field=${field.id}`);
  });

  it.each([
    ['not_started', { learningStatus: 'not_started' }],
    ['in_progress', { learningStatus: 'in_progress' }],
    ['completed', { learningStatus: 'completed' }],
    ['failed', { failed: 'true' }],
    ['overdue', { overdue: 'true' }],
    ['assigned', { assigned: 'true' }],
  ])('sends the status `%s` as %o and nothing else', async (value, query) => {
    await open();

    await choose('Trạng thái', value);

    const sent = lastQuery(learnerEndpoints.catalog);
    expect(sent).toMatchObject(query);
    const flags = ['learningStatus', 'failed', 'overdue', 'assigned'].filter(
      (key) => key in (sent ?? {}),
    );
    expect(flags).toEqual(Object.keys(query));
    expect(TestBed.inject(Router).url).toBe(`/catalog?status=${value}`);
    expect(text()).toContain('Xóa 1 bộ lọc');
  });

  it('offers the six statuses of the mockup in its order', async () => {
    await open();

    expect(optionTexts('Trạng thái')).toEqual([
      'Chưa bắt đầu',
      'Đang học',
      'Đã hoàn thành',
      'Chưa đạt',
      'Quá hạn',
      'Được giao',
    ]);
  });

  it('keeps every filter across a reload from the URL and counts them for "Xóa n bộ lọc"', async () => {
    const url =
      '/catalog?q=core&field=1&level=basic&requirement=mandatory&status=overdue&sort=name';
    await open(url);

    expect(select('Lĩnh vực').value).toBe('1');
    expect(select('Mức độ').value).toBe('basic');
    expect(select('Loại').value).toBe('mandatory');
    expect(select('Trạng thái').value).toBe('overdue');
    expect(
      el.querySelector<HTMLSelectElement>('.catalog__sort select')!.value,
    ).toBe('name');
    expect(lastQuery(learnerEndpoints.catalog)).toMatchObject({
      q: 'core',
      fieldId: '1',
      level: 'basic',
      requirement: 'mandatory',
      overdue: 'true',
      sort: 'title,asc',
    });
    expect(text()).toContain('Xóa 5 bộ lọc');

    await choose('Mức độ', '');

    expect(text()).toContain('Xóa 4 bộ lọc');
    expect(TestBed.inject(Router).url).toBe(
      '/catalog?q=core&field=1&requirement=mandatory&status=overdue&sort=name',
    );
  });

  it('sends a filter to the server, keeps it in the URL and clears it', async () => {
    await open();

    await choose('Mức độ', 'advanced');

    expect(lastQuery(learnerEndpoints.catalog)).toMatchObject({
      level: 'advanced',
      page: '0',
    });
    expect(titles()).toEqual(['Vận hành cuối ngày (EOD/COB)']);
    expect(TestBed.inject(Router).url).toBe('/catalog?level=advanced');

    const clear = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Xóa 1 bộ lọc'),
    )!;
    clear.click();
    await settle();

    expect(titles().length).toBe(6);
    expect(TestBed.inject(Router).url).toBe('/catalog');
  });

  it('opens on the assigned courses from the URL and shows only the caller own', async () => {
    await open('/catalog?scope=assigned&status=failed');

    expect(lastQuery(learnerEndpoints.catalog)).toMatchObject({
      assigned: 'true',
      failed: 'true',
    });
    expect(callsOf(learnerEndpoints.myCourses).length).toBe(0);
    expect(titles()).toEqual([
      'Quy trình quản lý thay đổi (Change Management)',
    ]);
    expect(select('Trạng thái').value).toBe('failed');
  });

  it('says so when nothing matches, and offers to clear the filters', async () => {
    await open('/catalog?q=khong-co-khoa-nay');

    expect(text()).toContain('Không có khóa học phù hợp');
    expect(text()).toContain('Thử bỏ bớt bộ lọc');
  });

  describe('course covers', () => {
    const original = {
      create: URL.createObjectURL,
      revoke: URL.revokeObjectURL,
    };
    afterEach(() => {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    });

    it('shows the cover the server names, read once', async () => {
      withCover(handle, learnerEndpoints.catalog, true);
      await open();
      const covers = el.querySelectorAll<HTMLImageElement>(
        'img.course-card__cover',
      );
      expect(covers).toHaveLength(
        el.querySelectorAll('app-course-card').length,
      );
      expect(covers[0].getAttribute('src')).toBe('blob:cover');
      for (const cover of Array.from(covers).slice(1)) {
        expect(cover.getAttribute('src')).toBe(DEFAULT_COURSE_COVER);
      }
      expect(
        handle.mock.calls.filter(
          ([e]) => e === courseEndpoints.getAssetContent,
        ),
      ).toHaveLength(1);
    });

    it('shows no progress on a course the learner has not enrolled in', async () => {
      await open();
      const visitor = Array.from(el.querySelectorAll('app-course-card')).find(
        (card) => card.textContent?.includes('Chưa đăng ký'),
      )!;
      expect(visitor.querySelector('ui-progress')).toBeNull();
      expect(visitor.querySelector('.course-card__pct')).toBeNull();
    });
  });

  it('shows a load error with a retry that reads again', async () => {
    const backend = TestBed.inject(MockBackend);
    const original: MockBackend['handle'] = (endpoint, request) =>
      MockBackend.prototype.handle.call(backend, endpoint, request);
    handle.mockImplementation((endpoint, request) =>
      endpoint === learnerEndpoints.catalog
        ? backendRefusal('internalError')
        : original(endpoint, request),
    );
    await open();

    expect(text()).toContain('Không tải được danh mục khóa học');

    handle.mockImplementation(original);
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Thử lại'))!
      .click();
    await settle();

    expect(titles().length).toBe(6);
  });
});
