import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { isUnitAdmin, RoleBadge, roleText } from './role-badge';

@Component({
  imports: [RoleBadge],
  template: `<app-role-badge
    [roleId]="roleId()"
    [name]="name()"
    [scoped]="scoped()"
  />`,
})
class Host {
  readonly roleId = signal('learner');
  readonly name = signal('Học viên');
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

// Tones are the mockup's table in components.js; the label is the name the server sends.
const CASES: readonly [string, string, string][] = [
  ['learner', 'Học viên', 'badge--primary'],
  ['instructor', 'Giảng viên', 'badge--info'],
  ['admin', 'Quản trị viên', 'badge--warning'],
  ['viewer', 'Lãnh đạo', 'badge--outline'],
  ['content-lead', 'Chuyên viên nội dung', 'badge--outline'],
];

describe('RoleBadge', () => {
  it.each(CASES)('shows %s as "%s"', (roleId, name, tone) => {
    const { badges, set } = render();
    set((h) => {
      h.roleId.set(roleId);
      h.name.set(name);
    });
    const [badge] = badges();
    expect(text(badge)).toBe(name);
    expect(badge.classList.contains(tone)).toBe(true);
    expect(badge.classList.contains('badge--dot')).toBe(false);
  });

  it('adds "đơn vị" when the role is scoped to a unit', () => {
    const { badges, set } = render();
    set((h) => {
      h.roleId.set('admin');
      h.name.set('Quản trị viên');
      h.scoped.set(true);
    });
    expect(text(badges()[0])).toBe('Quản trị viên đơn vị');
  });
});

describe('roleText', () => {
  it('suffixes only an admin limited to one unit', () => {
    const admin = { roleId: 'admin', roleName: 'Quản trị viên' };
    expect(roleText({ ...admin, scopeUnitId: 'u2' })).toBe(
      'Quản trị viên đơn vị',
    );
    expect(roleText({ ...admin, scopeUnitId: null })).toBe('Quản trị viên');
    expect(
      roleText({ roleId: 'learner', roleName: 'Học viên', scopeUnitId: 'u1' }),
    ).toBe('Học viên');
    expect(isUnitAdmin({ roleId: 'admin', scopeUnitId: 'u2' })).toBe(true);
  });
});
