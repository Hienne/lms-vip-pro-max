import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Role } from '@lms/contracts';
import { RoleBadge } from './role-badge';

@Component({
  imports: [RoleBadge],
  template: `<app-role-badge [role]="role()" [scoped]="scoped()" />`,
})
class Host {
  readonly role = signal<Role>('learner');
  readonly scoped = signal(false);
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
const CASES: readonly [Role, string, string][] = [
  ['learner', 'Học viên', 'badge--primary'],
  ['instructor', 'Giảng viên', 'badge--info'],
  ['admin', 'Quản trị viên', 'badge--warning'],
  ['viewer', 'Lãnh đạo', 'badge--outline'],
];

describe('RoleBadge', () => {
  it.each(CASES)('shows %s as "%s"', (role, label, tone) => {
    const { badges, set } = render();
    set((h) => h.role.set(role));
    const [badge] = badges();
    expect(text(badge)).toBe(label);
    expect(badge.classList.contains(tone)).toBe(true);
    expect(badge.classList.contains('badge--dot')).toBe(false);
  });

  it('adds "đơn vị" when the role is scoped to a unit', () => {
    const { badges, set } = render();
    set((h) => {
      h.role.set('admin');
      h.scoped.set(true);
    });
    expect(text(badges()[0])).toBe('Quản trị viên đơn vị');
  });
});
