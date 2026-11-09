import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  SectionCard,
  Search,
  Select,
  List,
  ListItem,
  Menu,
  Empty,
  ErrorState,
  FmtRelativePipe,
  Icon,
  PageHeader,
  Pagination,
  Tabs,
  TabPanel,
} from '@lms/ui';
import { SAVED_PAGE_SIZE, SavedStore } from './data-access/saved.store';
@Component({
  selector: 'app-saved',
  imports: [
    Button,
    SectionCard,
    Search,
    Select,
    List,
    ListItem,
    Menu,
    Empty,
    ErrorState,
    FmtRelativePipe,
    Icon,

    PageHeader,
    Pagination,
    Tabs,
    RouterLink,
    TabPanel,
  ],
  providers: [SavedStore],
  templateUrl: './saved.html',
  styleUrl: './saved.scss',
})
export class Saved {
  protected readonly store = inject(SavedStore);
  protected readonly actions = [
    {
      kind: 'item',
      value: 'remove',
      label: 'Xóa khỏi mục đã lưu',
      icon: 'trash-2',
      tone: 'danger',
    },
  ] as const;
  protected readonly pageSize = SAVED_PAGE_SIZE;
}
