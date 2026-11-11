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
      el.querySelectorAll<HTMLAnchorElement>('.hub__hero .hub__title, .hub__row .hub__title'),
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
      el.querySelectorAll('.hub__hero a.btn, .hub__row a.btn').length,
    ).toBeGreaterThan(1);
    expect(el.querySelectorAll('.hub__row a.btn--primary').length).toBe(0);
  });

  it('shows the progress numbers above the quizzes', async () => {
    await open();
    const labels = Array.from(el.querySelectorAll('.hub__stat dt')).map((n) =>
      n.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Đã đạt',
      'Đang làm',
      'Điểm cao nhất trung bình',
      'Lượt thi còn lại',
    ]);
  });

  it('says there are no attempts yet before the learner has taken any', async () => {
    await open();
    expect(text()).toContain('Chưa có lần thi nào');
    expect(
      el.querySelector<HTMLButtonElement>('button[disabled]')?.textContent,
    ).toContain('Tải CSV');
  });

  it('groups the attempts by quiz, with the count and no best score of its own', async () => {
    signInAsLearner();
    await takeAttempt(1);
    await takeAttempt(1);
    await takeAttempt(2);
    await open();
    const groups = Array.from(el.querySelectorAll('.hub__group'));
    expect(groups.length).toBe(2);
    const quiz1 = groups.find((g) => g.textContent?.includes('Luyện tập'))!;
    expect(quiz1.querySelector('.hub__group-head')?.textContent).toContain(
      '2 lượt',
    );
    expect(quiz1.querySelector('.hub__group-head')?.textContent).not.toMatch(
      /cao nhất/i,
    );
    expect(quiz1.querySelectorAll('.hub__attempt').length).toBe(2);
    expect(quiz1.querySelector('table')?.textContent).toContain(
      'Thời gian nộp',
    );
    expect(quiz1.querySelectorAll('thead th[scope="col"]').length).toBe(5);
    expect(
      quiz1.querySelector('.hub__attempt a')?.getAttribute('href'),
    ).toMatch(/^\/quiz\/1\/result\/\d+$/);
  });

  it('shows the few latest attempts and links to the full history past that', async () => {
    signInAsLearner();
    for (let i = 0; i < 5; i++) await takeAttempt(1);
    await open();
    const group = el.querySelector('.hub__group')!;
    expect(group.querySelectorAll('.hub__attempt').length).toBe(3);
    expect(
      Array.from(group.querySelectorAll('a'))
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
