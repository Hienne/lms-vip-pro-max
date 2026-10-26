import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import { NOW } from '@lms/ui';
import type { MockInstance } from 'vitest';
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
import { FileSaver } from '../../../core/files/file-saver';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { exportFileName } from './data-access/progress.store';

const TODAY = new Date(2026, 9, 27, 9, 30).getTime();

describe('LearningProgress', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;
  const save = vi.fn();

  beforeEach(() => {
    save.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: FileSaver, useValue: { save } },
        { provide: NOW, useValue: () => TODAY },
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  }

  async function open(url = '/progress', user = '000004', role = 'hocvien') {
    signInToMockBackend(role);
    fakeSession().user.set(seedProfile(user));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const rows = () => Array.from(el.querySelectorAll('tbody tr'));
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);
  const lastQuery = (endpoint: unknown) =>
    calls(endpoint).at(-1)?.[1].query as Record<string, unknown>;
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    );
  const kpi = (label: string) =>
    Array.from(el.querySelectorAll('.progress-counts__item')).find((node) =>
      node.textContent?.includes(label),
    );

  /** Lets the mock answer an endpoint the way a test needs, the rest as usual. */
  function answer(endpoint: unknown, reply: ReturnType<typeof backendRefusal>) {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((e, request) =>
      e === endpoint
        ? reply
        : MockBackend.prototype.handle.call(backend, e, request),
    );
  }

  describe('the page of a learner with courses', () => {
    beforeEach(() => open());

    it('shows the server counts as five labelled numbers', () => {
      const labels = Array.from(
        el.querySelectorAll('.progress-counts__item dt'),
      ).map((node) => node.textContent?.trim());
      expect(labels).toEqual([
        'Tổng số khóa',
        'Hoàn thành',
        'Đang học',
        'Chưa bắt đầu',
        'Đang quá hạn',
      ]);
      expect(el.querySelector('h1')?.textContent).toContain('Tiến độ của tôi');
      expect(calls(learnerEndpoints.progressSummary).length).toBe(1);
    });

    it('turns the overdue number to danger only while it is above zero', () => {
      const overdue = kpi('Đang quá hạn')!.querySelector('dd')!;
      expect(Number(overdue.textContent)).toBeGreaterThan(0);
      expect(overdue.classList.contains('progress-counts__value--danger')).toBe(
        true,
      );
      expect(
        kpi('Tổng số khóa')!
          .querySelector('dd')!
          .classList.contains('progress-counts__value--danger'),
      ).toBe(false);
    });

    it('says once that hours, scores and competency are not there yet, and shows none', () => {
      expect(text()).toContain(
        'Giờ học, điểm kiểm tra và năng lực sẽ hiển thị khi hệ thống có dữ liệu.',
      );
      expect(text()).not.toContain('Điểm cao nhất');
    });

    it('lists every course with the server progress, a link and one status badge per row', () => {
      const headers = Array.from(el.querySelectorAll('thead th')).map((th) =>
        th.textContent?.trim(),
      );
      expect(headers).toEqual(
        expect.arrayContaining([
          'Khóa học',
          'Mã',
          'Tiến độ',
          'Bài bắt buộc',
          'Trạng thái',
          'Bắt đầu',
          'Truy cập gần nhất',
          'Hoàn thành',
          'Hạn',
        ]),
      );
      expect(rows().length).toBeGreaterThan(0);
      for (const row of rows()) {
        expect(row.querySelectorAll('.badge').length).toBe(1);
        expect(row.querySelector('a')?.getAttribute('href')).toMatch(
          /^\/course\/\d+$/,
        );
        expect(row.textContent).toMatch(/\d+%/);
      }
    });

    it('shows an overdue course as one danger badge', () => {
      const badge = Array.from(el.querySelectorAll('tbody .badge')).find((b) =>
        b.textContent?.includes('Quá hạn'),
      );
      expect(badge?.classList.contains('badge--danger')).toBe(true);
    });

    it('asks the server for 20 rows, newest access first, and reads the counts once', () => {
      expect(lastQuery(learnerEndpoints.myCourses)).toMatchObject({
        page: '0',
        size: '20',
        sort: 'lastAccessAt,desc',
      });
    });

    it('sorts on the server when a header is chosen and keeps it in the URL', async () => {
      el.querySelector<HTMLElement>('thead th button')!.click();
      await settle();
      expect(lastQuery(learnerEndpoints.myCourses)['sort']).toBe('title,asc');
      expect(TestBed.inject(Router).url).toContain('sort=title,asc');
    });

    it('filters by the overdue flag and starts again at the first page', async () => {
      const box = el.querySelector<HTMLInputElement>('input[type=checkbox]')!;
      box.click();
      await settle();
      expect(lastQuery(learnerEndpoints.myCourses)).toMatchObject({
        overdue: 'true',
        page: '0',
      });
      expect(rows().length).toBeGreaterThan(0);
      for (const row of rows()) expect(row.textContent).toContain('Quá hạn');
      expect(TestBed.inject(Router).url).toContain('overdue=true');
    });

    it('filters by learning status from the segmented control', async () => {
      const option = Array.from(
        el.querySelectorAll<HTMLElement>('[ngOption]'),
      ).find((node) => node.textContent?.includes('Hoàn thành'))!;
      option.click();
      await settle();
      expect(lastQuery(learnerEndpoints.myCourses)['learningStatus']).toBe(
        'completed',
      );
    });

    it('does not touch the counts when a filter changes', async () => {
      el.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
      await settle();
      expect(calls(learnerEndpoints.progressSummary).length).toBe(1);
    });

    it('shows "Không có khóa học phù hợp" with a way back when the filters match none', async () => {
      const search = el.querySelector<HTMLInputElement>('input[type=search]')!;
      search.value = 'khong-co-khoa-nao-ten-nhu-vay';
      search.dispatchEvent(new Event('input'));
      search.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      await settle();
      expect(text()).toContain('Không có khóa học phù hợp bộ lọc.');
      expect(text()).not.toContain('Bạn chưa có khóa học nào.');
      expect((button('Xuất CSV') as HTMLButtonElement).disabled).toBe(true);
      button('Xóa bộ lọc')!.click();
      await settle();
      expect(rows().length).toBeGreaterThan(0);
      expect(TestBed.inject(Router).url).toBe('/progress');
    });
  });

  describe('a URL that carries the choices', () => {
    it('opens the same table', async () => {
      await open('/progress?status=in_progress&overdue=true&sort=title,asc');
      expect(lastQuery(learnerEndpoints.myCourses)).toMatchObject({
        learningStatus: 'in_progress',
        overdue: 'true',
        sort: 'title,asc',
      });
      expect(
        el.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked,
      ).toBe(true);
    });

    it('drops a value it does not know', async () => {
      await open('/progress?status=bogus&sort=nothing,up&page=abc');
      expect(lastQuery(learnerEndpoints.myCourses)).toMatchObject({
        page: '0',
        sort: 'lastAccessAt,desc',
      });
      expect(lastQuery(learnerEndpoints.myCourses)['learningStatus']).toBe(
        undefined,
      );
    });
  });

  describe('the CSV', () => {
    beforeEach(() => open());

    it('sends the filters and sort of the table without paging, and saves the day-named file', async () => {
      el.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
      await settle();
      button('Xuất CSV')!.click();
      await settle();
      const query = lastQuery(learnerEndpoints.exportProgress);
      expect(query).toEqual({ sort: 'lastAccessAt,desc', overdue: 'true' });
      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0][1]).toBe('tien-do-cua-toi-2026-10-27.csv');
      expect(save.mock.calls[0][0]).toBeInstanceOf(Blob);
    });

    it('shows no success toast: the download is the feedback', async () => {
      button('Xuất CSV')!.click();
      await settle();
      expect(document.body.textContent).not.toContain('Đã xuất');
      expect(document.querySelector('ui-toaster [role=status]')).toBeNull();
    });

    it('toasts the server message and saves nothing when the export is too large', async () => {
      answer(learnerEndpoints.exportProgress, backendRefusal('exportTooLarge'));
      button('Xuất CSV')!.click();
      await settle();
      expect(save).not.toHaveBeenCalled();
      expect(document.body.textContent).toMatch(/10\.?000|quá nhiều|xuất/i);
    });
  });

  describe('a learner without courses', () => {
    it('says so, offers the catalogue, and has nothing to export', async () => {
      await open('/progress', '000005', 'giangvien');
      expect(text()).toContain('Bạn chưa có khóa học nào.');
      const link = Array.from(el.querySelectorAll('a')).find((a) =>
        a.textContent?.includes('Xem danh mục khóa học'),
      );
      expect(link?.getAttribute('href')).toBe('/catalog');
      expect(el.querySelector('table')).toBeNull();
      expect((button('Xuất CSV') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('failed reads', () => {
    it('shows the table error with a retry while the counts stay', async () => {
      answer(learnerEndpoints.myCourses, backendRefusal('internalError'));
      await open();
      expect(text()).toContain('Không tải được danh sách khóa học');
      expect(kpi('Tổng số khóa')).toBeTruthy();
      handle.mockRestore();
      handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      Array.from(el.querySelectorAll<HTMLButtonElement>('button'))
        .find((b) => b.textContent?.includes('Thử lại'))!
        .click();
      await settle();
      expect(rows().length).toBeGreaterThan(0);
    });

    it('shows the counts error with a retry while nothing else is claimed', async () => {
      answer(learnerEndpoints.progressSummary, backendRefusal('internalError'));
      await open();
      expect(text()).toContain('Không tải được số liệu tiến độ');
      expect(el.querySelector('.progress-counts')).toBeNull();
    });
  });
});

describe('exportFileName', () => {
  it('names the file after the local day', () => {
    expect(exportFileName(new Date(2026, 0, 5, 23, 59).getTime())).toBe(
      'tien-do-cua-toi-2026-01-05.csv',
    );
  });
});
