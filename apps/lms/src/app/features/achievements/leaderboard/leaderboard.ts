import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  Alert,
  AlertAction,
  Button,
  SectionCard,
  Stat,
  StatStrip,
  ErrorState,
  PageHeader,
  Segmented,
  Skeleton,
  type SegmentedOption,
} from '@lms/ui';
import type { LeaderboardPeriod, LeaderboardScope } from '@lms/contracts';
import type { LeaderboardView } from './data-access/leaderboard.store';
import { LeaderboardStore } from './data-access/leaderboard.store';

/** The top ten learners by XP of a period, the caller's own place and points (the mockup's `leaderboard` page). */
@Component({
  selector: 'app-leaderboard',
  imports: [
    Alert,
    AlertAction,
    Button,
    SectionCard,
    Stat,
    StatStrip,
    ErrorState,
    NgTemplateOutlet,
    PageHeader,
    Segmented,
    Skeleton,
  ],
  providers: [LeaderboardStore],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
})
export class Leaderboard {
  protected readonly store = inject(LeaderboardStore);
  protected readonly scopes: readonly SegmentedOption<LeaderboardScope>[] = [
    { value: 'team', label: 'Nhóm của tôi' },
    { value: 'org', label: 'Đơn vị' },
    { value: 'all', label: 'Toàn hệ thống' },
  ];
  protected readonly views: readonly SegmentedOption<LeaderboardView>[] = [
    { value: 'people', label: 'Học viên' },
    { value: 'units', label: 'Các đơn vị' },
  ];
  protected readonly periods: readonly SegmentedOption<LeaderboardPeriod>[] = [
    { value: 'week', label: 'Tuần' },
    { value: 'month', label: 'Tháng' },
    { value: 'all', label: 'Tất cả' },
  ];
}
