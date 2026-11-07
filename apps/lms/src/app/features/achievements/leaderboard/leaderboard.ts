import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  Alert,
  AlertAction,
  Button,
  Card,
  ErrorState,
  PageHeader,
  Pagination,
  Segmented,
  Skeleton,
  type SegmentedOption,
} from '@lms/ui';
import type { LeaderboardScope } from '@lms/contracts';
import {
  LEADERBOARD_PAGE_SIZE,
  LeaderboardStore,
} from './data-access/leaderboard.store';

/** The learners ranked by learning points, and the caller's own points (the mockup's `leaderboard` page). */
@Component({
  selector: 'app-leaderboard',
  imports: [
    Alert,
    AlertAction,
    Button,
    Card,
    ErrorState,
    NgTemplateOutlet,
    PageHeader,
    Pagination,
    Segmented,
    Skeleton,
  ],
  providers: [LeaderboardStore],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
})
export class Leaderboard {
  protected readonly store = inject(LeaderboardStore);
  protected readonly pageSize = LEADERBOARD_PAGE_SIZE;
  protected readonly scopes: readonly SegmentedOption<LeaderboardScope>[] = [
    { value: 'team', label: 'Nhóm của tôi' },
    { value: 'org', label: 'Đơn vị' },
    { value: 'all', label: 'Toàn hệ thống' },
  ];
}
