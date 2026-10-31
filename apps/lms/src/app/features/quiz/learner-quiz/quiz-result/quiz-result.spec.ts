import { RouterTestingHarness } from '@angular/router/testing';
import { learnerQuizEndpoints } from '@lms/contracts';
import type { MockInstance } from 'vitest';
import type { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  failEndpoint,
  provideLearnerQuizSpec,
  settle,
  signInAsLearner,
  takeAttempt,
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

  it('makes "Về khóa học" the one primary action, linking to the course', async () => {
    await openResult(1);
    const primary = el.querySelectorAll('.btn--primary');
    expect(primary).toHaveLength(1);
    expect(primary[0].textContent).toContain('Về khóa học');
    expect(primary[0].getAttribute('href')).toBe('/course/1');
    expect(control('Lịch sử thi')?.getAttribute('href')).toBe(
      '/quiz/1/attempts',
    );
  });

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

  it('offers a retake after a failed attempt while attempts are left', async () => {
    await openResult(1);
    expect(el.querySelector('h1')?.textContent).toContain('Chưa đạt');
    expect(control('Thi lại')?.getAttribute('href')).toBe('/quiz/1');
    expect(text()).toContain('Bạn còn');
  });

  it('offers no retake once the quiz is passed', async () => {
    await openResult(2);
    expect(el.querySelector('h1')?.textContent).toContain('Bạn đã đạt');
    expect(control('Thi lại')).toBeUndefined();
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
