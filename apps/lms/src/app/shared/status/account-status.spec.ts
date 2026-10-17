import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AccountStatus as AccountStatusValue } from '@lms/contracts';
import { AccountStatus } from './account-status';

@Component({
  imports: [AccountStatus],
  template: `<app-account-status [status]="status()" />`,
})
class Host {
  readonly status = signal<AccountStatusValue>('active');
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
const CASES: readonly [AccountStatusValue, string, string][] = [
  ['active', 'Hoạt động', 'badge--success'],
  ['suspended', 'Tạm dừng', 'badge--warning'],
  ['locked', 'Đã khóa', 'badge--danger'],
];

describe('AccountStatus', () => {
  it.each(CASES)('shows %s as "%s" with a dot', (status, label, tone) => {
    const { badges, set } = render();
    set((h) => h.status.set(status));
    const [badge] = badges();
    expect(text(badge)).toBe(label);
    expect(badge.classList.contains(tone)).toBe(true);
    expect(badge.classList.contains('badge--dot')).toBe(true);
  });

  it('shows inactive as a neutral "Ngừng hoạt động" badge with a dot', () => {
    const { badges, set } = render();
    set((h) => h.status.set('inactive'));
    const [badge] = badges();
    expect(text(badge)).toBe('Ngừng hoạt động');
    // Neutral is the base badge: no tone modifier.
    expect(badge.className).toBe('badge badge--dot');
  });
});
