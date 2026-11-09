import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { List } from '../../atoms/list/list.directive';
import { ListRow } from './list-row';

@Component({
  imports: [List, ListRow],
  template: `
    <ul uiList>
      <li>
        <ui-list-row
          id="full"
          link="/saved"
          icon="bookmark"
          title="Ghi chú"
          subtitle="Mở đúng trang"
          chevron
        />
      </li>
      <li>
        <ui-list-row
          id="due"
          link="/course/1"
          icon="triangle-alert"
          tone="danger"
          title="Quy trình"
          value="40%"
        >
          <span slot="subtitle">Quá hạn 2 ngày</span>
        </ui-list-row>
      </li>
      <li><ui-list-row id="bare" link="/x" title="Chỉ tiêu đề" /></li>
    </ul>
  `,
})
class Host {}

function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return (id: string) => root.querySelector(`#${id}`) as HTMLElement;
}

describe('ListRow', () => {
  it('is one link carrying the list item look', () => {
    const el = render()('full');
    const link = el.querySelector('a') as HTMLAnchorElement;
    expect(link.classList.contains('list__item')).toBe(true);
    expect(link.getAttribute('href')).toBe('/saved');
    expect(el.querySelectorAll('a')).toHaveLength(1);
  });

  it('shows a plain icon, the title, the subtitle and a chevron', () => {
    const el = render()('full');
    expect(el.querySelector('.list-row__icon ui-icon')).not.toBeNull();
    expect(el.querySelector('.list-row__title')?.textContent).toBe('Ghi chú');
    expect(el.querySelector('.list-row__subtitle')?.textContent).toBe(
      'Mở đúng trang',
    );
    expect(el.querySelector('.list-row__chevron')).not.toBeNull();
    expect(el.querySelector('.list-row__value')).toBeNull();
  });

  it('colours the icon only for the danger tone and shows a trailing value', () => {
    const get = render();
    expect(get('due').querySelector('.list-row__icon--danger')).not.toBeNull();
    expect(get('full').querySelector('.list-row__icon--danger')).toBeNull();
    expect(get('due').querySelector('.list-row__value')?.textContent).toBe(
      '40%',
    );
    expect(get('due').querySelector('.list-row__chevron')).toBeNull();
  });

  it('projects a subtitle slot', () => {
    expect(
      render()('due').querySelector('.list-row__text span[slot=subtitle]')
        ?.textContent,
    ).toBe('Quá hạn 2 ngày');
  });

  it('omits the icon, subtitle and trailing parts when not given', () => {
    const el = render()('bare');
    expect(el.querySelector('.list-row__icon')).toBeNull();
    expect(el.querySelector('.list-row__subtitle')).toBeNull();
    expect(el.querySelector('.list-row__chevron')).toBeNull();
  });
});
