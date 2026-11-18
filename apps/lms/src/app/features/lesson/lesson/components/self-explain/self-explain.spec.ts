import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  EnrollmentDetailSchema,
  learnerEndpoints,
  personalEndpoints,
  selfExplainEndpoints,
  type EnrollmentDetail,
} from '@lms/contracts';
import { backendRefusal, envelopeOk, type FakeReply } from '@lms/mocks';
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
const GOOD =
  'Bài này nói về cách mở tài khoản: kiểm tra giấy tờ, nhập thông tin khách hàng, rồi duyệt hai cấp.';

describe('SelfExplain on the lesson page', () => {
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
  ) =>
    real()(endpoint, {
      token,
      params,
      query: { size: '100' },
      body: undefined,
    });

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
  const lessonUrl = (index = 0) =>
    `/lesson/${COURSE}/${lessons()[index].lesson.id}`;

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
    Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'))
      .find((t) => t.textContent?.includes('Tự kiểm tra'))
      ?.click();
    await settle();
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const card = () => el.querySelector('app-self-explain');
  const area = () => card()!.querySelector<HTMLTextAreaElement>('textarea')!;
  const button = (label: string) =>
    Array.from(
      card()?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    ).find((node) => node.textContent?.trim().startsWith(label));
  const write = async (value: string) => {
    area().value = value;
    area().dispatchEvent(new Event('input'));
    await settle();
  };
  const click = async (label: string) => {
    button(label)!.click();
    await settle();
  };
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);

  const refuse = (messageCode: string): FakeReply => ({
    status: 200,
    body: {
      ...backendRefusal('internalError').body,
      messageCode,
      messageTitle: 'Chưa có nội dung bài học',
      message: 'Bài học này chưa có nội dung để đối chiếu.',
    },
  });

  describe('in "Tự kiểm tra"', () => {
    beforeEach(() => open(lessonUrl()));

    it('keeps "Gửi để nhận xét" disabled outside 50–1500 characters, with the count shown', async () => {
      expect(card()).not.toBeNull();
      expect(text()).toContain('0/1500');
      expect(button('Gửi để nhận xét')!.disabled).toBe(true);

      await write('quá ngắn');
      expect(text()).toContain('8/1500');
      expect(button('Gửi để nhận xét')!.disabled).toBe(true);

      await write('x'.repeat(1501));
      expect(button('Gửi để nhận xét')!.disabled).toBe(true);

      await write(`  ${GOOD}  `);
      expect(text()).toContain(`${GOOD.length}/1500`);
      expect(button('Gửi để nhận xét')!.disabled).toBe(false);
      expect(calls(selfExplainEndpoints.selfExplain).length).toBe(0);
    });

    it('streams the three sections with sources, then offers "Viết lại"', async () => {
      await write(GOOD);
      await click('Gửi để nhận xét');

      const sent = calls(selfExplainEndpoints.selfExplain);
      expect(sent.length).toBe(1);
      expect(sent[0][1].body).toEqual({ text: GOOD });
      expect(text()).toContain('Bạn đã nắm được');
      expect(text()).toContain('Còn thiếu');
      expect(text()).toContain('Cần xem lại (có thể hiểu chưa đúng)');
      expect(
        card()!.querySelectorAll('app-source-badge').length,
      ).toBeGreaterThan(0);

      await click('Viết lại');
      expect(area().value).toBe(GOOD);
      expect(button('Gửi để nhận xét')).toBeDefined();
    });

    it('shows the server message when the stream ends in an error', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === selfExplainEndpoints.selfExplain
          ? {
              status: 200,
              body: envelopeOk(null),
              events: [
                { type: 'conversation', conversationId: 1 },
                {
                  type: 'error',
                  messageCode: 'ASSISTANT-RATE_LIMITED',
                  message: 'Bạn đã hỏi nhiều, vui lòng thử lại sau ít phút.',
                },
              ],
            }
          : real()(endpoint, request),
      );
      await write(GOOD);
      await click('Gửi để nhận xét');

      expect(text()).toContain(
        'Bạn đã hỏi nhiều, vui lòng thử lại sau ít phút.',
      );
      expect(area().value).toBe(GOOD);
      expect(button('Gửi để nhận xét')!.disabled).toBe(false);
    });

    it('shows the AI-unavailable refusal that comes before the stream', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === selfExplainEndpoints.selfExplain
          ? {
              ...refuse('ASSISTANT-AI_UNAVAILABLE'),
              body: {
                ...refuse('ASSISTANT-AI_UNAVAILABLE').body,
                message:
                  'Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại sau.',
              },
            }
          : real()(endpoint, request),
      );
      await write(GOOD);
      await click('Gửi để nhận xét');

      expect(text()).toContain('Dịch vụ AI tạm thời không phản hồi');
    });

    it('disables the feature with a reason when the lesson has no text', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === selfExplainEndpoints.selfExplain
          ? refuse('ASSISTANT-LESSON_TEXT_UNAVAILABLE')
          : real()(endpoint, request),
      );
      await write(GOOD);
      await click('Gửi để nhận xét');

      expect(text()).toContain('chưa có nội dung để đối chiếu');
      expect(button('Gửi để nhận xét')).toBeUndefined();
    });

    it("saves only the learner's text as a note on the lesson, visible without reload", async () => {
      await write(GOOD);
      await click('Gửi để nhận xét');
      await click('Lưu vào ghi chú');

      const added = calls(personalEndpoints.addNote);
      expect(added.length).toBe(1);
      expect(added[0][1].body).toEqual({
        anchor: { type: 'none' },
        text: GOOD,
      });
      expect(JSON.stringify(added[0][1].body)).not.toContain('Bạn đã nắm được');

      Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'))
        .find((t) => t.textContent?.includes('Ghi chú'))
        ?.click();
      await settle();
      expect(el.querySelector('app-lesson-notes')!.textContent).toContain(GOOD);
    });
  });

  it('is offered from the lesson page, next to the quick questions', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(lessonUrl());
    await settle();
    el = harness.routeNativeElement as HTMLElement;
    const entry = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.lesson__explain-entry button'),
    )[0];
    expect(entry).toBeDefined();
    entry.click();
    await settle();
    expect(card()).not.toBeNull();
  });
});
