import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  AssessmentOverview,
  LearningProgressOverview,
} from '@lms/contracts';
import { ScoreFigures } from './score-figures';

const overview = (
  assessment: LearningProgressOverview['assessment'],
): LearningProgressOverview => ({
  serverTime: '2026-10-27T09:00:00',
  timeZone: 'Asia/Ho_Chi_Minh',
  counts: {
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    overdue: 0,
    assigned: 0,
    mandatory: 0,
  },
  activity: { availability: 'unavailable' },
  assessment,
  competency: { availability: 'unavailable' },
});

const LAST_FAILED: AssessmentOverview = {
  availability: 'available',
  last: {
    quizId: 1,
    quizTitle: 'Kiểm tra thực hành',
    courseId: 1,
    attemptId: 7,
    scorePercent: 66.67,
    passed: false,
    submittedAt: '2026-10-30T09:00:00',
  },
  bestScorePercent: 100,
  averageScorePercent: 42.26,
  passedQuizCount: 1,
  quizCount: 5,
};

@Component({
  imports: [ScoreFigures],
  template: `<app-score-figures [summary]="summary()" />`,
})
class Host {
  readonly summary = signal(overview(LAST_FAILED));
}

function render(assessment: LearningProgressOverview['assessment']) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.summary.set(overview(assessment));
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const norm = (el: Element | null | undefined) =>
    el?.textContent?.replace(/\s+/g, ' ').trim();
  return {
    root,
    figures: Array.from(root.querySelectorAll('a')).map((a) => ({
      href: a.getAttribute('href'),
      label: norm(a.querySelector('dt')),
      value: norm(a.querySelector('.score-figures__value')),
      detail: norm(a.querySelector('.score-figures__detail')),
    })),
  };
}

describe('ScoreFigures', () => {
  it('shows the last and the best score, each a link to the progress page', () => {
    expect(render(LAST_FAILED).figures).toEqual([
      {
        href: '/progress',
        label: 'Điểm kiểm tra gần nhất',
        value: '66,67%',
        detail: 'Chưa đạt · Kiểm tra thực hành',
      },
      {
        href: '/progress',
        label: 'Điểm cao nhất',
        value: '100%',
        detail: 'Đạt 1/5 bài kiểm tra',
      },
    ]);
  });

  it('colours "Chưa đạt" and nothing else', () => {
    const { root } = render(LAST_FAILED);
    expect(
      Array.from(root.querySelectorAll('.score-figures__fail')).map(
        (el) => el.textContent,
      ),
    ).toEqual(['Chưa đạt']);
  });

  it('says "Đạt" in plain text when the last attempt passed', () => {
    const { root, figures } = render({
      ...LAST_FAILED,
      last: { ...LAST_FAILED.last!, passed: true },
    });
    expect(figures[0].detail).toBe('Đạt · Kiểm tra thực hành');
    expect(root.querySelector('.score-figures__fail')).toBeNull();
  });

  it('shows dashes and "Chưa làm bài kiểm tra" while no attempt is graded', () => {
    expect(
      render({
        ...LAST_FAILED,
        last: null,
        bestScorePercent: null,
        averageScorePercent: null,
        passedQuizCount: 0,
        quizCount: 2,
      }).figures,
    ).toEqual([
      {
        href: '/progress',
        label: 'Điểm kiểm tra gần nhất',
        value: '—',
        detail: 'Chưa làm bài kiểm tra',
      },
      {
        href: '/progress',
        label: 'Điểm cao nhất',
        value: '—',
        detail: 'Đạt 0/2 bài kiểm tra',
      },
    ]);
  });

  it('renders neither figure while the assessment is unavailable', () => {
    const { root, figures } = render({ availability: 'unavailable' });
    expect(figures).toEqual([]);
    expect(root.querySelector('dt')).toBeNull();
  });
});
