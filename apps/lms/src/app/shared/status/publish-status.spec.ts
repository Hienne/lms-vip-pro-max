import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PublishStatus as PublishStatusValue } from '@lms/contracts';
import { PublishStatus } from './publish-status';

@Component({
  imports: [PublishStatus],
  template: `<app-publish-status [status]="status()" />`,
})
class Host {
  readonly status = signal<PublishStatusValue>('draft');
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
const CASES: readonly [PublishStatusValue, string, string][] = [
  ['draft', 'Nháp', 'badge--outline'],
  ['published', 'Đã xuất bản', 'badge--success'],
  ['paused', 'Tạm dừng', 'badge--warning'],
  ['locked', 'Đã khóa', 'badge--danger'],
];

describe('PublishStatus', () => {
  it.each(CASES)('shows %s as "%s" with a dot', (status, label, tone) => {
    const { badges, set } = render();
    set((h) => h.status.set(status));
    const [badge] = badges();
    expect(text(badge)).toBe(label);
    expect(badge.classList.contains(tone)).toBe(true);
    expect(badge.classList.contains('badge--dot')).toBe(true);
  });
});
