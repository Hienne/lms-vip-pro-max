import { Component, inject } from '@angular/core';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtRelativePipe,
  Icon,
  PageHeader,
  Pagination,
  Spinner,
  Tabs,
  TabPanel,
} from '@lms/ui';
import { NotificationsStore } from './data-access/notifications.store';
@Component({
  selector: 'app-notifications',
  imports: [
    Badge,
    Button,
    Card,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtRelativePipe,
    Icon,
    PageHeader,
    Pagination,
    Spinner,
    Tabs,
    TabPanel,
  ],
  providers: [NotificationsStore],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  protected readonly store = inject(NotificationsStore);
}
