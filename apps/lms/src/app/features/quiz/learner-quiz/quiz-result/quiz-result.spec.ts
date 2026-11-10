import { RouterTestingHarness } from '@angular/router/testing';
import {
  learnerQuizEndpoints,
  type LearnerAttemptResult,
} from '@lms/contracts';
import type { MockInstance } from 'vitest';
import { fakeSession } from '../../../../core/session/session.testing';
import type { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  answerIntroWith,
  failEndpoint,
  patchReply,
  provideLearnerQuizSpec,
  settle,
  signInAsLearner,
  takeAttempt,
  writableSignalsOf,
} from '../learner-quiz.testing';

describe('QuizResult', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

  beforeEach(() => {
    handle = provideLearnerQuizSpec();
  });

  async function open(url: string) {
    signInAsLearner();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const control = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('button, a')).find((node) =>
      node.textContent?.includes(label),
    );

  async function openResult(quizId: number) {
    signInAsLearner();
    const attemptId = await takeAttempt(quizId);
    await open(`/quiz/${quizId}/result/${attemptId}`);
  }

  it('shows the score the server graded, the pass mark and the verdict once', async () => {
    await openResult(1);
    expect(el.querySelector('h1')?.textContent).toMatch(/Bạn đã đạt|Chưa đạt/);
    expect(text()).toContain('câu đúng · điểm đạt 70%');
    expect(el.querySelectorAll('[uiBadge]').length).toBeLessThanOrEqual(1);
    expect(el.querySelector('[class*="border-top"]')).toBeNull();
  });

  it('offers a retake as the one primary action after a failed attempt', async () => {
    await openResult(1);
    const primary = el.querySelectorAll('.btn--primary');
    expect(primary).toHaveLength(1);
    expect(primary[0].textContent).toContain('Thi lại');
    expect(primary[0].getAttribute('href')).toBe('/quiz/1');
    expect(control('Về khóa học')?.getAttribute('href')).toBe('/course/1');
    expect(control('Lịch sử thi')?.getAttribute('href')).toBe(
      '/quiz/1/attempts',
    );
  });

  async function openResultWith(
    quizId: number,
    patch: (result: LearnerAttemptResult) => object,
  ) {
    signInAsLearner();
    const attemptId = await takeAttempt(quizId);
    patchReply(handle, learnerQuizEndpoints.attemptResult, patch);
    await open(`/quiz/${quizId}/result/${attemptId}`);
    return attemptId;
  }

  it('breaks the score down by competency', async () => {
    await openResult(1);
    expect(text()).toContain('Phân tích theo nhóm kiến thức');
    expect(el.querySelectorAll('.result__competency').length).toBeGreaterThan(
      0,
    );
  });

  it('keeps the review collapsed until the learner opens it', async () => {
    await openResult(1);
    expect(el.querySelector('.result__review')).toBeNull();
    expect(text()).toContain('Nhấn “Xem lại”');
    control('Xem lại')!.click();
    await settle();
    expect(el.querySelectorAll('.result__question').length).toBeGreaterThan(0);
    expect(text()).toContain('Giải thích');
    control('Thu gọn')!.click();
    await settle();
    expect(el.querySelector('.result__review')).toBeNull();
  });

  it('explains a reviewed question with the lesson as its source, for a user with the assistant', async () => {
    await openResult(1);
    fakeSession().user.update((user) =>
      user ? { ...user, menus: [...user.menus, 'AI_ASSISTANT'] } : user,
    );
    control('Xem lại')!.click();
    await settle();
    expect(control('Giải thích')).toBeDefined();
    control('Giải thích')!.click();
    await settle();
    expect(text()).toContain('Trợ lý giải thích');
    expect(el.querySelector('.result__ai a')?.getAttribute('href')).toMatch(
      /^\/lesson\/\d+\/\d+$/,
    );
  });

  it('does not offer to explain a question to a user without the assistant', async () => {
    await openResult(1);
    fakeSession().user.update((user) =>
      user
        ? { ...user, menus: user.menus.filter((m) => m !== 'AI_ASSISTANT') }
        : user,
    );
    control('Xem lại')!.click();
    await settle();
    expect(el.querySelectorAll('.result__question').length).toBeGreaterThan(0);
    expect(control('Giải thích')).toBeUndefined();
  });

  it('offers a retake after a failed attempt while attempts are left', async () => {
    await openResult(1);
    expect(el.querySelector('h1')?.textContent).toContain('Chưa đạt');
    expect(control('Thi lại')?.getAttribute('href')).toBe('/quiz/1');
    expect(text()).toContain('Còn 19 lượt');
    expect(text()).not.toMatch(/Lần thi \d+\/\d+/);
  });

  it('says the quiz is passed when a failed attempt is opened after a pass in another one', async () => {
    const attemptId = await openResultWith(1, (result) => ({
      summary: { ...result.summary, passed: true, attemptsLeft: 0 },
    }));
    expect(attemptId).toBeGreaterThan(0);
    expect(el.querySelector('h1')?.textContent).toContain('Chưa đạt');
    expect(text()).toContain('đã đạt bài kiểm tra này ở một lượt thi khác');
    expect(text()).not.toContain('hết lượt');
    expect(text()).not.toContain('Giảng viên sẽ xem xét');
    expect(control('Thi lại')).toBeUndefined();
  });

  it('counts attempts left from the server when extra attempts were granted', async () => {
    await openResultWith(1, (result) => ({
      summary: {
        ...result.summary,
        maxAttempts: 2,
        extraAttempts: 3,
        attemptsLeft: 4,
      },
    }));
    expect(text()).toContain('Còn 4 lượt');
    expect(text()).not.toMatch(/Lần thi \d+\/\d+/);
  });

  it('draws every competency bar in one tone, whatever the pass mark', async () => {
    await openResult(1);
    const bars = Array.from(
      el.querySelectorAll('.result__competency .progress'),
    );
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars)
      expect(bar.className).not.toMatch(/progress--(success|warning|danger)/);
  });

  it.each([
    { canStart: false, blockReason: 'PASSED', showsRetake: false },
    { canStart: true, blockReason: null, showsRetake: true },
    { canStart: false, blockReason: 'WAIT', showsRetake: true },
  ] as const)(
    'follows quiz eligibility after passing ($blockReason)',
    async ({ canStart, blockReason, showsRetake }) => {
      answerIntroWith(handle, { canStart, blockReason });
      await openResult(2);
      expect(el.querySelector('h1')?.textContent).toContain('Bạn đã đạt');
      expect(control('Thi lại')?.getAttribute('href')).toBe(
        showsRetake ? '/quiz/2' : undefined,
      );
    },
  );

  it('exposes no writable signal: every write goes through the store', async () => {
    await openResult(1);
    expect(writableSignalsOf(harness)).toEqual([]);
  });

  it('shows an error state when the result cannot be loaded', async () => {
    failEndpoint(handle, learnerQuizEndpoints.attemptResult);
    await open('/quiz/1/result/1');
    expect(el.querySelector('ui-error-state')).toBeTruthy();
  });

  it('says the result is missing for a path without a number', async () => {
    await open('/quiz/1/result/abc');
    expect(text()).toContain('Không tìm thấy kết quả');
  });
});
