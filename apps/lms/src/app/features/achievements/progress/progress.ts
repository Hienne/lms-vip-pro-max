import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtRelativePipe,
  Icon,
  Kpi,
  MaiBadge,
  PageHeader,
  Progress as ProgressBar,
  RadarChart,
  Spinner,
  Table,
  TableWrap,
} from '@lms/ui';
import { ProgressStore } from './data-access/progress.store';
@Component({
  selector: 'app-progress',
  imports: [
    RouterLink,
    Badge,
    Card,
    CardBody,
    CardHeader,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtRelativePipe,
    Icon,
    Kpi,
    MaiBadge,
    PageHeader,
    ProgressBar,
    RadarChart,
    Spinner,
    Table,
    TableWrap,
  ],
  providers: [ProgressStore],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
})
export class Progress {
  protected readonly store = inject(ProgressStore);
}
