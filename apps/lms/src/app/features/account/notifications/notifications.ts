import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Empty,
  ErrorState,
  Icon,
  IconButton,
  List,
  ListItem,
  PageHeader,
  Segmented,
  Skeleton,
  type SegmentedOption,
} from '@lms/ui';
import { InstructorInbox } from './instructor-inbox/instructor-inbox';
import { ReminderItem } from '../../../shared/learning/reminder-item/reminder-item';
import { NotificationsStore } from './data-access/notifications.store';

/**
 * Everything that waits for the user: a learner's due deadline reminders (the mockup's
 * `notifications` page, E.3) and, for whoever manages courses, the questions learners asked.
 */
@Component({
  selector: 'app-notifications',
  imports: [
    Button,
    Empty,
    ErrorState,
    Icon,
    IconButton,
    InstructorInbox,
    List,
    ListItem,
    PageHeader,
    ReminderItem,
    RouterLink,
    Segmented,
    Skeleton,
  ],
  providers: [NotificationsStore],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  protected readonly store = inject(NotificationsStore);
  protected readonly placeholders = [1, 2, 3];
  protected readonly filters: readonly SegmentedOption<string>[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'unread', label: 'Chưa đọc' },
    { value: 'read', label: 'Đã đọc' },
  ];
}
