import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CourseStatus as CourseStatusValue } from '@lms/contracts';
import { CourseStatus } from './course-status';

@Component({
  imports: [CourseStatus],
  template: `<app-course-status [status]="status()" [overdue]="overdue()" />`,
})
class Host {
  readonly status = signal<CourseStatusValue>('not_started');
  readonly overdue = signal(false);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const badges = () => Array.from(root.querySelectorAll<HTMLElement>('.badge'));
  const set = (change: (host: Host) => void) => {
    change(fixture.componentInstance);
    fixture.detectChanges();
  };
  return { badges, set };
}

const text = (el: Element | undefined) =>
  el?.textContent?.replace(/\s+/g, ' ').trim();

// Labels and tones are the mockup's tables in components.js.
const CASES: readonly [CourseStatusValue, string, string, boolean][] = [
  ['not_started', 'Chưa bắt đầu', '', false],
  ['in_progress', 'Đang học', 'badge--info', false],
  ['completed', 'Đã hoàn thành', 'badge--success', true],
  ['failed', 'Chưa đạt', 'badge--danger', true],
];

describe('CourseStatus', () => {
  it.each(CASES)('shows %s as "%s"', (status, label, tone, hasIcon) => {
    const { badges, set } = render();
    set((h) => h.status.set(status));
    const [badge] = badges();
    expect(text(badge)).toBe(label);
    if (tone) expect(badge.classList.contains(tone)).toBe(true);
    expect(badge.querySelector('ui-icon') !== null).toBe(hasIcon);
    expect(badge.classList.contains('badge--dot')).toBe(false);
  });

  it('adds a "Quá hạn" danger badge with a clock only when overdue', () => {
    const { badges, set } = render();
    expect(badges()).toHaveLength(1);
    set((h) => h.overdue.set(true));
    const [, overdue] = badges();
    expect(text(overdue)).toBe('Quá hạn');
    expect(overdue.classList.contains('badge--danger')).toBe(true);
    expect(overdue.querySelector('ui-icon')).not.toBeNull();
  });
});
