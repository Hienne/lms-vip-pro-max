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
  takeAttempt,
} from '../learner-quiz.testing';

describe('QuizHub', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

  beforeEach(() => {
    handle = provideLearnerQuizSpec();
  });

  async function open() {
    signInAsLearner();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/quiz');
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);

  it('lists the quizzes of the courses in progress, each linking to its intro', async () => {
    await open();
    expect(el.querySelector('h1')?.textContent).toBe('Bài kiểm tra');
    expect(calls(learnerQuizEndpoints.courseQuizzes).length).toBeGreaterThan(0);
    const links = Array.from(
      el.querySelectorAll<HTMLAnchorElement>(
        '.hub__hero .hub__title, .hub__tile .hub__title',
      ),
    ).map((a) => a.getAttribute('href'));
    expect(links).toContain('/quiz/1');
    expect(links).toContain('/quiz/2');
    const passMark = el.querySelector('.hub__facts div');
    expect(passMark?.querySelector('dt')?.textContent).toBe('Điểm đạt');
    expect(passMark?.querySelector('dd')?.textContent).toContain('≥ 70%');
  });

  it('emphasizes one available quiz while keeping every action on its intro', async () => {
    await open();
    const primary = el.querySelectorAll<HTMLAnchorElement>('.btn--primary');
    expect(primary.length).toBe(1);
    expect(primary[0].getAttribute('href')).toMatch(/^\/quiz\/\d+$/);
    expect(primary[0].closest('.hub__hero')).toBeTruthy();
    expect(
      el.querySelectorAll('.hub__hero a.btn, .hub__tile a.btn').length,
    ).toBeGreaterThan(1);
    expect(el.querySelectorAll('.hub__tile a.btn--primary').length).toBe(0);
  });

  it('says there are no attempts yet before the learner has taken any', async () => {
    await open();
    expect(text()).toContain('Chưa có lần thi nào');
    expect(
      el.querySelector<HTMLButtonElement>('button[disabled]')?.textContent,
    ).toContain('Tải CSV');
  });

  it('lists the attempts of every quiz in one table, with a link to each quiz history', async () => {
    signInAsLearner();
    await takeAttempt(1);
    await takeAttempt(1);
    await takeAttempt(2);
    await open();
    expect(el.querySelectorAll('.hub__history table').length).toBe(1);
    expect(el.querySelectorAll('.hub__attempt').length).toBe(3);
    expect(el.querySelector('table')?.textContent).toContain('Thời gian nộp');
    expect(el.querySelectorAll('thead th[scope="col"]').length).toBe(6);
    expect(
      el.querySelector('.hub__attempt a.btn')?.getAttribute('href'),
    ).toMatch(/^\/quiz\/\d+\/result\/\d+$/);
    const links = Array.from(el.querySelectorAll('.hub__history-links a')).map(
      (a) => a.getAttribute('href'),
    );
    expect(links).toEqual(
      expect.arrayContaining(['/quiz/1/attempts', '/quiz/2/attempts']),
    );
    expect(text()).toContain('Xem cả 2 lượt thi');
  });

  it('shows the newest attempts and links to the full history of a quiz', async () => {
    signInAsLearner();
    for (let i = 0; i < 5; i++) await takeAttempt(1);
    await open();
    expect(el.querySelectorAll('.hub__attempt').length).toBe(5);
    expect(
      Array.from(el.querySelectorAll('.hub__history-links a'))
        .find((a) => a.textContent?.includes('Xem cả 5 lượt thi'))
        ?.getAttribute('href'),
    ).toBe('/quiz/1/attempts');
  });

  it('downloads the CSV the server builds, named for the history', async () => {
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
    expect(calls(learnerQuizEndpoints.exportAttempts).length).toBe(1);
    expect(save).toHaveBeenCalledWith(expect.any(Blob), 'lich-su-thi.csv');
  });

  it('shows an error state when a list cannot be loaded', async () => {
    failEndpoint(handle, learnerQuizEndpoints.myAttempts);
    await open();
    expect(el.querySelector('ui-error-state')).toBeTruthy();
  });
});
