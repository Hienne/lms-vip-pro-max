import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  assessmentReportEndpoints as api,
  learningReportEndpoints as learning,
  type LearningReportSummary,
} from '@lms/contracts';
import { envelopeError, envelopeOk } from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import { provideAppConfig } from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { ReportScreenStore } from './data-access/report-screen.store';

describe('ReportScreen', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
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
    signInToMockBackend('quantri.ban');
    fakeSession().user.set(seedProfile('000003'));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    await settle();
    const root = harness.routeNativeElement as HTMLElement;
    const store = harness.routeDebugElement!.injector.get(ReportScreenStore);
    const labels = () =>
      Array.from(root.querySelectorAll('form label')).map((l) =>
        l.textContent?.replace(/\s+/g, ' ').trim(),
      );
    const text = () => root.textContent?.replace(/\s+/g, ' ') ?? '';
    return { root, store, labels, text };
  }

  it('shows three report groups and opens filters with an icon before the label', async () => {
    const { root } = await open('/reports');
    const links = root.querySelectorAll('nav[aria-label="Nhóm báo cáo"] a');
    expect(Array.from(links).map((link) => link.textContent?.trim())).toEqual([
      'Tổng quan',
      'Học tập',
      'Đánh giá',
    ]);
    const button = root.querySelector<HTMLButtonElement>(
      '[aria-controls="report-filters"]',
    )!;
    expect(button.firstElementChild?.tagName.toLowerCase()).toBe('ui-icon');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    await settle();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector<HTMLElement>('#report-filters')?.hidden).toBe(
      false,
    );
  });

  it('filters by name, with no id inputs left', async () => {
    const { root, labels } = await open('/reports/results');
    const pickers = ['Đơn vị', 'Phòng / nhóm', 'Khóa học', 'Bài kiểm tra'];
    expect(labels().filter((label) => pickers.includes(label ?? ''))).toEqual([
      'Đơn vị',
      'Phòng / nhóm',
      'Khóa học',
      'Bài kiểm tra',
    ]);
    expect(labels().some((label) => /^ID /.test(label ?? ''))).toBe(false);
    expect(
      root.querySelector(
        'input[inputmode="numeric"]:not([placeholder*="yyyy"])',
      ),
    ).toBeNull();
  });

  describe('assessment report selection', () => {
    const reportType = (root: HTMLElement) => {
      const select = root.querySelector<HTMLSelectElement>(
        '#assessment-report-type',
      );
      if (!select) throw new Error('Assessment report selector missing');
      return select;
    };

    it.each(['results', 'learners', 'competency', 'questions'])(
      'selects the current type when opening %s directly',
      async (type) => {
        const { root } = await open(`/reports/${type}`);
        const select = reportType(root);
        expect(select?.value).toBe(type);
        expect(select?.disabled).toBe(false);
        expect(Array.from(select?.options ?? []).map((o) => o.value)).toEqual([
          'results',
          'learners',
          'competency',
          'questions',
        ]);
      },
    );

    it('switches all report types, preserving scope and resetting pagination', async () => {
      const { root, store } = await open('/reports/results?courseId=1&page=2');
      for (const type of ['competency', 'questions', 'learners', 'results']) {
        const select = reportType(root);
        select.value = type;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await settle();
        expect(store.dimension$()).toBe(type);
        expect(store.filters$().courseId).toBe(1);
        expect(store.page$()).toBe(1);
        expect(reportType(root)?.value).toBe(type);
      }
    });

    it.each([
      '/reports/learners',
      '/reports/results?userId=000099',
      '/reports/results?courseId=9999',
    ])(
      'allows switching from a missing or empty selection on %s',
      async (path) => {
        const { root, store } = await open(path);
        const select = reportType(root);
        expect(select).not.toBeNull();
        select.value = 'questions';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await settle();
        expect(store.dimension$()).toBe('questions');
        expect(reportType(root)?.value).toBe('questions');
      },
    );

    it.each(['error', 'null'])(
      'keeps the selector usable when the report API returns %s',
      async (reply) => {
        const backend = TestBed.inject(MockBackend);
        const handle = backend.handle.bind(backend);
        vi.spyOn(backend, 'handle').mockImplementation((endpoint, request) =>
          endpoint === api.results
            ? {
                status: reply === 'error' ? 500 : 200,
                body:
                  reply === 'null'
                    ? envelopeOk(null)
                    : envelopeError(
                        'CORE-INTERNAL_ERROR',
                        'Lỗi',
                        'Không tải được báo cáo.',
                      ),
              }
            : handle(endpoint, request),
        );
        const { root, store } = await open('/reports/results');
        expect(root.querySelector('ui-error-state')).not.toBeNull();
        const select = reportType(root);
        expect(select?.disabled).toBe(false);
        select.value = 'competency';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await settle();
        expect(store.dimension$()).toBe('competency');
        expect(reportType(root)?.value).toBe('competency');
      },
    );

    it('does not repeat report requests once filters have settled', async () => {
      const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      await open('/reports/results?orgId=1&courseId=1&quizId=1');
      const count = spy.mock.calls.length;
      await settle();
      expect(spy.mock.calls.length).toBe(count);
    });
  });

  it('runs "Tình trạng học viên" from the pickers alone', async () => {
    const spy = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    const { root, store, labels, text } = await open('/reports/learners');
    expect(labels().slice(0, 4)).toEqual([
      'Đơn vị',
      'Phòng / nhóm',
      'Khóa học',
      'Bài kiểm tra*',
    ]);
    expect(text()).toContain(
      'Chọn khóa học và bài kiểm tra để xem cả học viên chưa thi.',
    );
    const quiz = root.querySelectorAll<HTMLSelectElement>(
      'app-report-picker select',
    )[3];
    expect(quiz.disabled).toBe(true);
    expect(text()).toContain('Chọn khóa học trước');

    store.pickers.pick('courseId', store.pickers.options$.courseId()[0]);
    await settle();
    store.pickers.pick('quizId', store.pickers.options$.quizId()[0]);
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();

    expect(TestBed.inject(Router).url).toBe(
      '/reports/learners?courseId=1&quizId=1',
    );
    expect(spy.mock.calls.some(([e]) => e === api.learners)).toBe(true);
    expect(text()).not.toContain('Chọn khóa học và bài kiểm tra');
  });

  describe('Xuất CSV', () => {
    const exportButton = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Xuất CSV'),
      )!;
    const reason = (root: HTMLElement) => {
      const button = exportButton(root);
      return button
        .getAttribute('aria-describedby')
        ?.split(' ')
        .map((id) => root.ownerDocument.getElementById(id)?.textContent?.trim())
        .join(' ');
    };

    it.each([
      ['/reports', 'Chọn một báo cáo chi tiết để xuất CSV.'],
      ['/reports/learners', 'Chọn bài kiểm tra để xuất.'],
      ['/reports/results?userId=000099', 'Không có dữ liệu để xuất.'],
    ])('on %s says why it is disabled', async (path, text) => {
      const { root } = await open(path);
      expect(exportButton(root).disabled).toBe(true);
      expect(reason(root)).toBe(text);
      expect(
        exportButton(root).closest('[uiTooltip], .report-screen__export'),
      ).not.toBeNull();
    });

    it('is enabled, with no reason, when there are rows', async () => {
      const { root } = await open('/reports/results');
      expect(exportButton(root).disabled).toBe(false);
      expect(exportButton(root).hasAttribute('aria-describedby')).toBe(false);
    });
  });

  it('describes the view it shows', async () => {
    const { text } = await open('/reports');
    expect(text()).toContain(
      'Tiến độ học và kết quả thi theo phạm vi được cấp.',
    );
  });

  it('keeps the quiz picker waiting while the course of the link is not found', async () => {
    const { root, text } = await open('/reports/results?courseId=9999');
    const quiz = root.querySelectorAll<HTMLSelectElement>(
      'app-report-picker select',
    )[3];
    expect(quiz.disabled).toBe(true);
    expect(text()).not.toContain('Không có dữ liệu phù hợp');
  });

  it('says a report from a bad link does not exist', async () => {
    const { text } = await open('/reports/programs');
    expect(text()).toContain('Không có báo cáo này. Chọn một báo cáo ở trên.');
  });

  describe('Tổng quan', () => {
    const SUMMARY: LearningReportSummary = {
      dataAsOf: '2026-11-04T09:49:21Z',
      timeZone: 'Asia/Ho_Chi_Minh',
      counts: {
        enrollments: 21,
        learners: 3,
        courses: 9,
        assigned: 18,
        mandatory: 18,
        completed: 9,
        inProgress: 5,
        notStarted: 7,
        overdue: 5,
        averageProgress: 49.01,
        completionRate: 42.86,
      },
    };
    /** Answers the learning summary with `reply`, and the rest from the mock backend. */
    function answerSummary(reply: () => object) {
      const backend = TestBed.inject(MockBackend),
        handle = backend.handle.bind(backend);
      vi.spyOn(backend, 'handle').mockImplementation((endpoint, request) =>
        endpoint === learning.summary
          ? { status: 200, body: reply() as never }
          : handle(endpoint, request),
      );
    }
    const kpis = (root: HTMLElement) =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          '[aria-labelledby="report-learning-title"] ui-stat',
        ),
      ).map((stat) => ({
        label: stat.querySelector('.stat__label')?.textContent?.trim(),
        value: stat.querySelector('.stat__value')?.textContent?.trim(),
        danger: !!stat.querySelector('.stat__value--danger'),
      }));

    it('shows the learning KPIs first, then the exam results', async () => {
      answerSummary(() => envelopeOk(SUMMARY));
      const { root, text } = await open('/reports');
      const headings = Array.from(root.querySelectorAll('h2')).map((h) =>
        h.textContent?.trim(),
      );
      expect(headings.indexOf('Tiến độ học')).toBeGreaterThanOrEqual(0);
      expect(headings.indexOf('Tiến độ học')).toBeLessThan(
        headings.indexOf('Kết quả thi'),
      );
      expect(kpis(root)).toHaveLength(4);
      expect(kpis(root).slice(0, 2)).toEqual([
        { label: 'Lượt học', value: '21', danger: false },
        { label: 'Hoàn thành', value: '42,9%', danger: false },
      ]);
      expect(
        root.querySelectorAll('ui-donut-chart').length,
      ).toBeGreaterThanOrEqual(1);
      expect(text()).toContain(
        'Số liệu tính đến 04/11/2026 16:49 (Asia/Ho_Chi_Minh).',
      );
    });

    it('keeps the overdue figure neutral at zero', async () => {
      answerSummary(() =>
        envelopeOk({ ...SUMMARY, counts: { ...SUMMARY.counts, overdue: 0 } }),
      );
      const { root } = await open('/reports');
      expect(root.textContent).not.toContain('0 lượt quá hạn');
    });

    it('shows a learning error with a retry while the exam results stay', async () => {
      answerSummary(() =>
        envelopeError(
          'CORE-INTERNAL_ERROR',
          'Lỗi',
          'Không tải được tiến độ học.',
        ),
      );
      const { root, text } = await open('/reports');
      const learningPart = root.querySelector(
        '[aria-labelledby="report-learning-title"]',
      )!;
      expect(learningPart.querySelector('ui-error-state')).not.toBeNull();
      expect(text()).toContain('Kết quả thi');
      expect(root.querySelector('ui-donut-chart')).not.toBeNull();
    });
  });

  describe('Tiến độ & hoàn thành', () => {
    it('shows a failed summary with retry without hiding the progress rows', async () => {
      const backend = TestBed.inject(MockBackend);
      const handle = backend.handle.bind(backend);
      let failed = true;
      vi.spyOn(backend, 'handle').mockImplementation((endpoint, request) =>
        endpoint === learning.summary && failed
          ? {
              status: 500,
              body: envelopeError(
                'CORE-INTERNAL_ERROR',
                'Lỗi',
                'Không tải được tổng hợp học tập.',
              ),
            }
          : handle(endpoint, request),
      );
      const { root, store, text } = await open('/reports/progress');
      expect(
        root.querySelector('app-progress-report ui-error-state'),
      ).not.toBeNull();
      expect(text()).toContain('Tổng quan hệ thống Core Banking');
      failed = false;
      store.retryLearning();
      await settle();
      expect(
        root.querySelector('app-progress-report ui-error-state'),
      ).toBeNull();
      expect(store.learning$()).toBeDefined();
    });

    it('shows scope loading failures rather than an empty progress report', async () => {
      const backend = TestBed.inject(MockBackend);
      const handle = backend.handle.bind(backend);
      vi.spyOn(backend, 'handle').mockImplementation((endpoint, request) =>
        endpoint === learning.groups
          ? {
              status: 500,
              body: envelopeError(
                'CORE-INTERNAL_ERROR',
                'Lỗi',
                'Không tải được phạm vi báo cáo.',
              ),
            }
          : handle(endpoint, request),
      );
      const { root, text } = await open('/reports/progress?orgId=1');
      expect(root.querySelector('ui-error-state')).not.toBeNull();
      expect(text()).toContain('Không tải được phạm vi báo cáo.');
    });

    it('filters by unit, team, course, status, overdue and enrolment dates', async () => {
      const { labels } = await open('/reports/progress');
      expect(labels()).toEqual(
        expect.arrayContaining([
          'Ghi danh từ ngày',
          'Đến trước ngày',
          'Đơn vị',
          'Phòng / nhóm',
          'Khóa học',
          'Trạng thái',
          'Chỉ quá hạn',
        ]),
      );
      expect(labels()).not.toContain('Bài kiểm tra');
    });

    it('lists the course groups, each name linking to its learners', async () => {
      const { root, text } = await open('/reports/progress');
      expect(text()).toContain('Theo khóa học');
      expect(text()).toContain('Tỷ lệ hoàn thành');
      const link = root.querySelector<HTMLAnchorElement>(
        '.progress-report__name[href]',
      );
      expect(link?.getAttribute('href')).toMatch(
        /^\/reports\/progress\?courseId=\d+&view=learners$/,
      );
    });

    it('lists the learners with one danger badge for an overdue enrolment', async () => {
      const { root, text } = await open('/reports/progress?view=learners');
      for (const label of [
        'Mã cán bộ',
        'Học viên',
        'Đơn vị',
        'Khóa học',
        'Tiến độ (%)',
        'Trạng thái',
        'Hạn',
        'Quá hạn',
        'Học gần nhất',
      ])
        expect(text()).toContain(label);
      root.querySelectorAll('.badge').forEach((badge) => {
        expect(badge.textContent?.trim()).toBe('Quá hạn');
        expect(badge.classList).toContain('badge--danger');
        expect(badge.classList).toContain('badge--dot');
      });
    });

    it('says when no enrolment matches', async () => {
      const { text } = await open(
        '/reports/progress?view=learners&learningStatus=completed&overdue=true',
      );
      expect(text()).toContain('Không có lượt học phù hợp với bộ lọc.');
    });
  });
});
