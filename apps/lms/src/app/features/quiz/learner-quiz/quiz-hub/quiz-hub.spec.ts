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

  async function open(url = '/quiz') {
    signInAsLearner();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);

  const navItems = () =>
    Array.from(el.querySelectorAll<HTMLAnchorElement>('.hub__nav-item'));
  const detailTitle = () =>
    el.querySelector<HTMLAnchorElement>('.hub__detail-title a');

  it('lists every quiz on the left and opens the first one on the right', async () => {
    await open();
    expect(el.querySelector('h1')?.textContent).toBe('Bài kiểm tra');
    expect(calls(learnerQuizEndpoints.courseQuizzes).length).toBeGreaterThan(0);
    const items = navItems();
    expect(items.length).toBeGreaterThan(1);
    expect(items[0].getAttribute('aria-current')).toBe('true');
    expect(items[0].getAttribute('href')).toMatch(/^\/quiz\?bai=\d+$/);
    expect(detailTitle()?.getAttribute('href')).toMatch(/^\/quiz\/\d+$/);
    const labels = Array.from(el.querySelectorAll('.stat__label')).map((n) =>
      n.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Điểm đạt',
      'Cao nhất',
      'Lượt đã làm',
      'Lượt còn lại',
    ]);
    expect(el.querySelector('.hub__stats')?.textContent).toContain('≥ 70');
  });

  it('puts the one primary action on the selected quiz, on its intro', async () => {
    await open();
    const primary = el.querySelectorAll<HTMLAnchorElement>('.btn--primary');
    expect(primary.length).toBe(1);
    expect(primary[0].closest('.hub__detail')).toBeTruthy();
    expect(primary[0].getAttribute('href')).toBe(
      detailTitle()?.getAttribute('href'),
    );
  });

  it('says the selected quiz has no attempts before the learner has taken any', async () => {
    await open();
    expect(text()).toContain('Bạn chưa làm bài này lần nào');
    expect(
      el.querySelector<HTMLButtonElement>('button[disabled]')?.textContent,
    ).toContain('Tải CSV');
  });

  it('shows only the attempts of the quiz picked in the URL', async () => {
    signInAsLearner();
    await takeAttempt(1);
    await takeAttempt(1);
    await takeAttempt(2);
    await open('/quiz?bai=1');
    expect(detailTitle()?.getAttribute('href')).toBe('/quiz/1');
    expect(el.querySelectorAll('.hub__attempt').length).toBe(2);
    expect(el.querySelectorAll('thead th[scope="col"]').length).toBe(5);
    const detail = el.querySelector<HTMLAnchorElement>(
      '.hub__attempt a[aria-label^="Chi tiết lượt"]',
    );
    expect(detail?.getAttribute('href')).toMatch(/^\/quiz\/1\/result\/\d+$/);
    const quiz1 = navItems().find((a) => a.href.endsWith('bai=1'))!;
    expect(quiz1.getAttribute('aria-current')).toBe('true');
    expect(quiz1.textContent).toContain('2 lượt đã làm');
    expect(
      navItems().find((a) => a.href.endsWith('bai=2'))?.textContent,
    ).toContain('1 lượt đã làm');
  });

  it('keeps the filter in the URL and says when it leaves no quiz', async () => {
    await open('/quiz?loc=passed');
    expect(navItems().length).toBe(0);
    expect(text()).toContain('Không có bài nào trong mục này');
    expect(el.querySelector('.hub__detail')).toBeNull();
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
