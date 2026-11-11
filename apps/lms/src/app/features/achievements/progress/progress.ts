import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BarChart,
  Button,
  Checkbox,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtDatetimePipe,
  FmtPctPipe,
  FmtRelativePipe,
  Icon,
  PageHeader,
  Pagination,
  Progress,
  Search,
  Select,
  Segmented,
  Skeleton,
  Table,
  TableCell,
  TableCol,
  TablePrimary,
  TableWrap,
  TabPanel,
  Tabs,
  type SegmentedOption,
  type TabItem,
} from '@lms/ui';
import { ActivityHeatmap } from '../../../shared/learning/activity-heatmap/activity-heatmap';
import { CompetencyView } from '../../../shared/learning/competency/competency-view';
import {
  ProgressCounts,
  type ProgressCountFilter,
} from '../../../shared/learning/progress-counts/progress-counts';
import { CourseStatus } from '../../../shared/status/course-status';
import {
  EXAM_HISTORY_SIZE,
  PROGRESS_PAGE_SIZE,
  ProgressStore,
  type ProgressStatusFilter,
} from './data-access/progress.store';

/** The learner's progress over all their courses (the mockup's `progress` page, F.8). */
@Component({
  selector: 'app-progress',
  imports: [
    ActivityHeatmap,
    BarChart,
    Button,
    Checkbox,
    CompetencyView,
    CourseStatus,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtDatetimePipe,
    FmtPctPipe,
    FmtRelativePipe,
    Icon,
    PageHeader,
    Pagination,
    Progress,
    ProgressCounts,
    RouterLink,
    Search,
    Select,
    Segmented,
    Skeleton,
    Table,
    TableCell,
    TableCol,
    TablePrimary,
    TableWrap,
    TabPanel,
    Tabs,
  ],
  providers: [ProgressStore],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
})
export class LearningProgress {
  protected readonly store = inject(ProgressStore);
  protected readonly selectedCountFilter = computed<ProgressCountFilter | null>(
    () => {
      const filters = this.store.filters$();
      if (this.store.tab$() !== 'courses' || filters.q.trim()) return null;
      if (filters.overdueOnly)
        return filters.learningStatus === 'all' ? 'overdue' : null;
      return filters.learningStatus;
    },
  );
  protected readonly pageSize = PROGRESS_PAGE_SIZE;
  protected readonly historyPageSize = EXAM_HISTORY_SIZE;
  protected readonly tabs: readonly TabItem[] = [
    { id: 'courses', label: 'Tiến độ khóa học' },
    { id: 'competency', label: 'Năng lực' },
    { id: 'history', label: 'Lịch sử thi' },
  ];
  protected readonly historyResults: readonly SegmentedOption<string>[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'passed', label: 'Đạt' },
    { value: 'failed', label: 'Chưa đạt' },
  ];
  protected readonly statuses: readonly SegmentedOption<ProgressStatusFilter>[] =
    [
      { value: 'all', label: 'Tất cả' },
      { value: 'not_started', label: 'Chưa bắt đầu' },
      { value: 'in_progress', label: 'Đang học' },
      { value: 'completed', label: 'Hoàn thành' },
    ];
  protected readonly columns: readonly {
    key: string;
    label: string;
    sortable?: boolean;
    numeric?: boolean;
  }[] = [
    { key: 'title', label: 'Khóa học' },
    { key: 'progress', label: 'Nội dung đã học' },
    {
      key: 'score',
      label: 'Điểm thi cao nhất',
      sortable: false,
      numeric: true,
    },
    { key: 'status', label: 'Trạng thái', sortable: false },
    { key: 'dueAt', label: 'Hạn hoàn thành' },
    { key: 'startedAt', label: 'Bắt đầu' },
    { key: 'completedAt', label: 'Hoàn thành' },
    { key: 'lastAccessAt', label: 'Truy cập gần nhất' },
  ];
  protected readonly sortOptions = [
    { value: 'lastAccessAt,desc', label: 'Truy cập gần nhất' },
    { value: 'lastAccessAt,asc', label: 'Truy cập cũ nhất' },
    { value: 'title,asc', label: 'Tên khóa học A–Z' },
    { value: 'title,desc', label: 'Tên khóa học Z–A' },
    { value: 'progressPercent,desc', label: 'Tiến độ cao nhất' },
    { value: 'progressPercent,asc', label: 'Tiến độ thấp nhất' },
    { value: 'dueAt,asc', label: 'Hạn hoàn thành gần nhất' },
    { value: 'dueAt,desc', label: 'Hạn hoàn thành xa nhất' },
    { value: 'startedAt,desc', label: 'Bắt đầu gần nhất' },
    { value: 'startedAt,asc', label: 'Bắt đầu cũ nhất' },
    { value: 'completedAt,desc', label: 'Hoàn thành gần nhất' },
    { value: 'completedAt,asc', label: 'Hoàn thành cũ nhất' },
  ];
}
