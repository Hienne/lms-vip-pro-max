import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { List } from './list.directive';
import { ListIcon } from './list-icon.directive';
import { ListItem } from './list-item.directive';

@Component({
  imports: [List, ListItem, ListIcon],
  template: `
    <ul uiList>
      <li>
        <a uiListItem href="/a">Một <span uiListIcon>i</span></a>
      </li>
      <li><button uiListItem type="button">Hai</button></li>
      <li uiListItem>Ba</li>
    </ul>
  `,
})
class Host {}

describe('List', () => {
  it('marks the list, its rows and its icon tile', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('ul')?.classList.contains('list')).toBe(true);
    expect(root.querySelectorAll('.list__item')).toHaveLength(3);
    expect(root.querySelector('a')?.classList.contains('list__item')).toBe(
      true,
    );
    expect(root.querySelector('li.list__item')?.textContent).toContain('Ba');
    expect(root.querySelector('.list__icon')?.textContent).toBe('i');
  });
});
