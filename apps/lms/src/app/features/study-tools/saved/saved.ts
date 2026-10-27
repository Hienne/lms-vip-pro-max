import { Component, inject } from '@angular/core';
import {
  Card,
  Empty,
  ErrorState,
  FmtRelativePipe,
  FmtTimePipe,
  Icon,
  IconButton,
  PageHeader,
  Pagination,
  Tabs,
  TabPanel,
} from '@lms/ui';
import { SavedStore } from './data-access/saved.store';
@Component({
  selector: 'app-saved',
  imports: [
    Card,
    Empty,
    ErrorState,
    FmtRelativePipe,
    FmtTimePipe,
    Icon,
    IconButton,
    PageHeader,
    Pagination,
    Tabs,
    TabPanel,
  ],
  providers: [SavedStore],
  templateUrl: './saved.html',
  styleUrl: './saved.scss',
})
export class Saved {
  protected readonly store = inject(SavedStore);
}
