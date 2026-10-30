import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtNumPipe,
  PageHeader,
  Pagination,
  Segmented,
  Select,
  Skeleton,
  Table,
  TablePrimary,
  TableSub,
  TableWrap,
  type BadgeTone,
  type SegmentedOption,
} from '@lms/ui';
import { CommunityTabs } from '../components/community-tabs/community-tabs';
import { ContentRow } from '../components/content-row/content-row';
import { CONTENT_KIND_LABELS } from '../data-access/community-labels';
import {
  MINE_PAGE_SIZE,
  MineStore,
  type MineRow,
  type MineTab,
} from './data-access/mine.store';

const STATUS_BADGE: Record<
  MineRow['status'],
  { label: string; tone: BadgeTone }
> = {
  draft: { label: 'Bản nháp', tone: 'neutral' },
  published: { label: 'Đã đăng', tone: 'success' },
  closed: { label: 'Đã đóng', tone: 'neutral' },
  archived: { label: 'Đã lưu trữ', tone: 'neutral' },
};

/** Của tôi (CM-06): the caller's posts and drafts, and the posts they saved. */
@Component({
  selector: 'app-community-mine',
  imports: [
    Badge,
    Button,
    CommunityTabs,
    ContentRow,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtNumPipe,
    PageHeader,
    Pagination,
    RouterLink,
    Segmented,
    Select,
    Skeleton,
    Table,
    TablePrimary,
    TableSub,
    TableWrap,
  ],
  providers: [MineStore],
  templateUrl: './mine.html',
  styleUrl: './mine.scss',
})
export class CommunityMine {
  protected readonly store = inject(MineStore);
  protected readonly pageSize = MINE_PAGE_SIZE;
  protected readonly kindLabels = CONTENT_KIND_LABELS;
  protected readonly statusBadge = STATUS_BADGE;
  protected readonly placeholders = [0, 1, 2, 3];

  protected readonly tabs = computed(
    (): readonly SegmentedOption<MineTab>[] => [
      { value: 'mine', label: `Bài của tôi ${this.store.mineTotal$()}` },
      { value: 'saved', label: `Đã lưu ${this.store.savedTotal$()}` },
    ],
  );
}
