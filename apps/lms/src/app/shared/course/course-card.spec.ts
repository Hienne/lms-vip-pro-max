import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CourseCard, type CourseCardView } from './course-card';
import { NOW } from './now';

const TODAY = Date.UTC(2026, 6, 10, 12);
const inDays = (days: number) =>
  new Date(TODAY + days * 86_400_000).toISOString();

const IN_PROGRESS: CourseCardView = {
  id: 'x1',
  title: 'Tổng quan hệ thống Core Banking',
  required: true,
  domain: 'Nghiệp vụ',
  module: 'Tổng quan',
  minutes: 68,
  lessons: 4,
  level: 'Cơ bản',
  pct: 62,
  status: 'in_progress',
  statusLabel: 'Đang học',
  dueAt: inDays(9),
  bestScore: 60,
  link: '/design-system',
};

@Component({
  imports: [CourseCard],
  template: `<app-course-card [course]="course()" />`,
})
class Host {
  readonly course = signal<CourseCardView>(IN_PROGRESS);
}

function render(change: Partial<CourseCardView> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: NOW, useValue: () => TODAY }],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.course.set({ ...IN_PROGRESS, ...change });
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { root, card: root.querySelector('.course-card') as HTMLElement };
}

const text = (el: Element | null) =>
  el?.textContent?.replace(/\s+/g, ' ').trim();

describe('CourseCard', () => {
  it('is one link to the course, with no other link or button inside', () => {
    const { root, card } = render();
    expect(root.querySelectorAll('a')).toHaveLength(1);
    expect(card.tagName).toBe('A');
    expect(card.getAttribute('href')).toBe('/design-system');
    expect(card.querySelectorAll('a, button')).toHaveLength(0);
  });

  it('shows the category, title and the meta line as text', () => {
    const { card } = render();
    expect(text(card.querySelector('.course-card__category'))).toBe(
      'Nghiệp vụ · Tổng quan',
    );
    expect(text(card.querySelector('.course-card__title'))).toBe(
      'Tổng quan hệ thống Core Banking',
    );
    expect(
      Array.from(card.querySelectorAll('.course-card__meta span')).map(text),
    ).toEqual(['Bắt buộc', '1g 8p', '4 bài', 'Cơ bản']);
  });

  it('has no cover art and no icon', () => {
    const { card } = render();
    expect(card.querySelector('[class*="course-card__cover"]')).toBeNull();
    expect(card.querySelector('ui-icon')).toBeNull();
  });

  it('says "Bắt buộc" as text, not a badge, and nothing for an optional course', () => {
    const { card } = render();
    expect(text(card.querySelector('.course-card__required'))).toBe('Bắt buộc');
    expect(
      Array.from(card.querySelectorAll('.badge')).map((b) => text(b)),
    ).not.toContain('Bắt buộc');
    expect(
      render({ required: false }).card.querySelector('.course-card__required'),
    ).toBeNull();
  });

  it('shows no status badge while in progress and on time', () => {
    expect(render().card.querySelectorAll('.badge')).toHaveLength(0);
  });

  it('shows one "Hoàn thành" badge instead of an overdue one when completed', () => {
    const { card } = render({
      status: 'completed',
      overdue: true,
      pct: 100,
      statusLabel: 'Đã hoàn thành',
    });
    const badges = Array.from(
      card.querySelectorAll('.course-card__head .badge'),
    ).map((b) => text(b));
    expect(badges).toEqual(['Hoàn thành']);
  });

  it('shows one "Quá hạn" badge when overdue and not completed', () => {
    const { card } = render({ overdue: true, dueAt: inDays(-2) });
    const badges = Array.from(
      card.querySelectorAll('.course-card__head .badge'),
    ).map((b) => text(b));
    expect(badges).toEqual(['Quá hạn']);
  });

  it('shows one "Chưa đạt" badge when the final exam was failed, before an overdue one', () => {
    const failed = render({ failed: true, dueAt: inDays(5) });
    expect(
      Array.from(failed.card.querySelectorAll('.badge')).map((b) => text(b)),
    ).toEqual(['Chưa đạt']);
    const both = render({ failed: true, overdue: true, dueAt: inDays(-2) });
    expect(
      Array.from(both.card.querySelectorAll('.badge')).map((b) => text(b)),
    ).toEqual(['Chưa đạt']);
  });

  it('shows no "Chưa đạt" badge on a completed course', () => {
    const { card } = render({
      failed: true,
      status: 'completed',
      pct: 100,
      statusLabel: 'Đã hoàn thành',
    });
    expect(
      Array.from(card.querySelectorAll('.badge')).map((b) => text(b)),
    ).toEqual(['Hoàn thành']);
  });

  it('draws progress named after the course, toned by status', () => {
    expect(
      render().card.querySelector('ui-progress')?.getAttribute('aria-valuenow'),
    ).toBe('62');
    expect(
      render().card.querySelector('ui-progress')?.getAttribute('aria-label'),
    ).toBe('Tiến độ Tổng quan hệ thống Core Banking');
    expect(render().card.querySelector('ui-progress')?.className).not.toMatch(
      /progress--(success|danger|warning|reward)/,
    );
    expect(
      render({ status: 'completed' }).card.querySelector(
        'ui-progress.progress--success',
      ),
    ).not.toBeNull();
    expect(
      render({ status: 'failed' }).card.querySelector(
        'ui-progress.progress--danger',
      ),
    ).not.toBeNull();
  });

  it('shows the status line with the best score, and the percentage', () => {
    const { card } = render();
    expect(text(card.querySelector('.course-card__status'))).toBe(
      'Đang học · Điểm cao nhất 60%',
    );
    expect(text(card.querySelector('.course-card__pct'))).toBe('62%');
  });

  it('colours the status line danger on failure and omits a missing best score', () => {
    const { card } = render({
      status: 'failed',
      statusLabel: 'Chưa đạt',
      bestScore: null,
    });
    const line = card.querySelector('.course-card__status') as HTMLElement;
    expect(text(line)).toBe('Chưa đạt');
    expect(line.classList.contains('course-card__status--failed')).toBe(true);
  });

  it('shows the due date, or nothing without one', () => {
    expect(text(render().card.querySelector('app-due-date'))).toBe(
      'Còn 9 ngày · 19/07/2026',
    );
    expect(
      render({ dueAt: null }).card.querySelector('app-due-date'),
    ).toBeNull();
  });
  it('does not invent duration or level when the dashboard contract omits them', () => {
    const { card } = render({
      required: false,
      minutes: undefined,
      level: undefined,
    });
    expect(
      Array.from(card.querySelectorAll('.course-card__meta span')).map(text),
    ).toEqual(['4 bài']);
  });
});
