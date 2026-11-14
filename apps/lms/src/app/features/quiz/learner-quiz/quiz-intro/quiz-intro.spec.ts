import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  BlockReasonSchema,
  learnerQuizEndpoints,
  type BlockReason,
} from '@lms/contracts';
import type { MockInstance } from 'vitest';
import type { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  answerIntroWith,
  failEndpoint,
  provideLearnerQuizSpec,
  settle,
  signInAsLearner,
  startAttempt,
  takeAttempt,
} from '../learner-quiz.testing';

const SENTENCES: Record<BlockReason, string> = {
  NOT_OPEN: 'Bài kiểm tra mở lúc',
  CLOSED: 'Bài kiểm tra đã đóng',
  NOT_READY: 'Bài kiểm tra chưa sẵn sàng',
  LESSONS_REQUIRED: 'Hoàn thành các bài học nội dung',
  PASSED: 'Bạn đã đạt bài kiểm tra này',
  NO_ATTEMPTS: 'Bạn đã dùng hết lượt thi',
  WAIT: 'Bạn có thể thi lại sau',
};

describe('QuizIntro', () => {
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

  beforeEach(() => {
    harness = undefined;
    handle = provideLearnerQuizSpec();
  });

  async function open(url: string) {
    signInAsLearner();
    harness ??= await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const control = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('button, a')).find((node) =>
      node.textContent?.includes(label),
    );

  it('shows the rules, and the size, time and pass mark of the quiz in one line', async () => {
    await open('/quiz/2');
    expect(el.querySelector('h1')?.textContent).toContain('Thi cuối khóa');
    expect(text()).toContain('3 câu · 15 phút · Điểm đạt ≥ 70%');
    expect(text()).toContain('Quy chế bài kiểm tra');
    expect(text()).toContain('Xem đáp án khi đã đạt');
    expect(el.querySelector('ui-kpi')).toBeNull();
  });

  it('offers to start when the server says the learner can, with the results still empty', async () => {
    await open('/quiz/2');
    expect(control('Bắt đầu làm bài')).toBeTruthy();
    expect(text()).toContain('Chưa có lần thi nào');
    expect(
      el.querySelector('.intro__layout ui-empty.empty--inline'),
    ).not.toBeNull();
    expect(el.querySelectorAll('.btn--primary')).toHaveLength(1);
    expect(text()).toContain('Lượt thi thứ 1 · Còn 2 lượt');
  });

  it('shows the attempts left from the server when extra attempts were granted', async () => {
    answerIntroWith(handle, {
      summary: {
        maxAttempts: 2,
        extraAttempts: 3,
        attemptsUsed: 1,
        attemptsLeft: 4,
        bestScore: 50,
        lastScore: 50,
        finalScore: 50,
        passed: false,
        everPassed: false,
        runningAttemptId: null,
        lastSubmittedAt: null,
        nextAttemptAt: null,
      },
    });
    await open('/quiz/2');
    expect(text()).toContain('1 · Còn 4 lượt');
    expect(text()).toContain('Lượt thi thứ 2 · Còn 4 lượt');
    expect(text()).not.toMatch(/\d\/\d+ lượt|Lượt thi thứ \d\/\d/);
  });

  it('shows the results and the link to the history after an attempt', async () => {
    signInAsLearner();
    await takeAttempt(1);
    await open('/quiz/1');
    expect(text()).toContain('Số lần đã thi');
    expect(control('Xem lịch sử 1 lần thi')?.getAttribute('href')).toBe(
      '/quiz/1/attempts',
    );
  });

  it('offers to continue an attempt left running instead of starting a new one', async () => {
    signInAsLearner();
    await startAttempt(1);
    await open('/quiz/1');
    expect(control('Tiếp tục làm bài')).toBeTruthy();
    expect(control('Bắt đầu làm bài')).toBeUndefined();
    expect(text()).toContain('lượt thi đang làm dở');
  });

  it('shows the reason, not the start button, when the server blocks the quiz', async () => {
    await open('/quiz/3');
    expect(control('Bắt đầu làm bài')).toBeUndefined();
    expect(text()).toContain('Hoàn thành các bài học nội dung của khóa');
    expect(control('Về khóa học')?.getAttribute('href')).toBe('/course/2');
  });

  describe.each(BlockReasonSchema.options)('blockReason %s', (reason) => {
    it('is worded and hides the start button', async () => {
      answerIntroWith(handle, {
        canStart: false,
        blockReason: reason,
        availableAt: '2026-11-02T08:30:00',
      });
      await open('/quiz/2');
      expect(text()).toContain(SENTENCES[reason]);
      expect(control('Bắt đầu làm bài')).toBeUndefined();
    });
  });

  it('asks before using an attempt, then leaves for the take screen', async () => {
    await open('/quiz/2');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    control('Bắt đầu làm bài')!.click();
    await settle();
    expect(navigate).not.toHaveBeenCalled();
    Array.from(document.querySelectorAll<HTMLElement>('button'))
      .find((node) => node.textContent?.trim() === 'Bắt đầu')!
      .click();
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/quiz', 2, 'take']);
  });

  it('does not ask when continuing an attempt', async () => {
    signInAsLearner();
    await startAttempt(1);
    await open('/quiz/1');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    control('Tiếp tục làm bài')!.click();
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/quiz', 1, 'take']);
  });

  it('shows an error state when the intro cannot be loaded, and loads again on retry', async () => {
    failEndpoint(handle, learnerQuizEndpoints.quizIntro);
    await open('/quiz/2');
    expect(el.querySelector('ui-error-state')).toBeTruthy();
    handle.mockRestore();
    el.querySelector<HTMLElement>('ui-error-state button')!.click();
    await settle();
    expect(el.querySelector('ui-error-state')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Thi cuối khóa');
  });

  it('says the quiz is missing for a path without a number', async () => {
    await open('/quiz/abc');
    expect(text()).toContain('Không tìm thấy bài kiểm tra');
  });
});
