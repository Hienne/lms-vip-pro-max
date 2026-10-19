import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  Badge,
  Card,
  Empty,
  ErrorState,
  Icon,
  Kpi,
  PageHeader,
  Spinner,
} from '@lms/ui';
import { ProgressStore } from './data-access/progress.store';
@Component({
  selector: 'app-progress',
  imports: [
    DatePipe,
    Badge,
    Card,
    Empty,
    ErrorState,
    Icon,
    Kpi,
    PageHeader,
    Spinner,
  ],
  providers: [ProgressStore],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
})
export class Progress {
  protected readonly store = inject(ProgressStore);
}
