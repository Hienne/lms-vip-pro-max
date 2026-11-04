import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DueDate } from './due-date';
import { NOW } from './now';

const DAY = 86_400_000;
/** Fixed "today": 2026-07-10 12:00 UTC. */
const TODAY = Date.UTC(2026, 6, 10, 12);
const inDays = (days: number) => new Date(TODAY + days * DAY).toISOString();

@Component({
  imports: [DueDate],
  template: `
    <app-due-date
      [dueAt]="dueAt()"
      [done]="done()"
      [relativeOnly]="relativeOnly()"
    />
  `,
})
class Host {
  readonly dueAt = signal<string | null | undefined>(inDays(12));
  readonly done = signal(false);
  readonly relativeOnly = signal(false);
}

function render(change: (host: Host) => void = () => undefined) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: NOW, useValue: () => TODAY }],
  });
  const fixture = TestBed.createComponent(Host);
  change(fixture.componentInstance);
  fixture.detectChanges();
  const el = (fixture.nativeElement as HTMLElement).querySelector(
    'span',
  ) as HTMLElement;
  return { text: el.textContent?.replace(/\s+/g, ' ').trim(), el };
}

describe('DueDate', () => {
  it.each([
    { days: 12, expected: 'Còn 12 ngày', tone: 'muted' },
    { days: 2, expected: 'Còn 2 ngày', tone: 'warning' },
    { days: -2, expected: 'Quá hạn 2 ngày', tone: 'danger' },
  ])(
    'keeps the countdown and tone without a date suffix for $days days',
    ({ days, expected, tone }) => {
      const { text, el } = render((h) => {
        h.dueAt.set(inDays(days));
        h.relativeOnly.set(true);
      });
      expect(text).toBe(expected);
      expect(el.classList.contains(`due-date--${tone}`)).toBe(true);
    },
  );

  it('says "Còn n ngày · date" in a muted tone when the deadline is far', () => {
    const { text, el } = render();
    expect(text).toBe('Còn 12 ngày · 22/07/2026');
    expect(el.classList.contains('due-date--muted')).toBe(true);
  });

  it.each([1, 3])(
    'warns "Còn %i ngày" when at most 3 days are left',
    (days) => {
      const { text, el } = render((h) => h.dueAt.set(inDays(days)));
      expect(text).toBe(`Còn ${days} ngày`);
      expect(el.classList.contains('due-date--warning')).toBe(true);
    },
  );

  it('says "Quá hạn n ngày" in the danger tone once past due', () => {
    const { text, el } = render((h) => h.dueAt.set(inDays(-2)));
    expect(text).toBe('Quá hạn 2 ngày');
    expect(el.classList.contains('due-date--danger')).toBe(true);
  });

  it('shows only "Hạn date", muted, when the course is done', () => {
    const { text, el } = render((h) => {
      h.dueAt.set(inDays(-2));
      h.done.set(true);
    });
    expect(text).toBe('Hạn 08/07/2026');
    expect(el.classList.contains('due-date--muted')).toBe(true);
  });

  it('says "Không có hạn" when there is no deadline', () => {
    expect(render((h) => h.dueAt.set(null)).text).toBe('Không có hạn');
    expect(render((h) => h.dueAt.set(undefined)).text).toBe('Không có hạn');
  });
});
