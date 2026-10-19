import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  ErrorState,
  PageHeader,
  Spinner,
} from '@lms/ui';
import { NotificationsStore } from './data-access/notifications.store';
@Component({
  selector: 'app-notifications',
  imports: [
    DatePipe,
    Button,
    Card,
    Checkbox,
    Empty,
    ErrorState,
    PageHeader,
    Spinner,
  ],
  providers: [NotificationsStore],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  protected readonly store = inject(NotificationsStore);
}
