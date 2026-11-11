import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { certificateEndpoints, type Certificate } from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
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
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';

const certificate = (over: Partial<Certificate> = {}): Certificate => ({
  id: 12,
  courseId: 4,
  courseCode: 'FE-DEMO-C4',
  courseTitle: 'Văn hóa và quy chế làm việc',
  cycleNo: 1,
  revisionId: 4,
  userId: '000004',
  fullName: 'Học viên tiền gửi Demo',
  completedAt: '2026-10-27T04:44:04Z',
  bestScorePercent: null,
  verificationCode: 'CBA-FE-DEMO-C4-000004-1',
  ...over,
});

describe('Certificates', () => {
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
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  }

  async function open(username = 'hocvien', userId = '000004') {
    signInToMockBackend(username);
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/certificates');
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = (node: Element = el) =>
    node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const rows = () => Array.from(el.querySelectorAll('.certificates__row'));
  const calls = () =>
    handle.mock.calls.filter(([e]) => e === certificateEndpoints.certificates);

  /** Answers the list with these certificates, the rest as the mock does. */
  function serve(items: Certificate[]) {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((e, request) =>
      e === certificateEndpoints.certificates
        ? {
            status: 200,
            body: envelopeOk({
              items,
              page: 0,
              size: 100,
              totalElements: items.length,
              totalPages: items.length ? 1 : 0,
            }),
          }
        : MockBackend.prototype.handle.call(backend, e, request),
    );
  }

  describe('a learner with a certificate', () => {
    beforeEach(() => open());

    it('titles the page and explains it with the mockup description', () => {
      expect(el.querySelectorAll('h1')).toHaveLength(1);
      expect(el.querySelector('h1')?.textContent).toContain(
        'Chứng nhận hoàn thành',
      );
      expect(text()).toContain(
        'Chứng nhận tự động cấp khi bạn hoàn thành khóa học. Mỗi chứng nhận có mã xác thực.',
      );
    });

    it('asks the server for one page of 100', () => {
      expect(calls()).toHaveLength(1);
      expect(calls()[0][1].query).toMatchObject({ page: '0', size: '100' });
    });

    it('lists the server certificate as a row: the title as a link, the meta line and the code', () => {
      expect(rows()).toHaveLength(1);
      const [row] = rows();
      const link = row.querySelector<HTMLAnchorElement>('a')!;
      expect(link.getAttribute('href')).toMatch(/^\/certificate\/\d+$/);
      expect(text(link)).not.toBe('');
      expect(text(row.querySelector('.certificates__meta')!)).toMatch(
        /^[A-Z0-9-]+ · Hoàn thành \d{2}\/\d{2}\/\d{4} · Điểm 90%$/,
      );
      expect(text(row.querySelector('.certificates__code')!)).toMatch(
        /^CBA-[A-Z0-9-]+-000004-1$/,
      );
    });

    it('shows a certificate document preview without decorative badges', () => {
      expect(el.querySelector('.badge, [uiBadge], ui-empty')).toBeNull();
      expect(el.querySelectorAll('.certificates__preview')).toHaveLength(1);
      expect(el.querySelector('.certificates__preview ui-mai')).not.toBeNull();
      expect(el.querySelector('.certificate__name')?.textContent).toContain(
        'Học viên',
      );
      expect(text()).not.toContain('Đã cấp');
    });
  });

  describe('the rows', () => {
    it('print the title, the code, the date and the score of each certificate, newest first', async () => {
      serve([
        certificate({
          id: 17,
          courseCode: 'QZ-E2E-01',
          courseTitle: 'Kiểm thử bài kiểm tra E2E',
          completedAt: '2026-10-31T12:47:10Z',
          bestScorePercent: 100,
          verificationCode: 'CBA-QZ-E2E-01-000004-1',
        }),
        certificate(),
      ]);
      await open();
      expect(
        rows().map((row) => [
          text(row.querySelector('a')!),
          text(row.querySelector('.certificates__meta')!),
          text(row.querySelector('.certificates__code')!),
          row.querySelector('a')!.getAttribute('href'),
        ]),
      ).toEqual([
        [
          'Kiểm thử bài kiểm tra E2E',
          'QZ-E2E-01 · Hoàn thành 31/10/2026 · Điểm 100%',
          'CBA-QZ-E2E-01-000004-1',
          '/certificate/17',
        ],
        [
          'Văn hóa và quy chế làm việc',
          'FE-DEMO-C4 · Hoàn thành 27/10/2026',
          'CBA-FE-DEMO-C4-000004-1',
          '/certificate/12',
        ],
      ]);
    });

    it('leave the score out when there is none, and keep a decimal score', async () => {
      serve([
        certificate({ id: 1, bestScorePercent: 87.5 }),
        certificate({ id: 2, bestScorePercent: null }),
      ]);
      await open();
      const metas = rows().map((row) =>
        text(row.querySelector('.certificates__meta')!),
      );
      expect(metas[0]).toContain('· Điểm 87,5%');
      expect(metas[1]).not.toContain('Điểm');
      expect(metas[1]).not.toMatch(/·\s*$/);
    });

    it('show the course code as the title when the revision has none', async () => {
      serve([certificate({ courseTitle: null })]);
      await open();
      expect(text(rows()[0].querySelector('a')!)).toBe('FE-DEMO-C4');
    });
  });

  describe('a learner with no certificate', () => {
    beforeEach(() => open('hocvien.tichhop', '000007'));

    it('says so on a whole page, left-aligned, with one way forward', () => {
      expect(el.querySelectorAll('h1')).toHaveLength(1);
      expect(el.querySelector('h2')?.textContent).toContain(
        'Chưa có chứng nhận',
      );
      expect(text()).toContain(
        'Hoàn thành khóa học đầu tiên để nhận chứng nhận.',
      );
      const action = el.querySelector<HTMLAnchorElement>('ui-empty a')!;
      expect(text(action)).toBe('Xem khóa học của tôi');
      expect(action.getAttribute('href')).toBe('/learn');
      expect(rows()).toHaveLength(0);
    });
  });

  describe('when the list cannot be read', () => {
    function failOnce() {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((e, request) =>
        e === certificateEndpoints.certificates
          ? backendRefusal('internalError')
          : MockBackend.prototype.handle.call(backend, e, request),
      );
    }

    it('says so with a retry and no list', async () => {
      failOnce();
      await open();
      expect(text()).toContain('Không tải được chứng nhận');
      expect(el.querySelectorAll('h1')).toHaveLength(1);
      expect(el.querySelectorAll('button')).toHaveLength(1);
      expect(rows()).toHaveLength(0);
    });

    it('asks again when retry is pressed', async () => {
      failOnce();
      await open();
      handle.mockImplementation((e, request) =>
        MockBackend.prototype.handle.call(
          TestBed.inject(MockBackend),
          e,
          request,
        ),
      );
      el.querySelector<HTMLButtonElement>('button')!.click();
      await settle();
      expect(calls().length).toBeGreaterThanOrEqual(2);
      expect(rows()).toHaveLength(1);
      expect(text()).not.toContain('Không tải được chứng nhận');
    });
  });
});
