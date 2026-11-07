import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { ImpactReport } from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { FileSaver } from '../../../core/files/file-saver';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { SessionStore } from '../../../core/session/session.store';

const report: ImpactReport = {
  from: '2026-10-11',
  to: '2026-11-07',
  launchedAt: '2026-11-07T02:15:03Z',
  learners: 48,
  weeklyActive: [
    { weekStart: '2026-10-19', learners: 19 },
    { weekStart: '2026-10-26', learners: 24 },
  ],
  assigned: {
    assigned: 120,
    completed: 84,
    completedOnTime: 66,
    completionRatePercent: 70,
    onTimeRatePercent: 55,
  },
  comparison: {
    launchedAt: '2026-11-07T02:15:03Z',
    windowDays: 28,
    before: {
      from: '2026-10-10',
      to: '2026-11-06',
      weeklyActiveLearners: 14.5,
      assigned: {
        assigned: 90,
        completed: 54,
        completedOnTime: 40,
        completionRatePercent: 60,
        onTimeRatePercent: 44.4,
      },
    },
    after: null,
  },
  xpBySource: [
    { source: 'LESSON', xp: 1800, learners: 40 },
    { source: 'QUIZ_PASS', xp: 900, learners: 31 },
  ],
  badges: [
    { badgeId: 1, name: 'Khóa học đầu tiên', awarded: 30 },
    { badgeId: 2, name: 'Mười khóa học', awarded: 0 },
  ],
  levels: [
    { level: 1, name: 'Giao dịch viên tập sự', learners: 20 },
    { level: 2, name: 'Giao dịch viên', learners: 28 },
  ],
  optOut: { hidden: 4, learners: 48, ratePercent: 8.3 },
};

const IMPACT = '/api/v1/reports/learning/gamification-impact';
const UNITS = (url: string) =>
  url.startsWith('/api/v1/reports/learning/groups');

describe('GamificationImpact', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let el: HTMLElement;
  const saved: string[] = [];

  beforeEach(() => {
    saved.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
        {
          provide: FileSaver,
          useValue: { save: (_blob: Blob, name: string) => saved.push(name) },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    );
  const field = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('ui-field'))
      .find((f) => f.querySelector('label')?.textContent?.includes(label))
      ?.querySelector('input, select') as HTMLInputElement;

  async function open(body: ImpactReport = report) {
    fakeSession().user.set(seedProfile('000002'));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/reports/gamification');
    await settle();
    backend
      .expectOne((r) => UNITS(r.url))
      .flush(
        envelopeOk({
          items: [
            {
              id: '5',
              name: 'Ban Core Banking',
              enrollments: 0,
              learners: 0,
              courses: 0,
              completed: 0,
              inProgress: 0,
              notStarted: 0,
              overdue: 0,
              averageProgress: 0,
              completionRate: 0,
            },
          ],
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
        }),
      );
    backend.expectOne(IMPACT).flush(envelopeOk(body));
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  async function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  it('shows the server figures: rates, weekly bars, the comparison, XP, badges and levels', async () => {
    await open();
    expect(el.querySelector('h1')?.textContent).toBe('Tác động gamification');
    expect(text()).toContain('Phạm vi có 48 học viên');
    expect(text()).toContain('70% 84/120 khóa được giao');
    expect(text()).toContain('55%');
    expect(text()).toContain('8.3% 4/48 học viên');
    expect(el.querySelector('ui-bar-chart svg')).toBeTruthy();
    expect(text()).toContain('Hoàn thành bài học');
    expect(text()).toContain('1800');
    expect(text()).toContain('Khóa học đầu tiên');
    expect(text()).toContain('Cấp 2 - Giao dịch viên');
  });

  it('compares the window before launch and says nothing follows it yet', async () => {
    await open();
    expect(text()).toContain('Học viên hoạt động trung bình mỗi tuần 14.5 —');
    expect(text()).toContain('60% —');
    expect(text()).toContain('Chưa có ngày nào sau khi ra mắt để so sánh.');
  });

  it('shows an empty scope instead of zeros', async () => {
    await open({ ...report, learners: 0 });
    expect(text()).toContain('Không có học viên trong phạm vi này');
    expect(el.querySelector('ui-bar-chart')).toBeNull();
  });

  it('reads the report again for the chosen period and unit', async () => {
    await open();
    await type(field('Từ ngày'), '2026-10-01');
    await type(field('Đến ngày'), '2026-10-31');
    await type(field('Đơn vị'), '5');
    button('Áp dụng bộ lọc')?.click();
    await settle();

    const request = backend.expectOne(
      (r) => r.url === IMPACT && r.params.has('from'),
    );
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-31');
    expect(request.request.params.get('orgId')).toBe('5');
    request.flush(envelopeOk({ ...report, learners: 12 }));
    await settle();
    expect(text()).toContain('Phạm vi có 12 học viên');
  });

  it('sends nothing when the period ends before it starts', async () => {
    await open();
    await type(field('Từ ngày'), '2026-10-31');
    await type(field('Đến ngày'), '2026-10-01');
    button('Áp dụng bộ lọc')?.click();
    await settle();

    backend.expectNone((r) => r.url === IMPACT);
    expect(text()).toContain('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
  });

  it('exports the CSV for the filters in force', async () => {
    await open();
    button('Xuất CSV')?.click();
    await settle();

    const request = backend.expectOne(`${IMPACT}/export`);
    expect(request.request.method).toBe('GET');
    request.flush(new Blob(['﻿"Nhóm"']));
    await settle();
    expect(saved).toEqual(['tac-dong-gamification.csv']);
  });

  it('tells a caller outside the report roles it is refused, without a retry', async () => {
    fakeSession().user.set(seedProfile('000002'));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/reports/gamification');
    await settle();
    const denied = backendRefusal('accessDenied');
    backend
      .expectOne((r) => UNITS(r.url))
      .flush(denied.body, {
        status: denied.status,
        statusText: 'Forbidden',
      });
    backend.expectOne(IMPACT).flush(denied.body, {
      status: denied.status,
      statusText: 'Forbidden',
    });
    await settle();
    el = harness.routeNativeElement as HTMLElement;
    expect(text()).toContain('Không tải được báo cáo');
    expect(button('Thử lại')).toBeUndefined();
  });
});
