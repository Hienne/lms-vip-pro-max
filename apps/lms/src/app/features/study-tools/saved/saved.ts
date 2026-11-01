import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  FmtRelativePipe,
  Icon,
  IconButton,
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
    Card,
    Empty,
    ErrorState,
    FmtRelativePipe,
    Icon,
    IconButton,
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
  protected readonly pageSize = SAVED_PAGE_SIZE;
}
