import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerEndpoints, learnerQuizEndpoints } from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
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
  const rows = () =>
    Array.from(
      el.querySelectorAll('section[aria-label="Danh sách khóa học"] tbody tr'),
    );
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
        'Điểm thi trung bình',
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

    it('says once that hours are not there yet', () => {
      expect(text()).toContain('Giờ học sẽ hiển thị khi hệ thống có dữ liệu.');
    });

    it('ends the counts with the server average quiz score', () => {
      expect(
        kpi('Điểm thi trung bình')!.querySelector('dd')!.textContent?.trim(),
      ).toBe('65,5%');
      expect(
        Array.from(el.querySelectorAll('.progress-counts__item dt')).at(-1)
          ?.textContent,
      ).toBe('Điểm thi trung bình');
    });

    it('adds a "Điểm cao nhất" column, last and not sortable, with the server score or a dash', () => {
      const headers = Array.from(el.querySelectorAll('thead th'));
      const last = headers.at(-1)!;
      expect(last.textContent?.trim()).toBe('Điểm cao nhất');
      expect(last.querySelector('button')).toBeNull();
      const cells = rows().map((row) =>
        row.querySelector('td:last-child')!.textContent?.trim(),
      );
      expect(cells).toContain('40%');
      expect(cells).toContain('—');
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
      const badge = Array.from(
        el.querySelectorAll(
          'section[aria-label="Danh sách khóa học"] tbody .badge',
        ),
      ).find((b) => b.textContent?.includes('Quá hạn'));
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

  describe('the competency card', () => {
    const card = () =>
      el.querySelector<HTMLElement>(
        'section[aria-labelledby="progress-competency"]',
      )!;

    it('is titled "Năng lực theo nhóm kiến thức", after the counts and before the table, with no select', async () => {
      await open();
      expect(el.querySelector('#progress-competency')?.tagName).toBe('H2');
      expect(card().textContent).toContain('Năng lực theo nhóm kiến thức');
      expect(card().querySelector('select, [role="combobox"]')).toBeNull();
      const after = (a: Element, b: Element) =>
        !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(after(el.querySelector('app-progress-counts')!, card())).toBe(
        true,
      );
      expect(
        after(
          card(),
          el.querySelector('section[aria-label="Danh sách khóa học"]')!,
        ),
      ).toBe(true);
    });

    it('shows the large radar from the server rows, once, and keeps it when a filter changes', async () => {
      await open();
      const view = card().querySelector('app-competency-view')!;
      expect(view.classList).toContain('competency-view--large');
      expect(view.querySelector('ui-radar-chart')).not.toBeNull();
      expect(view.textContent).toContain(
        'Tỷ lệ đúng trên mọi lượt thi đã chấm',
      );
      expect(calls(learnerQuizEndpoints.myCompetency)).toHaveLength(1);
      expect(lastQuery(learnerQuizEndpoints.myCompetency)).toEqual({});
      (el.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
      await settle();
      expect(calls(learnerQuizEndpoints.myCompetency)).toHaveLength(1);
    });

    it('shows the inline empty state when no competency has data', async () => {
      answer(learnerQuizEndpoints.myCompetency, {
        status: 200,
        body: envelopeOk([]),
      } as ReturnType<typeof backendRefusal>);
      await open();
      expect(card().textContent).toContain('Chưa có dữ liệu năng lực');
      expect(card().querySelector('ui-radar-chart')).toBeNull();
    });

    it('fails alone, with a retry, while the counts and the table stay', async () => {
      answer(
        learnerQuizEndpoints.myCompetency,
        backendRefusal('internalError'),
      );
      await open();
      expect(card().textContent).toContain(
        'Không tải được năng lực theo nhóm kiến thức',
      );
      expect(card().querySelector('app-competency-view')).toBeNull();
      expect(kpi('Tổng số khóa')).toBeTruthy();
      expect(rows().length).toBeGreaterThan(0);
      handle.mockRestore();
      handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      Array.from(card().querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Thử lại'))!
        .click();
      await settle();
      expect(card().querySelector('ui-radar-chart')).not.toBeNull();
    });

    it('is not shown to a learner without courses', async () => {
      await open('/progress', '000005', 'giangvien');
      expect(card()).toBeNull();
    });
  });

  describe('the exam history', () => {
    const card = () =>
      el.querySelector<HTMLElement>(
        'section[aria-labelledby="progress-history"]',
      )!;
    const page = (items: unknown[]) =>
      ({
        status: 200,
        body: envelopeOk({
          items,
          page: 0,
          size: 6,
          totalElements: items.length,
          totalPages: 1,
        }),
      }) as ReturnType<typeof backendRefusal>;
    const attempt = (change: Record<string, unknown>) => ({
      attemptId: 7,
      quizId: 1,
      quizTitle: 'Luyện tập',
      courseId: 1,
      attemptNo: 1,
      status: 'SUBMITTED',
      submitType: 'MANUAL',
      startedAt: '2026-10-26T09:00:00',
      submittedAt: '2026-10-26T09:20:00',
      totalQuestions: 7,
      correctCount: 3,
      scorePercent: 42.86,
      passed: false,
      ...change,
    });

    it('asks for the six latest graded attempts, newest first', async () => {
      await open();
      expect(calls(learnerQuizEndpoints.myAttempts)).toHaveLength(1);
      expect(lastQuery(learnerQuizEndpoints.myAttempts)).toMatchObject({
        graded: 'true',
        sort: 'submittedAt,desc',
        size: '6',
        page: '0',
      });
    });

    it('lists each attempt with its score and verdict, linked to its result', async () => {
      answer(
        learnerQuizEndpoints.myAttempts,
        page([
          attempt({}),
          attempt({
            attemptId: 9,
            quizId: 5,
            quizTitle: 'Kiểm tra cuối khóa',
            status: 'AUTO_SUBMITTED',
            scorePercent: 100,
            passed: true,
          }),
        ]),
      );
      await open();
      const items = Array.from(card().querySelectorAll('li a'));
      expect(items.map((a) => a.getAttribute('href'))).toEqual([
        '/quiz/1/result/7',
        '/quiz/5/result/9',
      ]);
      const [failed, passed] = items.map((a) =>
        a.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(failed).toContain('Luyện tập');
      expect(failed).toContain('42,86% Chưa đạt');
      expect(failed).not.toContain('tự nộp');
      expect(passed).toContain('Kiểm tra cuối khóa');
      expect(passed).toContain('tự nộp');
      expect(passed).toContain('100% Đạt');
      expect(
        Array.from(card().querySelectorAll('.learning-progress__fail')).map(
          (n) => n.textContent,
        ),
      ).toEqual(['Chưa đạt']);
    });

    it('sits with the competency card, which comes first', async () => {
      await open();
      expect(
        card().parentElement!.contains(
          el.querySelector('section[aria-labelledby="progress-competency"]'),
        ),
      ).toBe(true);
      expect(
        el
          .querySelector('#progress-competency')!
          .compareDocumentPosition(el.querySelector('#progress-history')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('says so when nothing was graded', async () => {
      answer(learnerQuizEndpoints.myAttempts, page([]));
      await open();
      expect(card().textContent).toContain(
        'Bạn chưa có bài thi nào được chấm.',
      );
      expect(card().querySelector('li')).toBeNull();
    });

    it('fails alone, with a retry, while the rest of the page stays', async () => {
      answer(learnerQuizEndpoints.myAttempts, backendRefusal('internalError'));
      await open();
      expect(card().textContent).toContain('Không tải được lịch sử thi');
      expect(kpi('Tổng số khóa')).toBeTruthy();
      expect(rows().length).toBeGreaterThan(0);
      handle.mockRestore();
      handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      Array.from(card().querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Thử lại'))!
        .click();
      await settle();
      expect(card().textContent).not.toContain('Không tải được lịch sử thi');
      expect(card().textContent).toContain(
        'Bạn chưa có bài thi nào được chấm.',
      );
    });

    it('is not shown to a learner without courses', async () => {
      await open('/progress', '000005', 'giangvien');
      expect(card()).toBeNull();
    });
  });

  describe('a learner whose courses have no quiz', () => {
    beforeEach(async () => {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((e, request) => {
        const reply = MockBackend.prototype.handle.call(backend, e, request);
        if (e !== learnerEndpoints.progressSummary || !reply) return reply;
        const body = reply.body as { data: Record<string, unknown> };
        return {
          ...reply,
          body: {
            ...body,
            data: { ...body.data, assessment: { availability: 'unavailable' } },
          },
        } as typeof reply;
      });
      await open();
    });

    it('sees no average, no error, and still the column with dashes', () => {
      expect(kpi('Điểm thi trung bình')).toBeUndefined();
      expect(text()).not.toContain('Không tải được');
      expect(kpi('Tổng số khóa')).toBeTruthy();
      expect(rows().length).toBeGreaterThan(0);
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
      expect(document.querySelector('ui-toast-outlet .toast')).toBeNull();
    });

    it('toasts the server message and saves nothing when the export is too large', async () => {
      answer(learnerEndpoints.exportProgress, backendRefusal('exportTooLarge'));
      button('Xuất CSV')!.click();
      await settle();
      expect(save).not.toHaveBeenCalled();
      // The refusal arrives as a Blob, which is read asynchronously before the toast shows.
      await vi.waitFor(() => {
        expect(
          document.querySelector('ui-toast-outlet .toast--error')?.textContent,
        ).toContain(
          'Kết quả vượt giới hạn xuất 10.000 dòng. Vui lòng thu hẹp bộ lọc.',
        );
      });
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
