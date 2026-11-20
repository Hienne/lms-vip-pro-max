import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  checkpointEndpoints,
  EnrollmentDetailSchema,
  learnerEndpoints,
  type EnrollmentDetail,
} from '@lms/contracts';
import { backendRefusal, type FakeReply } from '@lms/mocks';
import type { MockInstance } from 'vitest';
import { createAppRoutes } from '../../../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../../core/config/app-config';
import { testAppConfig } from '../../../../../core/config/app-config.testing';
import { MockBackend } from '../../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../../../core/dev/mock-api/mock-backend.testing';
import { SessionStore } from '../../../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../../../core/session/session.testing';

const COURSE = 7;

describe('LessonCheckpoint on the lesson page', () => {
  let backend: MockBackend;
  let handle: MockInstance<MockBackend['handle']>;
  let token: string;
  let detail: EnrollmentDetail;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const real = (): MockBackend['handle'] => (endpoint, request) =>
    MockBackend.prototype.handle.call(backend, endpoint, request);

  const call = (
    endpoint: Parameters<MockBackend['handle']>[0],
    params: Record<string, string> = {},
    body?: unknown,
  ) => real()(endpoint, { token, params, query: { size: '100' }, body });

  beforeEach(() => {
    sessionStorage.clear();
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
    backend = TestBed.inject(MockBackend);
    token = signInToMockBackend('hocvien');
    fakeSession().user.set(seedProfile('000004'));
    const enrolled = call(learnerEndpoints.enroll, {
      courseId: String(COURSE),
    });
    detail = EnrollmentDetailSchema.parse(
      (
        call(learnerEndpoints.enrollment, {
          enrollmentId: String(
            (enrolled?.body as { data: { id: number } }).data.id,
          ),
        })?.body as { data: unknown }
      ).data,
    );
    handle = vi.spyOn(backend, 'handle');
  });

  const lessons = () => detail.content.chapters.flatMap((c) => c.lessons);
  /** The last lesson has one text block, so finishing it finishes the lesson. */
  const lastUrl = (query = '') =>
    `/lesson/${COURSE}/${lessons().at(-1)!.lesson.id}${query}`;

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  }

  async function open(url: string) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const card = () => el.querySelector('app-lesson-checkpoint ui-section-card');
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((node) =>
      node.textContent?.trim().startsWith(label),
    );
  const click = async (label: string) => {
    button(label)!.click();
    await settle();
  };
  const inputs = () =>
    Array.from(
      el.querySelectorAll<HTMLInputElement>(
        'app-lesson-checkpoint input[name^="checkpoint-"]',
      ),
    );
  const pick = async (index: number) => {
    inputs()[index].click();
    await settle();
  };
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);
  const answers = () =>
    calls(checkpointEndpoints.answerCheckpoint).map(
      ([, request]) =>
        request.body as {
          questionId: number;
          questionVersion: number;
          optionIds: number[];
        },
    );

  describe('asked for with ?checkpoint=1', () => {
    beforeEach(() => open(lastUrl('?checkpoint=1')));

    it('shows the first of up to three questions with no key on screen', () => {
      expect(card()).not.toBeNull();
      expect(text()).toContain('Câu hỏi nhanh');
      expect(text()).toContain('Câu 1/3');
      expect(text()).toContain('không tính điểm');
      expect(inputs().length).toBeGreaterThanOrEqual(3);
      expect(el.querySelector('.answer--correct')).toBeNull();
      expect(button('Kiểm tra')!.disabled).toBe(true);
      expect(button('Bỏ qua')).toBeDefined();
    });

    it('has the server grade the ticked option, then marks the key and explains', async () => {
      await pick(1);
      expect(button('Kiểm tra')!.disabled).toBe(false);
      await click('Kiểm tra');

      expect(answers().length).toBe(1);
      expect(answers()[0].optionIds.length).toBe(1);
      expect(el.querySelector('.answer--correct')).not.toBeNull();
      expect(text()).toMatch(/Đúng rồi\.|Chưa đúng\./);
      expect(inputs().length).toBe(0);
      expect(button('Câu tiếp')).toBeDefined();
    });

    it('goes question by question to a summary of how many were right', async () => {
      for (let i = 0; i < 3; i++) {
        await pick(0);
        await click('Kiểm tra');
        await click(i < 2 ? 'Câu tiếp' : 'Xem kết quả');
      }
      expect(answers().length).toBe(3);
      expect(text()).toMatch(/Đúng \d\/3/);
      expect(button('Xem lại bài học')).toBeDefined();

      await click('Làm lại');
      expect(text()).toContain('Câu 1/3');
      expect(calls(checkpointEndpoints.checkpoint).length).toBeGreaterThan(1);
    });

    it('skips with one click and never holds "Tiếp theo" back', async () => {
      const advance = el.querySelector<HTMLButtonElement>('.lesson__advance')!;
      expect(advance.disabled).toBe(false);
      await click('Bỏ qua');
      expect(card()).toBeNull();
      expect(
        el.querySelector<HTMLButtonElement>('.lesson__advance')!.disabled,
      ).toBe(false);
      expect(answers().length).toBe(0);
    });

    it('reloads the questions with a short message when one changed', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === checkpointEndpoints.answerCheckpoint
          ? ({
              status: 200,
              body: {
                ...backendRefusal('internalError').body,
                messageCode: 'ASSESSMENT-CHECKPOINT_STALE',
                messageTitle: 'Câu hỏi đã thay đổi',
                message: 'Hãy tải lại các câu hỏi.',
              },
            } satisfies FakeReply)
          : real()(endpoint, request),
      );
      const before = calls(checkpointEndpoints.checkpoint).length;
      await pick(0);
      await click('Kiểm tra');

      expect(calls(checkpointEndpoints.checkpoint).length).toBe(before + 1);
      expect(text()).toContain('Câu hỏi vừa được cập nhật');
      expect(text()).toContain('Câu 1/3');
      expect(el.querySelector('.toast')).toBeNull();
    });

    it('is reopened from "Tự kiểm tra" after it was skipped', async () => {
      await click('Bỏ qua');
      const tab = Array.from(
        el.querySelectorAll<HTMLElement>('[role="tab"]'),
      ).find((t) => t.textContent?.includes('Tự kiểm tra'))!;
      tab.click();
      await settle();
      await click('Làm câu hỏi nhanh');
      expect(card()).not.toBeNull();
    });
  });

  describe('at the end of the lesson', () => {
    it('stays out of the way until the last block is done', async () => {
      await open(lastUrl());
      expect(card()).toBeNull();
      expect(calls(checkpointEndpoints.checkpoint).length).toBe(0);
    });

    it('appears above the navigation once the last block is done', async () => {
      await open(lastUrl());
      el.querySelector<HTMLButtonElement>(
        '.lesson__stepbar .btn--primary',
      )?.click();
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url).toBe(`/course/${COURSE}`),
      );
      await harness.navigateByUrl(lastUrl());
      await settle();
      el = harness.routeNativeElement as HTMLElement;

      expect(text()).toContain('Đã hoàn thành');
      expect(card()).not.toBeNull();
      expect(text()).toContain('Câu 1/3');
    });

    it('is not shown at all when the lesson has no published flashcard', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === checkpointEndpoints.checkpoint
          ? {
              status: 200,
              body: {
                ...backendRefusal('internalError').body,
                status: 'SUCCESS',
                messageCode: 'CORE-SUCCESS',
                data: { lessonId: 1, questions: [] },
              },
            }
          : real()(endpoint, request),
      );
      await open(lastUrl());
      el.querySelector<HTMLButtonElement>(
        '.lesson__stepbar .btn--primary',
      )?.click();
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url).toBe(`/course/${COURSE}`),
      );
      await harness.navigateByUrl(lastUrl());
      await settle();
      el = harness.routeNativeElement as HTMLElement;

      expect(calls(checkpointEndpoints.checkpoint).length).toBeGreaterThan(0);
      expect(card()).toBeNull();
    });

    it('says so when it was asked for and the lesson has no questions', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === checkpointEndpoints.checkpoint
          ? {
              status: 200,
              body: {
                ...backendRefusal('internalError').body,
                status: 'SUCCESS',
                messageCode: 'CORE-SUCCESS',
                data: { lessonId: 1, questions: [] },
              },
            }
          : real()(endpoint, request),
      );
      await open(lastUrl('?checkpoint=1'));
      expect(text()).toContain('Bài này chưa có câu hỏi nhanh');
    });

    it('offers a retry when asked for and the questions cannot be read', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === checkpointEndpoints.checkpoint
          ? backendRefusal('internalError')
          : real()(endpoint, request),
      );
      await open(lastUrl('?checkpoint=1'));
      expect(text()).toContain('Không tải được câu hỏi nhanh');

      handle.mockImplementation(real());
      await click('Thử lại');
      expect(text()).toContain('Câu 1/3');
    });
  });
});
