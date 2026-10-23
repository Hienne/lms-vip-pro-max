import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
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
    expect(text()).toContain('5 khóa học phù hợp');
    expect(text()).toContain('62%');
    expect(text()).toContain('Quá hạn');
    expect(select('Lĩnh vực').options.length).toBe(5);
    expect(select('Chương trình').textContent).toContain('Hội nhập cán bộ mới');
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

    expect(titles().length).toBe(5);
    expect(TestBed.inject(Router).url).toBe('/catalog');
  });

  it('opens on the assigned courses from the URL and shows only the caller own', async () => {
    await open('/catalog?scope=assigned&status=failed');

    expect(lastQuery(learnerEndpoints.myCourses)).toMatchObject({
      learningStatus: 'failed',
    });
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

    expect(titles().length).toBe(5);
  });
});
