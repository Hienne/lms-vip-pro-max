import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  Card,
  ErrorState,
  FmtNumPipe,
  FmtPctPipe,
  PageHeader,
  Spinner,
} from '@lms/ui';
import { ManagementDashboardStore } from './management-dashboard.store';

@Component({
  selector: 'app-management-dashboard',
  imports: [
    RouterLink,
    Card,
    ErrorState,
    FmtNumPipe,
    FmtPctPipe,
    PageHeader,
    Spinner,
  ],
  providers: [ManagementDashboardStore],
  templateUrl: './management-dashboard.html',
  styleUrl: './management-dashboard.scss',
})
export class ManagementDashboard {
  protected readonly store = inject(ManagementDashboardStore);
  protected readonly instructor = inject(Router).url.startsWith('/instructor');
  protected readonly title = this.instructor
    ? 'Tổng quan giảng viên'
    : 'Tổng quan quản trị';
}
