import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Avatar, initialsOf, type AvatarSize } from './avatar';
import { AvatarGroup } from './avatar-group.directive';

describe('initialsOf', () => {
  it.each([
    ['Nguyễn Ngọc Anh', 'NA'],
    ['Lê Hoàng Nam', 'HN'],
    ['Đỗ Văn', 'ĐV'],
    ['đặng văn dũng', 'VD'],
    ['Ánh', 'Á'],
    ['  Trần   Thị  Bích  ', 'TB'],
    ['Nguyễn'.normalize('NFD') + ' Ê'.normalize('NFD'), 'NÊ'],
    ['', '?'],
    ['   ', '?'],
  ])('%s → %s', (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});

@Component({
  imports: [Avatar, AvatarGroup],
  template: `
    <ui-avatar [name]="name()" [size]="size()" [top]="top()" />
    <div uiAvatarGroup aria-label="Nhóm Tổng hợp">
      <ui-avatar name="Nguyễn Ngọc Anh" />
      <ui-avatar name="Lê Hoàng Nam" />
    </div>
  `,
})
class Host {
  readonly name = signal('Nguyễn Ngọc Anh');
  readonly size = signal<AvatarSize>('md');
  readonly top = signal(false);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    root,
    avatar: root.querySelector('ui-avatar') as HTMLElement,
    host: fixture.componentInstance,
  };
}

describe('Avatar', () => {
  it('shows the initials of the name', () => {
    const { avatar } = render();
    expect(avatar.textContent?.trim()).toBe('NA');
    expect(avatar.classList.contains('avatar')).toBe(true);
  });

  it('is an image named after the person, the initials hidden from assistive technology', () => {
    const { avatar } = render();
    expect(avatar.getAttribute('role')).toBe('img');
    expect(avatar.getAttribute('aria-label')).toBe('Nguyễn Ngọc Anh');
    expect(avatar.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      'NA',
    );
  });

  it('follows the name', () => {
    const { fixture, avatar, host } = render();
    host.name.set('Đỗ Minh Quân');
    fixture.detectChanges();
    expect(avatar.textContent?.trim()).toBe('MQ');
    expect(avatar.getAttribute('aria-label')).toBe('Đỗ Minh Quân');
  });

  it.each(['sm', 'lg', 'xl'] as const)('has the %s size', (size) => {
    const { fixture, avatar, host } = render();
    expect(avatar.className).not.toContain('avatar--');
    host.size.set(size);
    fixture.detectChanges();
    expect(avatar.classList.contains(`avatar--${size}`)).toBe(true);
  });

  it('rings a top-ranked person', () => {
    const { fixture, avatar, host } = render();
    host.top.set(true);
    fixture.detectChanges();
    expect(avatar.classList.contains('avatar--top')).toBe(true);
  });

  it('overlaps in a named group', () => {
    const { root } = render();
    const group = root.querySelector('[uiAvatarGroup]') as HTMLElement;
    expect(group.classList.contains('avatar-group')).toBe(true);
    expect(group.getAttribute('role')).toBe('group');
    expect(group.querySelectorAll('ui-avatar')).toHaveLength(2);
  });
});
