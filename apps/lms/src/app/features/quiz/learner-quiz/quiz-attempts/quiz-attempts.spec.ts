import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerQuizEndpoints } from '@lms/contracts';
import type { MockInstance } from 'vitest';
import type { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import { FileSaver } from '../../../../core/files/file-saver';
import {
  failEndpoint,
  provideLearnerQuizSpec,
  settle,
  signInAsLearner,
  startAttempt,
  takeAttempt,
} from '../learner-quiz.testing';

describe('QuizAttempts', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

  beforeEach(() => {
    handle = provideLearnerQuizSpec();
  });

  async function open(quizId = 1) {
    signInAsLearner();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/quiz/${quizId}/attempts`);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const rows = () => Array.from(el.querySelectorAll('tbody tr'));

  it('lists the attempts newest first, each linking to its result', async () => {
    signInAsLearner();
    await takeAttempt(1);
    await takeAttempt(1);
    await open();
    expect(el.querySelector('h1')?.textContent).toContain('Lịch sử thi');
    expect(rows().length).toBe(2);
    expect(rows()[0].textContent).toContain('#2');
    expect(rows()[1].textContent).toContain('#1');
    expect(rows()[0].querySelector('a')?.getAttribute('href')).toMatch(
      /^\/quiz\/1\/result\/\d+$/,
    );
  });

  it('states the server’s summary in a line, with no KPI cards', async () => {
    signInAsLearner();
    await takeAttempt(1);
    await open();
    expect(text()).toContain('Đã thi 1/20 lượt');
    expect(text()).toContain('Cao nhất');
    expect(el.querySelector('ui-kpi')).toBeNull();
  });

  it('shows one coloured badge per row, for the result', async () => {
    signInAsLearner();
    await takeAttempt(1);
    await open();
    expect(rows()[0].querySelectorAll('.badge').length).toBe(1);
  });

  it('sends a running attempt back to the take screen', async () => {
    signInAsLearner();
    await startAttempt(1);
    await open();
    expect(rows()[0].textContent).toContain('Đang làm');
    expect(rows()[0].querySelector('a')?.getAttribute('href')).toBe(
      '/quiz/1/take',
    );
  });

  it('shows an empty state for a quiz the learner has not tried', async () => {
    await open(2);
    expect(text()).toContain('Chưa có lần thi nào');
  });

  it('downloads the CSV of this quiz only', async () => {
    signInAsLearner();
    await takeAttempt(1);
    await open();
    const save = vi
      .spyOn(TestBed.inject(FileSaver), 'save')
      .mockImplementation(() => undefined);
    Array.from(el.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Tải CSV'))!
      .click();
    await settle();
    const [, request] = handle.mock.calls.find(
      ([e]) => e === learnerQuizEndpoints.exportAttempts,
    )!;
    expect(request.query).toMatchObject({ quizId: '1' });
    expect(save).toHaveBeenCalledWith(expect.any(Blob), 'lich-su-thi.csv');
  });

  it('pages the history ten attempts at a time', async () => {
    signInAsLearner();
    for (let i = 0; i < 12; i++) await takeAttempt(1);
    await open();
    expect(rows().length).toBe(10);
    el.querySelector<HTMLElement>(
      'ui-pagination [aria-label*="sau"], ui-pagination button:last-of-type',
    )?.click();
    await settle();
    expect(rows().length).toBe(2);
  });

  it('shows an error state with retry when the history cannot be loaded', async () => {
    failEndpoint(handle, learnerQuizEndpoints.quizHistory);
    await open();
    expect(el.querySelector('ui-error-state')).toBeTruthy();
  });
});
