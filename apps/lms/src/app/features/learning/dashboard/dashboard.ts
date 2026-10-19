import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  Icon,
  Kpi,
  PageHeader,
  Spinner,
} from '@lms/ui';
import { DashboardStore } from './data-access/dashboard.store';

@Component({
  selector: 'app-dashboard',
  imports: [
    DatePipe,
    RouterLink,
    Button,
    Card,
    Empty,
    ErrorState,
    Icon,
    Kpi,
    PageHeader,
    Spinner,
  ],
  providers: [DashboardStore],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly store = inject(DashboardStore);
}
