import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DataTable, type DataTableSort } from './data-table';
import { DataTableCell } from './data-table-cell.directive';
import { DataTableHeader } from './data-table-header.directive';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
}

const ROWS: readonly Row[] = [
  { id: 'r1', name: 'An', unit: 'Ban' },
  { id: 'r2', name: 'Bình', unit: 'Trung tâm' },
];

@Component({
  imports: [DataTable, DataTableCell, DataTableHeader],
  template: `<ui-data-table
    caption="Danh sách thử"
    [columns]="columns"
    [rows]="rows()"
    [total]="total()"
    [sort]="sort()"
    [page]="1"
    [pageSize]="2"
    (sortChange)="sorted.push($event)"
    (pageChange)="paged.push($event)"
    (pageSizeChange)="sizes.push($event)"
  >
    <ng-template uiDataTableCell="name" [of]="rows()" let-row>
      <strong>{{ row.name }}</strong>
    </ng-template>
    <ng-template uiDataTableHeader="id"><i>Chọn tất cả</i></ng-template>
    <p slot="empty">Chưa có dữ liệu</p>
  </ui-data-table>`,
})
class Host {
  readonly columns = [
    { key: 'name', label: 'Tên' },
    { key: 'unit', label: 'Đơn vị' },
    { key: 'id', label: '', kind: 'actions' as const },
  ];
  readonly rows = signal<readonly Row[]>(ROWS);
  readonly total = signal(4);
  readonly sort = signal<DataTableSort | null>(null);
  readonly sorted: DataTableSort[] = [];
  readonly paged: number[] = [];
  readonly sizes: number[] = [];
}

@Component({
  imports: [DataTable],
  template: `<ui-data-table
    caption="Tất cả dòng"
    [columns]="[{ key: 'name', label: 'Tên' }]"
    [rows]="rows"
    [total]="2"
    [pageSize]="100"
    [pageSizeOptions]="[]"
  />`,
})
class AllRowsHost {
  readonly rows = ROWS;
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const set = (change: (host: Host) => void) => {
    change(fixture.componentInstance);
    fixture.detectChanges();
  };
  return { root, set, host: fixture.componentInstance };
}

describe('DataTable', () => {
  it('is a captioned responsive table with a header per column', () => {
    const { root } = render();
    const table = root.querySelector('table')!;
    expect(table.classList.contains('table--responsive')).toBe(true);
    expect(table.querySelector('caption')?.textContent?.trim()).toBe(
      'Danh sách thử',
    );
    expect(
      Array.from(table.querySelectorAll('th'), (th) => th.textContent?.trim()),
    ).toEqual(['Tên', 'Đơn vị', 'Chọn tất cả']);
  });

  it('renders a header template in place of the label, without a sort button', () => {
    const { root } = render();
    const th = root.querySelectorAll('th')[2];
    expect(th.querySelector('i')?.textContent).toBe('Chọn tất cả');
    expect(th.querySelector('button')).toBeNull();
  });

  it('renders a cell template where there is one and row[key] elsewhere', () => {
    const { root } = render();
    const first = root.querySelectorAll('tbody tr')[0].querySelectorAll('td');
    expect(first[0].querySelector('strong')?.textContent).toBe('An');
    expect(first[1].textContent?.trim()).toBe('Ban');
    expect(first[0].getAttribute('data-label')).toBe('Tên');
  });

  it('puts only the sorted header in aria-sort and shows its direction', () => {
    const { root, set } = render();
    set((h) => h.sort.set({ key: 'unit', dir: 'desc' }));
    const [name, unit] = Array.from(root.querySelectorAll('th'));
    expect(name.getAttribute('aria-sort')).toBeNull();
    expect(unit.getAttribute('aria-sort')).toBe('descending');
  });

  it('asks for ascending first, then flips the direction of the sorted column', () => {
    const { root, set, host } = render();
    root.querySelector<HTMLButtonElement>('th button')!.click();
    set((h) => h.sort.set({ key: 'name', dir: 'asc' }));
    root.querySelector<HTMLButtonElement>('th button')!.click();
    expect(host.sorted).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'name', dir: 'desc' },
    ]);
  });

  it('keeps the actions header out of the sort buttons', () => {
    const { root } = render();
    expect(root.querySelectorAll('th button')).toHaveLength(2);
    expect(
      root.querySelectorAll('th')[2].classList.contains('col-actions'),
    ).toBe(true);
  });

  it('paginates by the total, not by the rows it was given', () => {
    const { root, host } = render();
    expect(root.querySelector('.pagination span')?.textContent?.trim()).toBe(
      'Hiển thị 1–2 / 4',
    );
    root
      .querySelectorAll<HTMLButtonElement>('.pagination nav button')[2]
      .click();
    expect(host.paged).toEqual([2]);
  });

  it('offers 10 / 20 / 50 / 100 rows per page plus the current size, and reports the choice', () => {
    const { root, host } = render();
    const select = root.querySelector<HTMLSelectElement>('.pagination select')!;
    expect(Array.from(select.options, (o) => o.value)).toEqual([
      '2',
      '10',
      '20',
      '50',
      '100',
    ]);
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(host.sizes).toEqual([50]);
  });

  it('shows the projected empty state instead of a table when there is nothing', () => {
    const { root, set } = render();
    set((h) => {
      h.rows.set([]);
      h.total.set(0);
    });
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('[slot=empty]')?.textContent).toBe(
      'Chưa có dữ liệu',
    );
  });

  it('shows no picker when the owner passes no size options', () => {
    const fixture = TestBed.createComponent(AllRowsHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('tbody tr')).not.toBeNull();
    expect(root.querySelector('.pagination select')).toBeNull();
  });
});
