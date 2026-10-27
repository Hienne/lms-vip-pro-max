import { Component, inject, output } from '@angular/core';
import type { LibraryAsset } from '@lms/contracts';
import {
  Button,
  DataTable,
  DataTableCell,
  Empty,
  ErrorState,
  FmtBytesPipe,
  FmtDatePipe,
  Menu,
  Search,
  Spinner,
  type DataTableColumn,
  type MenuEntry,
} from '@lms/ui';
import {
  AssetLibraryStore,
  LIBRARY_PAGE_SIZE,
} from './data-access/asset-library.store';

const COLUMNS: readonly DataTableColumn[] = [
  { key: 'name', label: 'Tên tệp' },
  { key: 'size', label: 'Dung lượng', sortable: false },
  { key: 'uploaded', label: 'Ngày tải lên' },
  { key: 'actions', label: 'Thao tác', kind: 'actions' },
];

const ROW_MENU: readonly MenuEntry<'delete'>[] = [
  {
    kind: 'item',
    value: 'delete',
    label: 'Xóa khỏi thư viện',
    icon: 'trash-2',
    tone: 'danger',
  },
];

/**
 * The files of the library that fit a file block, in the drawer "Thư viện tài nguyên". Picking a
 * file hands it to the lesson form, which gives it to the block like a finished upload. The
 * `AssetLibraryStore` comes from the lesson form, which opens the drawer.
 */
@Component({
  selector: 'app-asset-library',
  imports: [
    Button,
    DataTable,
    DataTableCell,
    Empty,
    ErrorState,
    FmtBytesPipe,
    FmtDatePipe,
    Menu,
    Search,
    Spinner,
  ],
  templateUrl: './asset-library.html',
  styleUrl: './asset-library.scss',
})
export class AssetLibrary {
  readonly picked = output<LibraryAsset>();

  protected readonly store = inject(AssetLibraryStore);
  protected readonly columns = COLUMNS;
  protected readonly rowMenu = ROW_MENU;
  protected readonly pageSize = LIBRARY_PAGE_SIZE;
}
