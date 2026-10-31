import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerQuizEndpoints, type AttemptSession } from '@lms/contracts';
import type { MockInstance } from 'vitest';
import type { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  failEndpoint,
  patchReply,
  provideLearnerQuizSpec,
  restoreReplies,
  settle,
  signInAsLearner,
  writableSignalsOf,
} from '../learner-quiz.testing';

describe('QuizTake', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

  beforeEach(() => {
    handle = provideLearnerQuizSpec();
  });

  async function open(url = '/quiz/2/take') {
    signInAsLearner();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);
  const control = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('button, a')).find((node) =>
      node.textContent?.includes(label),
    );
  const choose = async (index: number) => {
    el.querySelectorAll<HTMLInputElement>('fieldset input')[index].click();
    await settle();
  };
  const timer = () => el.querySelector('.timer__time')?.textContent?.trim();

  it('starts the attempt on the server and shows the first question', async () => {
    await open();
    expect(calls(learnerQuizEndpoints.startAttempt)).toHaveLength(1);
    expect(text()).toContain('Câu 1 / 3');
    expect(text()).toContain('Mã CIF dùng để làm gì?');
    expect(el.querySelectorAll('fieldset input')).toHaveLength(4);
  });

  it('exposes no writable signal: every write goes through the store', async () => {
    await open();
    expect(writableSignalsOf(harness)).toEqual([]);
  });

  it('shows the question code after the position when the question has one', async () => {
    await open();
    expect(el.querySelector('.take__code')?.textContent).toMatch(/^Q\d+$/);
    expect(text()).toMatch(/Câu 1 \/ 3 · Q\d+/);
  });

  it('shows no code, and no separator, when the question has none', async () => {
    patchReply(
      handle,
      learnerQuizEndpoints.startAttempt,
      (s: AttemptSession) => ({
        questions: s.questions.map((q) => ({ ...q, code: null })),
      }),
    );
    await open();
    expect(el.querySelector('.take__code')).toBeNull();
    expect(text()).toContain('Câu 1 / 3');
    expect(text()).not.toContain('Câu 1 / 3 ·');
  });

  it('has one primary button, "Nộp bài" in the top bar, and no label above the title', async () => {
    await open();
    const primary = el.querySelectorAll('.btn--primary');
    expect(primary).toHaveLength(1);
    expect(primary[0].textContent?.trim()).toBe('Nộp bài');
    expect(primary[0].closest('.take__bar')).not.toBeNull();
    expect(el.querySelector('.take__title small')).toBeNull();
    const hints = [text()];
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight' }),
      );
      await settle();
      hints.push(text());
    }
    expect(hints.join(' ')).toContain('Chọn tất cả đáp án đúng');
    expect(hints.join(' ')).not.toContain('TẤT CẢ');
  });

  it('saves a choice with a patch as soon as it is made, and marks the question answered', async () => {
    await open();
    await choose(0);
    const [, request] = calls(learnerQuizEndpoints.saveAnswer)[0];
    expect(request.body).toMatchObject({ selectedOptionIds: [11] });
    expect(
      el.querySelector('app-question-grid button')?.getAttribute('aria-label'),
    ).toContain('đã trả lời');
    expect(text()).toContain('1/3 đã trả lời');
  });

  it('keeps a failed save on screen with "Thử lại", and sends it again on retry', async () => {
    await open();
    failEndpoint(handle, learnerQuizEndpoints.saveAnswer);
    await choose(1);
    expect(el.querySelector('ui-alert')?.textContent).toContain(
      'Chưa lưu được đáp án',
    );
    expect(
      el.querySelectorAll<HTMLInputElement>('fieldset input')[1].checked,
    ).toBe(true);
    restoreReplies(handle);
    control('Thử lại')!.click();
    await settle();
    expect(el.querySelector('ui-alert')).toBeNull();
    const saves = calls(learnerQuizEndpoints.saveAnswer);
    expect(saves[saves.length - 1][1].body).toMatchObject({
      selectedOptionIds: [12],
    });
  });

  it('sends the review flag too', async () => {
    await open();
    control('Đánh dấu xem lại')!.click();
    await settle();
    expect(calls(learnerQuizEndpoints.saveAnswer)[0][1].body).toMatchObject({
      flagged: true,
    });
    expect(control('Bỏ đánh dấu')).toBeTruthy();
  });

  it('restores the attempt after a reload: same attempt, saved choice still selected', async () => {
    await open();
    await choose(0);
    await harness.navigateByUrl('/quiz/2');
    await settle();
    await harness.navigateByUrl('/quiz/2/take');
    await settle();
    el = harness.routeNativeElement as HTMLElement;
    expect(
      el.querySelectorAll<HTMLInputElement>('fieldset input')[0].checked,
    ).toBe(true);
  });

  it('asks before submitting, then goes to the result of the attempt', async () => {
    await open();
    await choose(0);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    control('Nộp bài')!.click();
    await settle();
    expect(calls(learnerQuizEndpoints.submitAttempt)).toHaveLength(0);
    expect(document.body.textContent).toContain('Còn 2 câu chưa trả lời');
    Array.from(document.querySelectorAll<HTMLElement>('button'))
      .find(
        (b) => b.textContent?.trim() === 'Nộp bài' && b.closest('.dialog-pane'),
      )!
      .click();
    await settle();
    expect(calls(learnerQuizEndpoints.submitAttempt)).toHaveLength(1);
    expect(navigate).toHaveBeenCalledWith([
      '/quiz',
      2,
      'result',
      expect.any(Number),
    ]);
  });

  it('stays on the quiz and shows the server’s error when the submit fails', async () => {
    await open();
    failEndpoint(handle, learnerQuizEndpoints.submitAttempt);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    control('Nộp bài')!.click();
    await settle();
    Array.from(document.querySelectorAll<HTMLElement>('button'))
      .find(
        (b) => b.textContent?.trim() === 'Nộp bài' && b.closest('.dialog-pane'),
      )!
      .click();
    await settle();
    expect(navigate).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Lỗi hệ thống');
    expect((control('Nộp bài') as HTMLButtonElement).disabled).toBe(false);
  });

  it('counts down to the server deadline on the server clock, whatever the device clock says', async () => {
    const serverNow = Date.now() + 3_600_000; // the device clock is an hour behind the server
    const iso = (ms: number) => new Date(ms).toISOString();
    patchReply(handle, learnerQuizEndpoints.startAttempt, () => ({
      serverTime: iso(serverNow),
      deadlineAt: iso(serverNow + 600_000),
    }));
    await open();
    expect(['10:00', '09:59']).toContain(timer());
  });

  it('submits by itself when the server says the time is up', async () => {
    patchReply(
      handle,
      learnerQuizEndpoints.startAttempt,
      (s: AttemptSession) => ({
        expired: true,
        deadlineAt: s.startedAt,
      }),
    );
    await open();
    expect(calls(learnerQuizEndpoints.submitAttempt)).toHaveLength(1);
  });

  it('chooses an option and moves between questions with the keyboard', async () => {
    await open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    await settle();
    expect(calls(learnerQuizEndpoints.saveAnswer)[0][1].body).toMatchObject({
      selectedOptionIds: [12],
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await settle();
    expect(text()).toContain('Câu 2 / 3');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await settle();
    expect(text()).toContain('Câu 1 / 3');
  });

  it('asks before the learner walks away from a running attempt, but not once it is submitted', async () => {
    await open();
    const page = harness.routeDebugElement!.componentInstance as {
      hasUnsavedChanges(): boolean;
    };
    expect(page.hasUnsavedChanges()).toBe(true);
    control('Nộp bài')!.click();
    await settle();
    Array.from(document.querySelectorAll<HTMLElement>('button'))
      .find(
        (b) => b.textContent?.trim() === 'Nộp bài' && b.closest('.dialog-pane'),
      )!
      .click();
    await settle();
    expect(page.hasUnsavedChanges()).toBe(false);
  });

  it('explains why a quiz that cannot start does not open', async () => {
    await open('/quiz/3/take');
    expect(text()).toContain('Chưa thể làm bài kiểm tra này');
    expect(control('Về thông tin bài kiểm tra')?.getAttribute('href')).toBe(
      '/quiz/3',
    );
  });
});
