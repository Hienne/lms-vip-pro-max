import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  BarChart,
  Button,
  DonutChart,
  Empty,
  ErrorState,
  FmtNumPipe,
  FmtPctPipe,
  PageHeader,
  SectionCard,
  Spinner,
  Stat,
  StatStrip,
  type DonutDatum,
} from '@lms/ui';
import { SessionStore } from '../../core/session/session.store';
import { ManagementDashboardStore } from './management-dashboard.store';

const WORK_LINKS = [
  {
    menu: 'COURSE_MANAGEMENT',
    path: '/admin/courses',
    label: 'Quản lý khóa học',
  },
  {
    menu: 'QUESTION_BANK',
    path: '/admin/questions',
    label: 'Ngân hàng câu hỏi',
  },
  {
    menu: 'QUIZ_MANAGEMENT',
    path: '/admin/quizzes',
    label: 'Quản lý bài kiểm tra',
  },
  {
    menu: 'COURSE_ASSIGNMENT',
    path: '/admin/assignments',
    label: 'Giao khóa học',
  },
  {
    menu: 'USER_MANAGEMENT',
    path: '/admin/users',
    label: 'Quản lý người dùng',
  },
  { menu: 'REPORTING', path: '/reports/progress', label: 'Báo cáo đào tạo' },
] as const;

@Component({
  selector: 'app-management-dashboard',
  imports: [
    BarChart,
    Button,
    DonutChart,
    Empty,
    ErrorState,
    FmtNumPipe,
    FmtPctPipe,
    PageHeader,
    RouterLink,
    SectionCard,
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
  protected readonly title =
    inject(ActivatedRoute).snapshot.routeConfig?.path === 'instructor'
      ? 'Tổng quan giảng viên'
      : 'Tổng quan quản trị';
  private readonly session = inject(SessionStore);
  protected readonly links = computed(() =>
    WORK_LINKS.filter((link) => this.session.menus$().includes(link.menu)),
  );
  protected readonly status = computed<readonly DonutDatum[]>(() => {
    const counts = this.store.summary$()?.counts;
    if (!counts) return [];
    return [
      { label: 'Đã hoàn thành', value: counts.completed, tone: 'success' },
      { label: 'Đang học', value: counts.inProgress, tone: 'primary' },
      { label: 'Chưa bắt đầu', value: counts.notStarted, tone: 'neutral' },
    ];
  });

  protected readonly daily = computed(() =>
    (this.store.summary$()?.daily ?? []).map((day) => ({
      label: day.date.slice(8, 10) + '/' + day.date.slice(5, 7),
      started: day.started,
      completed: day.completed,
    })),
  );
  protected readonly starts = computed(() =>
    this.daily().map(({ label, started }) => ({ label, value: started })),
  );
  protected readonly completions = computed(() =>
    this.daily().map(({ label, completed }) => ({ label, value: completed })),
  );
}
