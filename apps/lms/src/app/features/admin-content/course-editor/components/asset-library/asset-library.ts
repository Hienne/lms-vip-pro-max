import { Component, inject, output, signal } from '@angular/core';
import type { LibraryAsset } from '@lms/contracts';
import {
  Button,
  List,
  ListItem,
  Pagination,
  Select,
  Empty,
  Field,
  Input,
  Textarea,
  ErrorState,
  FmtBytesPipe,
  FmtDatePipe,
  Menu,
  Search,
  Spinner,
  type MenuEntry,
} from '@lms/ui';
import {
  AssetLibraryStore,
  type LibraryRow,
} from './data-access/asset-library.store';

const ROW_MENU: readonly MenuEntry<'view' | 'edit' | 'delete' | 'permanent'>[] =
  [
    { kind: 'item', value: 'view', label: 'Xem thông tin' },
    { kind: 'item', value: 'edit', label: 'Sửa thông tin' },
    {
      kind: 'item',
      value: 'permanent',
      label: 'Xóa vĩnh viễn khỏi kho',
      icon: 'trash-2',
      tone: 'danger',
    },
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
    List,
    ListItem,
    Pagination,
    Select,
    Empty,
    Field,
    Input,
    Textarea,
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
  protected readonly details = signal<LibraryRow | null>(null);
  protected readonly pageSizes = [10, 20, 50, 100];
  protected format(row: LibraryRow): string {
    const extension = /\.([a-z0-9]{1,10})$/i.exec(row.asset.originalName)?.[1];
    return extension ? extension.toUpperCase() : row.mimeType;
  }
  protected chooseAction(
    action: 'view' | 'edit' | 'delete' | 'permanent',
    row: LibraryRow,
  ): void {
    if (action === 'view') this.details.set(row);
    else if (action === 'edit') this.store.edit(row);
    else if (action === 'permanent') this.store.removePermanently(row);
    else this.store.remove(row);
  }
  protected sort(event: Event): void {
    const [key, dir] = (event.target as HTMLSelectElement).value.split(',');
    if (
      (key === 'name' || key === 'uploaded') &&
      (dir === 'asc' || dir === 'desc')
    )
      this.store.sortBy({ key, dir });
  }
  protected readonly rowMenu = ROW_MENU;
}
