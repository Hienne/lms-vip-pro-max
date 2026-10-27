import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RoleBadge } from './role-badge';

@Component({
  imports: [RoleBadge],
  template: `<app-role-badge [name]="name()" />`,
})
class Host {
  readonly name = signal('Học viên');
}

const text = (el: Element | null) =>
  el?.textContent?.replace(/\s+/g, ' ').trim();

describe('RoleBadge', () => {
  it.each([
    'Quản trị viên gốc',
    'Quản trị viên',
    'Giảng viên',
    'Học viên',
    'Kiểm toán',
  ])('shows "%s" as the one neutral badge every role shares', (name) => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.name.set(name);
    fixture.detectChanges();
    const badge = (fixture.nativeElement as HTMLElement).querySelector(
      '.badge',
    );
    expect(text(badge)).toBe(name);
    // The neutral tone adds no modifier class.
    expect(badge?.className).not.toMatch(/badge--/);
  });
});
