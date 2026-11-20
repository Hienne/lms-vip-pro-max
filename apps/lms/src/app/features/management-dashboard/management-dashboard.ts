import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BarChart,
  Button,
  DonutChart,
  ErrorState,
  FmtNumPipe,
  FmtPctPipe,
  PageHeader,
  SectionCard,
  Select,
  Spinner,
  Stat,
  StatStrip,
  type DonutDatum,
} from '@lms/ui';
import { SessionStore } from '../../core/session/session.store';
import { ManagementDashboardStore } from './management-dashboard.store';

@Component({
  selector: 'app-management-dashboard',
  imports: [
    BarChart,
    Button,
    RouterLink,
    DonutChart,
    ErrorState,
    FmtNumPipe,
    FmtPctPipe,
    PageHeader,
    SectionCard,
    Select,
    Spinner,
    Stat,
    StatStrip,
  ],
  providers: [ManagementDashboardStore],
  templateUrl: './management-dashboard.html',
  styleUrl: './management-dashboard.scss',
})
export class ManagementDashboard {
  protected readonly store = inject(ManagementDashboardStore);
  private readonly session = inject(SessionStore);
  protected readonly greeting = computed(() => {
    const name = this.session.user$()?.fullName.trim();
    return name ? 'Xin chào, ' + name : 'Xin chào';
  });

  protected readonly status = computed<readonly DonutDatum[]>(() => {
    const counts = this.store.summary$()?.counts;
    if (!counts) return [];
    return [
      { label: 'Đã hoàn thành', value: counts.completed, tone: 'success' },
      { label: 'Đang học', value: counts.inProgress, tone: 'primary' },
      { label: 'Chưa bắt đầu', value: counts.notStarted, tone: 'neutral' },
    ];
  });

  private readonly days = computed(() => this.store.summary$()?.daily ?? []);
  protected readonly periodLabel = computed(() => {
    if (this.store.period() === 0) return '';
    const first = this.days()[0]?.date;
    const last = this.days().at(-1)?.date;
    if (!first || !last) return '';
    const start =
      first.slice(0, 4) === last.slice(0, 4) ? first.slice(5) : first;
    return (
      start.split('-').reverse().join('/') +
      ' – ' +
      last.split('-').reverse().join('/')
    );
  });

  protected readonly activityMax = computed(() =>
    Math.max(1, ...this.days().flatMap((day) => [day.started, day.completed])),
  );

  protected readonly trends = computed(() => {
    const days = this.days();
    return [
      {
        label: 'Lượt bắt đầu khóa',
        data: days.map(({ date, started }) => ({
          label: dayLabel(date),
          value: started,
        })),
      },
      {
        label: 'Lượt hoàn thành khóa',
        data: days.map(({ date, completed }) => ({
          label: dayLabel(date),
          value: completed,
        })),
      },
    ].map((trend) => ({
      ...trend,
      hasActivity: trend.data.some(({ value }) => value > 0),
    }));
  });
}

function dayLabel(date: string): string {
  return date.slice(8, 10) + '/' + date.slice(5, 7);
}
