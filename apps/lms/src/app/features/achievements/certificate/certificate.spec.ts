import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { certificateEndpoints, type Certificate } from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
import { NEVER, of } from 'rxjs';
import type { MockInstance } from 'vitest';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { EndpointClient } from '../../../core/http/endpoint-client';
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
import { CertificateStore } from './data-access/certificate.store';

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
  bestScorePercent: 90,
  verificationCode: 'CBA-FE-DEMO-C4-000004-1',
  ...over,
});

describe('Certificate', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

  function configure(mockBackend: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  }

  async function open(url: string, username = 'hocvien', userId = '000004') {
    signInToMockBackend(username);
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = (node: Element = el) =>
    node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const calls = () =>
    handle.mock.calls.filter(([e]) => e === certificateEndpoints.certificate);
  const document = () => el.querySelector('article.certificate')!;

  /** Answers the certificate with this one, the rest as the mock does. */
  function serve(item: Certificate) {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((e, request) =>
      e === certificateEndpoints.certificate
        ? { status: 200, body: envelopeOk(item) }
        : MockBackend.prototype.handle.call(backend, e, request),
    );
  }

  function answer(key: Parameters<typeof backendRefusal>[0]) {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((e, request) =>
      e === certificateEndpoints.certificate
        ? backendRefusal(key)
        : MockBackend.prototype.handle.call(backend, e, request),
    );
  }

  describe("the learner's own certificate from the mock", () => {
    beforeEach(async () => {
      configure(true);
      await open('/certificates');
      const href = el
        .querySelector<HTMLAnchorElement>('.certificates__row a')!
        .getAttribute('href')!;
      await harness.navigateByUrl(href);
      await settle();
      el = harness.routeNativeElement as HTMLElement;
    });

    it('titles the page with the course, above a breadcrumb back to the list', () => {
      expect(el.querySelectorAll('h1')).toHaveLength(1);
      const crumbs = el.querySelector('ui-breadcrumb')!;
      expect(text(crumbs.querySelector('a.breadcrumb__link')!)).toBe(
        'Chứng nhận',
      );
      expect(
        crumbs.querySelector('a.breadcrumb__link')!.getAttribute('href'),
      ).toBe('/certificates');
      expect(text(crumbs.querySelector('[aria-current=page]')!)).toBe(
        text(el.querySelector('h1')!),
      );
    });

    it('asks the server once, by the enrollment id of the path', () => {
      expect(calls()).toHaveLength(1);
      expect(calls()[0][1].params).toEqual({
        enrollmentId: expect.stringMatching(/^\d+$/),
      });
    });

    it('prints the server name, course, date, score and code', () => {
      const t = text(document());
      expect(t).toContain('Học viên tiền gửi Demo');
      expect(t).toContain('Đã hoàn thành khóa đào tạo');
      expect(t).toMatch(/Ngày hoàn thành\d{2}\/\d{2}\/\d{4}/);
      expect(t).toMatch(/Mã xác thựcCBA-[A-Z0-9-]+-000004-1/);
      expect(t).toMatch(/Kết quả bài kiểm tra \d+(,\d+)?%/);
    });
  });

  describe('the document', () => {
    beforeEach(() => configure(true));

    it('prints every field, in the order of the sentence', async () => {
      serve(certificate());
      await open('/certificate/12');
      expect(el.querySelector('h1')?.textContent).toBe(
        'Văn hóa và quy chế làm việc',
      );
      expect(document().querySelector('h2')?.textContent).toContain(
        'Chứng nhận hoàn thành',
      );
      const blocks = Array.from(
        document().querySelectorAll('p, h2, dt, dd'),
      ).map((node) => text(node));
      expect(blocks).toEqual([
        'Core Banking Academy',
        'Ban QL&PT Core Banking',
        'Chứng nhận hoàn thành',
        'Trao cho',
        'Học viên tiền gửi Demo',
        'Đã hoàn thành khóa đào tạo',
        'Văn hóa và quy chế làm việc',
        'FE-DEMO-C4',
        'Kết quả bài kiểm tra 90%',
        'Ngày hoàn thành',
        '27/10/2026',
        'Mã xác thực',
        'CBA-FE-DEMO-C4-000004-1',
        'Đơn vị cấp',
        'Ban QL&PT Core Banking',
      ]);
      expect(document().querySelector('ui-mai')).not.toBeNull();
    });

    it('prints the name as the largest text and keeps the code in the mono face', async () => {
      serve(certificate());
      await open('/certificate/12');
      expect(text(document().querySelector('.certificate__name')!)).toBe(
        'Học viên tiền gửi Demo',
      );
      expect(text(document().querySelector('.certificate__code')!)).toBe(
        'CBA-FE-DEMO-C4-000004-1',
      );
    });

    it('leaves the result out when there is no score, and keeps a decimal one', async () => {
      serve(certificate({ bestScorePercent: null }));
      await open('/certificate/12');
      expect(text(document())).not.toContain('kết quả');
      expect(text(document())).toContain('FE-DEMO-C4');

      serve(certificate({ bestScorePercent: 87.5 }));
      await harness.navigateByUrl('/certificate/13');
      await settle();
      expect(text(document())).toContain('Kết quả bài kiểm tra 87,5%');
    });

    it('shows the course code alone when the revision has no title', async () => {
      serve(certificate({ courseTitle: null }));
      await open('/certificate/12');
      expect(el.querySelector('h1')?.textContent).toBe('FE-DEMO-C4');
      expect(text(document())).toContain('FE-DEMO-C4');
      expect(text(document())).not.toContain('(FE-DEMO-C4)');
    });
  });

  describe('print', () => {
    it('opens the print dialog from the one primary action of the header', async () => {
      configure(true);
      serve(certificate());
      await open('/certificate/12');
      const print = vi
        .spyOn(window, 'print')
        .mockImplementation(() => undefined);
      const actions = el.querySelectorAll<HTMLButtonElement>(
        '.page-header__actions button',
      );
      expect(actions).toHaveLength(1);
      expect(text(actions[0])).toBe('In / Lưu PDF');
      expect(actions[0].classList.contains('btn--primary')).toBe(true);
      actions[0].click();
      expect(print).toHaveBeenCalledTimes(1);
    });
  });

  describe('a certificate that cannot be shown', () => {
    beforeEach(() => configure(true));

    const missing = () => {
      expect(el.querySelectorAll('h1')).toHaveLength(1);
      expect(text()).toContain('Không tìm thấy chứng nhận');
      expect(text()).toContain(
        'Chứng nhận không tồn tại hoặc bạn chưa hoàn thành khóa học.',
      );
      const back = el.querySelector<HTMLAnchorElement>('ui-empty a')!;
      expect(back.getAttribute('href')).toBe('/certificates');
      expect(el.querySelector('article')).toBeNull();
      expect(el.querySelector('ui-breadcrumb')).toBeNull();
    };

    it('is "not found" when the server says LEARNING-NOT_FOUND', async () => {
      answer('learningNotFound');
      await open('/certificate/999999');
      expect(calls()).toHaveLength(1);
      missing();
    });

    it('is "not found" for a path that is no number, without asking the server', async () => {
      await open('/certificate/abc');
      expect(calls()).toHaveLength(0);
      missing();
    });

    it('offers a retry for any other failure, and prints the document once it works', async () => {
      answer('internalError');
      await open('/certificate/12');
      expect(text()).toContain('Không tải được chứng nhận');
      expect(text()).not.toContain('Không tìm thấy chứng nhận');
      expect(el.querySelector('article')).toBeNull();

      serve(certificate());
      el.querySelector<HTMLButtonElement>('button')!.click();
      await settle();
      expect(calls().length).toBeGreaterThanOrEqual(2);
      expect(text(document())).toContain('Học viên tiền gửi Demo');
    });
  });
});
