import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  contentChildren,
  input,
  output,
} from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import { Table } from '../../atoms/table/table.directive';
import { TableWrap } from '../../atoms/table/table-wrap.directive';
import { Pagination } from '../../molecules/pagination/pagination';
import { DataTableCell } from './data-table-cell.directive';

export interface DataTableColumn {
  readonly key: string;
  readonly label: string;
  /** Header becomes a sort button; defaults to true for a column with a label. */
  readonly sortable?: boolean;
  /** `actions` is the narrow right-aligned column of row buttons. */
  readonly kind?: 'actions';
}

export interface DataTableSort {
  readonly key: string;
  readonly dir: 'asc' | 'desc';
}

/**
 * A sortable, paged table (the mockup's `UI.DataTable`) with no state of its own: the owner sorts
 * and slices the rows, passes the visible page as `rows` with the `total`, and reacts to
 * `sortChange` and `pageChange`. Cells are `uiDataTableCell` templates by column key. Rows carry
 * an `id`. Below 720px each row becomes a card. Project `[slot=empty]` for the no-rows state.
 */
@Component({
  selector: 'ui-data-table',
  imports: [Icon, NgTemplateOutlet, Pagination, Table, TableWrap],
  templateUrl: './data-table.html',
})
export class DataTable<T extends { readonly id: string | number }> {
  readonly columns = input.required<readonly DataTableColumn[]>();
  /** The rows of the current page. */
  readonly rows = input.required<readonly T[]>();
  /** Rows across all pages. */
  readonly total = input.required<number>();
  /** Accessible caption, hidden visually. */
  readonly caption = input.required<string>();
  readonly sort = input<DataTableSort | null>(null);
  readonly page = input(1);
  readonly pageSize = input(10);
  readonly sortChange = output<DataTableSort>();
  readonly pageChange = output<number>();

  private readonly cells = contentChildren(DataTableCell);

  protected readonly templates = computed(
    () => new Map(this.cells().map((cell) => [cell.key(), cell.template])),
  );

  protected ariaSort(key: string): 'ascending' | 'descending' | null {
    const sort = this.sort();
    if (sort?.key !== key) return null;
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  protected toggle(key: string): void {
    const sort = this.sort();
    this.sortChange.emit({
      key,
      dir: sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc',
    });
  }

  protected valueOf(row: T, key: string): unknown {
    return (row as Record<string, unknown>)[key] ?? '—';
  }
}
