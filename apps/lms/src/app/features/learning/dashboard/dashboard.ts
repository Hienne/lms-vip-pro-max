import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Empty,
  ErrorState,
  Icon,
  Kpi,
  Progress,
  Ring,
  RadarChart,
  Spinner,
  Tabs,
  TabPanel,
} from '@lms/ui';
import { CourseCard } from '../../../shared/course/course-card';
import { DueDate } from '../../../shared/course/due-date';
import { Journey } from '../../../shared/course/journey';
import { DashboardHero } from './components/dashboard-hero/dashboard-hero';
import { DashboardStore } from './data-access/dashboard.store';
@Component({
  selector: 'app-dashboard',
  imports: [
    DashboardHero,
    RouterLink,
    Button,
    Card,
    CardHeader,
    CardBody,
    Empty,
    ErrorState,
    Icon,
    Kpi,
    Progress,
    Ring,
    RadarChart,
    Spinner,
    Tabs,
    TabPanel,
    CourseCard,
    DueDate,
    Journey,
  ],
  providers: [DashboardStore],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly store = inject(DashboardStore);
}
