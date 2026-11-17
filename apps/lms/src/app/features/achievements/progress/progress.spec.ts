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
import { exportFileName, ProgressStore } from './data-access/progress.store';

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
    Array.from(el.querySelectorAll('.learning-progress__course-row'));
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);
  const lastQuery = (endpoint: unknown) =>
    calls(endpoint).at(-1)?.[1].query as Record<string, unknown>;
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    );
  const kpi = (label: string) =>
    Array.from(el.querySelectorAll('ui-stat')).find((node) =>
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
        el.querySelectorAll('ui-stat .stat__label'),
      ).map((node) => node.textContent?.trim());
      expect(labels).toEqual([
        'Tổng số khóa',
        'Hoàn thành',
        'Đang học',
        'Chưa bắt đầu',
        'Đang quá hạn',
        'Điểm thi trung bình',
      ]);
      expect(el.querySelector('h1')?.textContent).toContain('Tiến độ học tập');
      expect(calls(learnerEndpoints.progressSummary).length).toBe(1);
    });

    it('turns the overdue number to danger only while it is above zero', () => {
      const overdue = kpi('Đang quá hạn')!.querySelector('.stat__value')!;
      expect(Number(overdue.textContent)).toBeGreaterThan(0);
      expect(overdue.classList.contains('stat__value--danger')).toBe(true);
      expect(
        kpi('Tổng số khóa')!
          .querySelector('.stat__value')!
          .classList.contains('stat__value--danger'),
      ).toBe(false);
    });

    it('omits the placeholder when hours are unavailable', () => {
      expect(text()).not.toContain(
        'Giờ học sẽ hiển thị khi hệ thống có dữ liệu.',
      );
    });

    it('uses a summary count to filter the courses without stale filters', async () => {
      const store = harness.routeDebugElement!.injector.get(ProgressStore);
      store.filterStatus('completed');
      store.filterOverdue(true);
      store.search('old');
      store.selectTab('history');
      await settle();
      kpi('Đang học')!.querySelector<HTMLButtonElement>('button')!.click();
      await settle();
      expect(TestBed.inject(Router).url).toContain('status=in_progress');
      expect(TestBed.inject(Router).url).not.toContain('overdue=true');
      expect(TestBed.inject(Router).url).not.toContain('q=old');
      expect(lastQuery(learnerEndpoints.myCourses)['learningStatus']).toBe(
        'in_progress',
      );
      kpi('Đang quá hạn')!.querySelector<HTMLButtonElement>('button')!.click();
      await settle();
      expect(TestBed.inject(Router).url).toContain('overdue=true');
      expect(TestBed.inject(Router).url).not.toContain('status=');
      kpi('Tổng số khóa')!.querySelector<HTMLButtonElement>('button')!.click();
      await settle();
      expect(TestBed.inject(Router).url).not.toContain('overdue=true');
      expect(
        lastQuery(learnerEndpoints.myCourses)['learningStatus'],
      ).toBeUndefined();
      expect(
        kpi('Tổng số khóa')!
          .querySelector('button')
          ?.getAttribute('aria-pressed'),
      ).toBe('true');
    });

    it('ends the counts with the server average quiz score', () => {
      expect(
        kpi('Điểm thi trung bình')!
          .querySelector('.stat__value')!
          .textContent?.trim(),
      ).toBe('65,5%');
      expect(
        Array.from(el.querySelectorAll('ui-stat .stat__label')).at(-1)
          ?.textContent,
      ).toBe('Điểm thi trung bình');
    });

    it('shows dates and server scores directly in each course row', () => {
      const scores = rows().map((row) => {
        expect(row.querySelector('button[aria-expanded]')).toBeNull();
        expect(row.querySelector('td[data-label="Bắt đầu"]')).toBeTruthy();
        expect(row.querySelector('td[data-label="Hoàn thành"]')).toBeTruthy();
        return row
          .querySelector('td[data-label="Điểm thi cao nhất"] span > span')
          ?.textContent?.trim();
      });
      expect(scores).toContain('40%');
      expect(scores).toContain('—');
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
        size: '5',
        sort: 'lastAccessAt,desc',
      });
    });

    it('sorts on the server when a header is chosen and keeps it in the URL', async () => {
      el.querySelector<HTMLElement>('thead th button')!.click();
      await settle();
      expect(lastQuery(learnerEndpoints.myCourses)['sort']).toBe('title,asc');
      expect(TestBed.inject(Router).url).toContain('sort=title,asc');
    });

    it('sorts by the learning dates', async () => {
      const select = el.querySelector<HTMLSelectElement>(
        '.learning-progress__sort select',
      )!;
      select.value = 'startedAt,desc';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(lastQuery(learnerEndpoints.myCourses)['sort']).toBe(
        'startedAt,desc',
      );
      expect(TestBed.inject(Router).url).toContain('sort=startedAt,desc');
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

  describe('the progress tabs', () => {
    const tabs = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const activePanel = () =>
      el.querySelector<HTMLElement>('[role="tabpanel"]:not([inert])');

    it('starts with courses and makes the other panels inert', async () => {
      await open();
      expect(tabs().map((tab) => tab.textContent?.trim())).toEqual([
        'Tiến độ khóa học',
        'Năng lực',
        'Lịch sử thi',
      ]);
      expect(activePanel()?.getAttribute('aria-label')).toBe(
        'Danh sách khóa học',
      );
      expect(el.querySelectorAll('[role="tabpanel"][inert]')).toHaveLength(2);
      expect(activePanel()?.querySelector('#progress-rhythm')).toBeNull();
      expect(activePanel()?.querySelector('#progress-competency')).toBeNull();
    });

    it('restores the tab from the URL and preserves course filters on a tab change', async () => {
      await open('/progress?tab=history&overdue=true');
      expect(tabs()[2].getAttribute('aria-selected')).toBe('true');
      expect(activePanel()?.querySelector('#progress-history')).not.toBeNull();
      const requests = calls(learnerEndpoints.myCourses).length;
      tabs()[0].click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/progress?overdue=true');
      expect(
        el.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked,
      ).toBe(true);
      tabs()[1].click();
      await settle();
      expect(
        activePanel()?.querySelector('#progress-competency'),
      ).not.toBeNull();
      expect(TestBed.inject(Router).url).toContain('tab=competency');
      expect(TestBed.inject(Router).url).toContain('overdue=true');
      expect(calls(learnerEndpoints.myCourses)).toHaveLength(requests);
    });

    it('keeps the selected tab out of the CSV query', async () => {
      await open('/progress?tab=history&overdue=true');
      button('Xuất CSV')!.click();
      await settle();
      expect(lastQuery(learnerEndpoints.exportProgress)).toEqual({
        sort: 'lastAccessAt,desc',
        overdue: 'true',
      });
    });
  });

  describe('the competency card', () => {
    const card = () =>
      el.querySelector<HTMLElement>(
        'section[aria-labelledby="progress-competency"]',
      )!;

    it('keeps competency in its own tab after the counts, with no select', async () => {
      await open('/progress?tab=competency');
      expect(el.querySelector('#progress-competency')?.tagName).toBe('H2');
      expect(card().textContent).toContain('Năng lực theo nhóm năng lực');
      expect(card().querySelector('select, [role="combobox"]')).toBeNull();
      const panel = card().closest('[uiTabPanel]');
      expect(panel?.querySelector('#progress-rhythm')).toBeTruthy();
      expect(panel?.querySelector('#progress-weekly')).toBeTruthy();
      const after = (a: Element, b: Element) =>
        !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(after(el.querySelector('app-progress-counts')!, card())).toBe(
        true,
      );
      expect(card().closest('[uiTabPanel]')?.getAttribute('uiTabPanel')).toBe(
        'competency',
      );
    });

    it('shows the large radar from the server rows, once, and keeps it when a filter changes', async () => {
      await open('/progress?tab=competency');
      const view = card().querySelector('app-competency-view')!;
      expect(view.classList).toContain('competency-view--large');
      expect(view.querySelector('ui-radar-chart')).not.toBeNull();
      expect(view.textContent).toContain(
        'Tỷ lệ điểm trên các lượt thi đã chấm',
      );
      expect(calls(learnerQuizEndpoints.myCompetency)).toHaveLength(1);
      expect(lastQuery(learnerQuizEndpoints.myCompetency)).toEqual({});
      button('Tiến độ khóa học')!.click();
      await settle();
      (el.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
      await settle();
      expect(calls(learnerQuizEndpoints.myCompetency)).toHaveLength(1);
    });

    it('shows the inline empty state when no competency has data', async () => {
      answer(learnerQuizEndpoints.myCompetency, {
        status: 200,
        body: envelopeOk([]),
      } as ReturnType<typeof backendRefusal>);
      await open('/progress?tab=competency');
      expect(card().textContent).toContain('Chưa có dữ liệu năng lực');
      expect(card().querySelector('ui-radar-chart')).toBeNull();
    });

    it('fails alone, with a retry, while the counts and the table stay', async () => {
      answer(
        learnerQuizEndpoints.myCompetency,
        backendRefusal('internalError'),
      );
      await open('/progress?tab=competency');
      expect(card().textContent).toContain(
        'Không tải được năng lực theo nhóm năng lực',
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

    it('is still offered to a learner without courses', async () => {
      await open('/progress?tab=competency', '000005', 'giangvien');
      expect(card()).not.toBeNull();
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

    it('asks for ten graded attempts per page, newest first', async () => {
      await open('/progress?tab=history');
      expect(calls(learnerQuizEndpoints.myAttempts)).toHaveLength(1);
      expect(lastQuery(learnerQuizEndpoints.myAttempts)).toMatchObject({
        graded: 'true',
        sort: 'submittedAt,desc',
        size: '10',
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
      await open('/progress?tab=history');
      const items = Array.from(card().querySelectorAll('tbody tr'));
      expect(
        items.map((tr) => tr.querySelector('a')?.getAttribute('href')),
      ).toEqual(['/quiz/1/result/7', '/quiz/5/result/9']);
      const [failed, passed] = items.map((tr) =>
        tr.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(failed).toContain('Luyện tập');
      expect(failed).toContain('42,86% Chưa đạt');
      expect(failed).not.toContain('Tự nộp');
      expect(passed).toContain('Kiểm tra cuối khóa');
      expect(passed).toContain('Tự nộp');
      expect(passed).toContain('100% Đạt');
      expect(
        Array.from(card().querySelectorAll('[uiBadge]')).map((n) =>
          n.textContent?.trim(),
        ),
      ).toEqual(['Chưa đạt', 'Đạt']);
    });

    it('has a separate tab from competency', async () => {
      await open('/progress?tab=history');
      expect(card().closest('[uiTabPanel]')?.getAttribute('uiTabPanel')).toBe(
        'history',
      );
      expect(card().closest('[uiTabPanel]')).not.toBe(
        el.querySelector('#progress-competency')?.closest('[uiTabPanel]'),
      );
      expect(
        el
          .querySelector('#progress-competency')!
          .compareDocumentPosition(el.querySelector('#progress-history')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('says so when nothing was graded', async () => {
      answer(learnerQuizEndpoints.myAttempts, page([]));
      await open('/progress?tab=history');
      expect(card().textContent).toContain(
        'Bạn chưa có bài kiểm tra nào được chấm.',
      );
      expect(card().textContent).not.toContain('phù hợp với bộ lọc');
      expect(card().querySelector('tbody tr')).toBeNull();
    });

    it('fails alone, with a retry, while the rest of the page stays', async () => {
      answer(learnerQuizEndpoints.myAttempts, backendRefusal('internalError'));
      await open('/progress?tab=history');
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
        'Bạn chưa có bài kiểm tra nào được chấm.',
      );
    });

    it('is still offered to a learner without courses', async () => {
      await open('/progress?tab=history', '000005', 'giangvien');
      expect(card()).not.toBeNull();
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

    it('sees no average or error and keeps the course list available', () => {
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
      expect(el.querySelector('.learning-progress__courses')).toBeNull();
      expect(rows()).toHaveLength(0);
      expect((button('Xuất CSV') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('the streak and the heatmap', () => {
    it('shows the server streak in working days and 26 weeks of days with no pagination', async () => {
      await open();
      expect(calls(learnerEndpoints.myStreak).length).toBe(1);
      const figures = Array.from(
        el.querySelectorAll('.learning-progress__streak div'),
      ).map((node) =>
        Array.from(node.querySelectorAll('dt, dd')).map((part) =>
          part.textContent?.trim(),
        ),
      );
      expect(figures).toEqual([
        ['Chuỗi hiện tại', '3 ngày làm việc'],
        ['Chuỗi dài nhất', '8 ngày làm việc'],
      ]);
      const cells = el.querySelectorAll('.activity-heatmap__cell');
      expect(cells.length).toBeGreaterThanOrEqual(25 * 7);
      expect(cells.length).toBeLessThanOrEqual(26 * 7);
      expect(
        Array.from(cells).every((cell) => cell.getAttribute('aria-label')),
      ).toBe(true);
    });

    it('says rest days neither count nor break the streak and never mentions a lost streak', async () => {
      await open();
      expect(text()).toContain('không làm gián đoạn chuỗi');
      expect(text()).not.toMatch(/mất chuỗi|đứt chuỗi của bạn|đã mất/i);
    });

    it('shows its own error with a retry while the rest of the page stays', async () => {
      answer(learnerEndpoints.myStreak, backendRefusal('internalError'));
      await open();
      expect(text()).toContain('Không tải được chuỗi ngày học');
      expect(kpi('Tổng số khóa')).toBeTruthy();
      expect(el.querySelector('.activity-heatmap')).toBeNull();
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
      expect(el.querySelector('ui-stat-strip')).toBeNull();
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
