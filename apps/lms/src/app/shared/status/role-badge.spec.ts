import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RoleBadge } from './role-badge';

@Component({
  imports: [RoleBadge],
  template: `<app-role-badge [code]="code()" [name]="name()" />`,
})
class Host {
  readonly code = signal('LEARNER');
  readonly name = signal('Học viên');
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

// The tone follows the backend's role code; the label is the name the server sends.
const CASES: readonly [string, string, string][] = [
  ['SUPER_ADMIN', 'Quản trị viên gốc', 'badge--danger'],
  ['ADMIN', 'Quản trị viên', 'badge--warning'],
  ['INSTRUCTOR', 'Giảng viên', 'badge--info'],
  ['LEARNER', 'Học viên', 'badge--primary'],
  ['REPORT_VIEWER', 'Người xem báo cáo', 'badge--outline'],
  ['AUDITOR', 'Kiểm toán', 'badge--outline'],
];

describe('RoleBadge', () => {
  it.each(CASES)('shows %s as "%s"', (code, name, tone) => {
    const { badges, set } = render();
    set((h) => {
      h.code.set(code);
      h.name.set(name);
    });
    const [badge] = badges();
    expect(text(badge)).toBe(name);
    expect(badge.classList.contains(tone)).toBe(true);
    expect(badge.classList.contains('badge--dot')).toBe(false);
  });
});
