import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtRelativePipe,
  Icon,
  IconButton,
  List,
  ListItem,
  PageHeader,
  Skeleton,
} from '@lms/ui';
import { NotificationsStore } from './data-access/notifications.store';

/** The learner's due deadline reminders (the mockup's `notifications` page, E.3). */
@Component({
  selector: 'app-notifications',
  imports: [
    Button,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtRelativePipe,
    Icon,
    IconButton,
    List,
    ListItem,
    PageHeader,
    RouterLink,
    Skeleton,
  ],
  providers: [NotificationsStore],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  protected readonly store = inject(NotificationsStore);
  protected readonly placeholders = [1, 2, 3];
}
