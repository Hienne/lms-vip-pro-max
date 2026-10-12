import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Table } from './table.directive';
import { TableWrap } from './table-wrap.directive';

@Component({
  imports: [Table, TableWrap],
  template: `
    <div uiTableWrap>
      <table uiTable [responsive]="responsive()">
        <caption>
          Bảng mẫu
        </caption>
        <thead>
          <tr>
            <th scope="col">Khóa học</th>
            <th scope="col" class="text-right" aria-sort="ascending">Điểm</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-label="Khóa học">Tổng quan Core Banking</td>
            <td data-label="Điểm" class="text-right">82</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
})
class Host {
  readonly responsive = signal(false);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    root,
    table: root.querySelector('table') as HTMLTableElement,
    host: fixture.componentInstance,
  };
}

describe('Table', () => {
  it('is a native table with the table look inside a scroll wrapper', () => {
    const { root, table } = render();
    expect(table.classList.contains('table')).toBe(true);
    expect(root.querySelector('div.table-wrap > table')).toBe(table);
  });

  it('keeps native table semantics', () => {
    const { table } = render();
    expect(table.caption?.textContent?.trim()).toBe('Bảng mẫu');
    expect(table.tHead?.rows[0].cells[0].scope).toBe('col');
    expect(table.tHead?.rows[0].cells[1].getAttribute('aria-sort')).toBe(
      'ascending',
    );
    expect(
      table.tBodies[0].rows[0].cells[1].classList.contains('text-right'),
    ).toBe(true);
  });

  it('is not responsive unless asked', () => {
    const { fixture, table, host } = render();
    expect(table.classList.contains('table--responsive')).toBe(false);
    host.responsive.set(true);
    fixture.detectChanges();
    expect(table.classList.contains('table--responsive')).toBe(true);
  });
});
