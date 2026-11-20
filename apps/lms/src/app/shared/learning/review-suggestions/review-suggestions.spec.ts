import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { competencyReviewEndpoints } from '@lms/contracts';
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

describe('"Ôn lại" suggestions', () => {
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
    for (let i = 0; i < 5; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  async function open(url: string) {
    signInToMockBackend('hocvien');
    fakeSession().user.set(seedProfile('000004'));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const links = () =>
    Array.from(
      el.querySelectorAll<HTMLAnchorElement>('app-review-suggestions a'),
    );
  const reviewCalls = () =>
    handle.mock.calls.filter(([e]) => e === competencyReviewEndpoints.review);

  /** Answers the review endpoint with `data`, or refuses it; the rest is the mock's. */
  function answerReview(data: unknown | 'fail') {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((endpoint, request) =>
      endpoint === competencyReviewEndpoints.review
        ? data === 'fail'
          ? backendRefusal('internalError')
          : { status: 200, body: envelopeOk(data) }
        : MockBackend.prototype.handle.call(backend, endpoint, request),
    );
  }

  describe('on "Năng lực của tôi"', () => {
    it('lists the lessons of every weak competency, each opening with the quick questions', async () => {
      await open('/progress?tab=competency');

      expect(text()).toContain('Ôn lại');
      expect(text()).toContain('Kiểm soát và tuân thủ');
      expect(text()).toContain('Vận hành và quy trình');
      expect(text()).toContain('3 câu sai');
      expect(links().length).toBeGreaterThanOrEqual(3);
      for (const link of links()) {
        expect(link.getAttribute('href')).toMatch(
          /^\/lesson\/\d+\/\d+\?checkpoint=1$/,
        );
      }
      expect(
        el.querySelector('app-review-suggestions')!.textContent,
      ).not.toContain('Kiến trúc và tổng quan hệ thống');
      const asked = reviewCalls()[0][1].query;
      expect(asked['limit']).toBe('10');
    });

    it('shows nothing extra when no competency is weak', async () => {
      answerReview([]);
      await open('/progress?tab=competency');

      expect(el.querySelector('#progress-review')).toBeNull();
      expect(el.querySelector('app-review-suggestions')).toBeNull();
    });

    it('says a weak competency has nothing left to review', async () => {
      answerReview([
        { competencyId: 2, name: 'Kiểm soát', percent: 0, lessons: [] },
      ]);
      await open('/progress?tab=competency');

      expect(text()).toContain('Bạn đã ôn xong các bài của năng lực này.');
    });

    it('offers a retry when the suggestions cannot be read', async () => {
      answerReview('fail');
      await open('/progress?tab=competency');
      expect(text()).toContain('Không tải được gợi ý ôn tập');

      handle.mockRestore();
      handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      Array.from(el.querySelectorAll('button'))
        .find(
          (b) =>
            b.textContent?.includes('Thử lại') &&
            b.closest('ui-error-state')?.textContent?.includes('gợi ý'),
        )!
        .click();
      await settle();
      expect(text()).toContain('Kiểm soát và tuân thủ');
    });
  });

  describe('on the learner home', () => {
    it('shows a card for the weakest competency only', async () => {
      await open('/learn');

      expect(text()).toContain('Gợi ý ôn tập');
      expect(text()).toContain('Kiểm soát và tuân thủ');
      expect(text()).not.toContain('Vận hành và quy trình');
      expect(reviewCalls()[0][1].query['limit']).toBe('1');
      expect(links().length).toBeGreaterThan(0);
      expect(links()[0].getAttribute('href')).toMatch(
        /^\/lesson\/\d+\/\d+\?checkpoint=1$/,
      );
    });

    it('hides the card when nothing is weak', async () => {
      answerReview([]);
      await open('/learn');

      expect(text()).not.toContain('Gợi ý ôn tập');
    });

    it('offers a retry when the suggestion cannot be read, without blanking the page', async () => {
      answerReview('fail');
      await open('/learn');

      expect(text()).toContain('Không tải được gợi ý ôn tập');
      expect(text()).toContain('Khóa học của tôi');
    });
  });
});
