import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { HeatmapDay } from '@lms/contracts';
import { ActivityHeatmap, dayLabel, levelOf } from './activity-heatmap';

/** Mon 2026-10-12 to Sun 2026-10-18 and Mon 19 to Tue 20: the last week is partial, as on the real page. */
const DAYS: HeatmapDay[] = [
  { date: '2026-10-12', lessons: 3, quizzes: 1, restDay: false },
  { date: '2026-10-13', lessons: 0, quizzes: 0, restDay: false },
  { date: '2026-10-14', lessons: 1, quizzes: 0, restDay: false },
  { date: '2026-10-15', lessons: 2, quizzes: 0, restDay: false },
  { date: '2026-10-16', lessons: 6, quizzes: 0, restDay: false },
  { date: '2026-10-17', lessons: 1, quizzes: 0, restDay: true },
  { date: '2026-10-18', lessons: 0, quizzes: 0, restDay: true },
  { date: '2026-10-19', lessons: 0, quizzes: 2, restDay: false },
  { date: '2026-10-20', lessons: 0, quizzes: 0, restDay: false },
];

@Component({
  imports: [ActivityHeatmap],
  template: `<app-activity-heatmap [days]="days()" />`,
})
class Host {
  readonly days = signal(DAYS);
}

describe('ActivityHeatmap', () => {
  function render(days: HeatmapDay[] = DAYS) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.days.set(days);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const cells = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLElement>('.activity-heatmap__cell'));
  const cell = (root: HTMLElement, label: string) =>
    cells(root).find((c) => c.getAttribute('aria-label')?.startsWith(label));

  it('maps the server counts to four shades and leaves no activity empty', () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(levelOf)).toEqual([0, 1, 2, 3, 3, 4, 4]);
    const root = render();
    expect(cell(root, '12/10')?.dataset['level']).toBe('3');
    expect(cell(root, '13/10')?.dataset['level']).toBe('0');
    expect(cell(root, '16/10')?.dataset['level']).toBe('4');
    expect(cell(root, '19/10')?.dataset['level']).toBe('2');
  });

  it('gives every day a text equivalent from the server counts', () => {
    const root = render();
    expect(cells(root)).toHaveLength(DAYS.length);
    expect(cell(root, '12/10')?.getAttribute('aria-label')).toBe(
      '12/10: 3 bài học, 1 bài kiểm tra',
    );
    expect(cell(root, '13/10')?.getAttribute('aria-label')).toBe(
      '13/10: chưa có hoạt động',
    );
    expect(cell(root, '18/10')?.getAttribute('aria-label')).toBe(
      '18/10: ngày nghỉ',
    );
    expect(dayLabel(DAYS[5])).toBe('17/10: 1 bài học (ngày nghỉ)');
  });

  it('hatches rest days, also the one the learner studied on', () => {
    const root = render();
    const rest = cells(root).filter((c) =>
      c.classList.contains('activity-heatmap__cell--rest'),
    );
    expect(rest.map((c) => c.getAttribute('aria-label')?.slice(0, 5))).toEqual([
      '17/10',
      '18/10',
    ]);
    expect(cell(root, '17/10')?.dataset['level']).toBe('1');
  });

  it('lays a week per column: seven rows, Monday first', () => {
    const root = render();
    const rows = Array.from(
      root.querySelectorAll<HTMLElement>('.activity-heatmap__row'),
    );
    expect(rows).toHaveLength(7);
    expect(
      rows[0]
        .querySelectorAll('.activity-heatmap__cell')
        .item(0)
        .getAttribute('aria-label'),
    ).toContain('12/10');
    expect(rows[0].querySelectorAll('.activity-heatmap__cell')).toHaveLength(2);
    expect(rows[6].querySelectorAll('.activity-heatmap__cell')).toHaveLength(1);
  });

  it('is one grid with a single tab stop that opens the day label as a tooltip on focus', async () => {
    vi.useFakeTimers();
    try {
      const root = render();
      expect(root.querySelectorAll('[role="grid"]')).toHaveLength(1);
      const stops = cells(root).filter((c) => c.tabIndex === 0);
      expect(stops).toHaveLength(1);
      stops[0].focus();
      stops[0].dispatchEvent(new FocusEvent('focus'));
      await vi.advanceTimersByTimeAsync(400);
      expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
        stops[0].getAttribute('aria-label'),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
