import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { envelopeOk } from '@lms/mocks';
import { createAppRoutes } from '../../app.routes';
import { parseAppConfig, provideAppConfig } from '../../core/config/app-config';
import { testAppConfig } from '../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../core/http/http.testing';
import { SessionStore } from '../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../core/session/session.testing';

const ENDPOINT = '/api/v1/reports/learning/dashboard';
const LEADERBOARD = '/api/v1/me/learning/leaderboard';
const response = {
  dataAsOf: '2026-11-18T03:00:00Z',
  timeZone: 'Asia/Ho_Chi_Minh',
  counts: {
    enrollments: 4,
    learners: 2,
    courses: 2,
    mandatory: 2,
    assigned: 3,
    completed: 2,
    inProgress: 1,
    notStarted: 1,
    overdue: 0,
    averageProgress: 60,
    completionRate: 50,
  },
  daily: [
    { date: '2026-11-05', started: 0, completed: 0 },
    { date: '2026-11-18', started: 1, completed: 2 },
  ],
};

describe('ManagementDashboard', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    }),
  );

  it.each([
    ['/instructor', '000005'],
    ['/admin', '000002'],
  ])(
    'shows the named greeting, activity window and ranking at %s',
    async (path, userId) => {
      const profile = seedProfile(userId);
      fakeSession().user.set(profile);
      const http = TestBed.inject(HttpTestingController);
      const harness = await RouterTestingHarness.create(path);
      TestBed.tick();
      http.expectOne(ENDPOINT + '?days=0').flush(envelopeOk(response));
      const top = Array.from({ length: 6 }, (_, index) => ({
        rank: index + 1,
        userId: String(index + 111),
        fullName: index ? 'Học viên ' + index : 'Nguyễn Lan',
        points: 200 - index,
        teamName: null,
        streakDays: 0,
        me: false,
      }));
      http
        .expectOne(
          (request) =>
            request.url.endsWith(LEADERBOARD) &&
            request.params.get('scope') === 'all' &&
            request.params.get('period') === 'month',
        )
        .flush(
          envelopeOk({
            period: 'month',
            offset: 0,
            from: null,
            to: null,
            top,
            me: { ...top[0], rank: null, me: true },
            above: [],
            gapToAbove: null,
          }),
        );
      await harness.fixture.whenStable();
      harness.detectChanges();
      const root = harness.routeNativeElement!;
      expect(root.querySelector('h1')?.textContent?.trim()).toBe(
        'Xin chào, ' + profile.fullName,
      );
      expect(
        root.querySelector('.dashboard__chart-note')?.textContent,
      ).toContain('tối đa 30 ngày gần nhất');
      expect(root.querySelector('.dashboard__dates')).toBeNull();
      expect(
        root.querySelector('.dashboard__learner')?.textContent?.trim(),
      ).toBe('Nguyễn Lan');
      expect(
        root.querySelector('.dashboard__result')?.textContent?.trim(),
      ).toBe('200');
      expect(
        root.querySelectorAll('.dashboard__leaders tbody tr'),
      ).toHaveLength(5);
      expect(
        root.querySelector('.dashboard__ranking a')?.getAttribute('href'),
      ).toBe('/leaderboard?scope=all&period=month');
      expect(
        root
          .querySelector('ui-bar-chart .chart-view__compact-value')
          ?.textContent?.trim(),
      ).toBe('1');
      expect(root.textContent).not.toContain('Công việc đào tạo');

      const select = root.querySelector('select')!;
      expect(select.value).toBe('0');
      expect(select.selectedOptions[0].textContent?.trim()).toBe(
        'Toàn thời gian',
      );
      select.value = '7';
      select.dispatchEvent(new Event('change'));
      TestBed.tick();
      http.expectOne(ENDPOINT + '?days=7').flush(
        envelopeOk({
          ...response,
          counts: {
            ...response.counts,
            enrollments: 1,
            completed: 1,
            inProgress: 0,
            notStarted: 0,
            completionRate: 100,
          },
          daily: [
            { date: '2026-11-12', started: 0, completed: 0 },
            response.daily[1],
          ],
        }),
      );
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(root.textContent).toContain('12/11 – 18/11/2026');
      expect(root.querySelector('.dashboard__chart-note')).toBeNull();
      expect(root.querySelector('.dashboard__stats')?.textContent).toContain(
        '100%',
      );
      expect(
        root
          .querySelector('ui-donut-chart .chart-view__center-value')
          ?.textContent?.trim(),
      ).toBe('1');
      expect(
        root.querySelectorAll('.dashboard__leaders tbody tr'),
      ).toHaveLength(5);
      http.expectNone((request) => request.url.endsWith(LEADERBOARD));
      http.verify();
    },
  );
});
