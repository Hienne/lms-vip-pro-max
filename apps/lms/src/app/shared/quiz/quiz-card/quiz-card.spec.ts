import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { LearnerQuizCard } from '@lms/contracts';
import { QuizCard } from './quiz-card';

const card = (patch: Partial<LearnerQuizCard> = {}): LearnerQuizCard => ({
  quiz: {
    id: 2,
    title: 'Thi cuối khóa',
    description: null,
    quizType: 'FINAL_EXAM',
    status: 'PUBLISHED',
    questionCount: 6,
    timeLimitMinutes: 15,
    passPercent: 70,
    maxAttempts: 2,
    retakeWaitHours: 0,
    openAt: null,
    closeAt: null,
    scoreMethod: 'BEST',
    reviewPolicy: 'AFTER_PASS',
    shuffleQuestions: true,
    hasMultipleChoice: false,
  },
  summary: {
    maxAttempts: 2,
    extraAttempts: 0,
    attemptsUsed: 0,
    attemptsLeft: 2,
    bestScore: null,
    lastScore: null,
    finalScore: null,
    passed: false,
    everPassed: false,
    runningAttemptId: null,
    lastSubmittedAt: null,
    nextAttemptAt: null,
  },
  canStart: true,
  blockReason: null,
  availableAt: null,
  lessonId: 4,
  ...patch,
});

function render(value: LearnerQuizCard): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(QuizCard);
  fixture.componentRef.setInput('card', value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';

describe('QuizCard', () => {
  it('states what the quiz asks and how many attempts are left, with the way in', () => {
    const el = render(card());
    expect(text(el)).toContain('6 câu · 15 phút · Điểm đạt ≥ 70%');
    expect(text(el)).toContain('Còn 2/2 lượt');
    const start = el.querySelector<HTMLAnchorElement>('a.quiz-card__action')!;
    expect(start.textContent?.trim()).toBe('Làm bài');
    expect(start.getAttribute('href')).toBe('/quiz/2');
    expect(el.querySelector('h3 a')?.getAttribute('href')).toBe('/quiz/2');
  });

  it('continues a running attempt instead of starting one', () => {
    const base = card();
    const el = render(
      card({ summary: { ...base.summary, runningAttemptId: 9 } }),
    );
    expect(el.querySelector('a.quiz-card__action')?.textContent?.trim()).toBe(
      'Tiếp tục làm bài',
    );
  });

  it('shows the best score once there is one', () => {
    const base = card();
    const el = render(
      card({ summary: { ...base.summary, bestScore: 83.3, attemptsLeft: 1 } }),
    );
    expect(text(el)).toContain('Còn 1/2 lượt · Cao nhất 83,3%');
  });

  it('says the quiz is passed with one badge, not the attempts left', () => {
    const base = card();
    const el = render(
      card({
        summary: { ...base.summary, passed: true, bestScore: 100 },
        canStart: false,
        blockReason: 'PASSED',
      }),
    );
    expect(el.querySelectorAll('[uiBadge]').length).toBe(1);
    expect(text(el)).toContain('Đã đạt');
    expect(text(el)).not.toContain('lượt');
  });

  it('words the server block reason and offers the information page instead', () => {
    const el = render(
      card({ canStart: false, blockReason: 'LESSONS_REQUIRED' }),
    );
    expect(text(el)).toContain('Hoàn thành các bài học nội dung của khóa');
    const link = el.querySelector<HTMLAnchorElement>('a.quiz-card__action')!;
    expect(link.textContent?.trim()).toBe('Xem thông tin');
    expect(link.getAttribute('href')).toBe('/quiz/2');
  });
});
