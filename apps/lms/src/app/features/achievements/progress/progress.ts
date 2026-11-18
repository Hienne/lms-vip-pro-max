import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BarChart,
  Badge,
  Button,
  Checkbox,
  DataTable,
  DataTableCell,
  type DataTableColumn,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtDatetimePipe,
  FmtPctPipe,
  FmtRelativePipe,
  Icon,
  PageHeader,
  Progress,
  Search,
  Select,
  Segmented,
  Skeleton,
  TablePrimary,
  TabPanel,
  Tabs,
  type SegmentedOption,
  type TabItem,
} from '@lms/ui';
import { ActivityHeatmap } from '../../../shared/learning/activity-heatmap/activity-heatmap';
import { CompetencyView } from '../../../shared/learning/competency/competency-view';
import { ReviewSuggestions } from '../../../shared/learning/review-suggestions/review-suggestions';
import {
  ProgressCounts,
  type ProgressCountFilter,
} from '../../../shared/learning/progress-counts/progress-counts';
import { CourseStatus } from '../../../shared/status/course-status';
import {
  ProgressStore,
  type ProgressStatusFilter,
} from './data-access/progress.store';

/** The learner's progress over all their courses (the mockup's `progress` page, F.8). */
@Component({
  selector: 'app-progress',
  imports: [
    ActivityHeatmap,
    BarChart,
    Badge,
    Button,
    Checkbox,
    CompetencyView,
    CourseStatus,
    DataTable,
    DataTableCell,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtDatetimePipe,
    FmtPctPipe,
    FmtRelativePipe,
    Icon,
    PageHeader,
    Progress,
    ProgressCounts,
    ReviewSuggestions,
    RouterLink,
    Search,
    Select,
    Segmented,
    Skeleton,
    TablePrimary,
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
  /** The graded attempts as table rows; the server sorts and pages them. */
  protected readonly historyRows$ = computed(() =>
    this.store.filteredAttempts$().map((a) => ({ ...a, id: a.attemptId })),
  );
  protected readonly historyColumns: readonly DataTableColumn[] = [
    { key: 'quizTitle', label: 'Bài kiểm tra', sortable: false },
    { key: 'attemptNo', label: 'Lần thi', sortable: false, nowrap: true },
    {
      key: 'submittedAt',
      label: 'Thời điểm nộp',
      sortable: false,
      nowrap: true,
    },
    { key: 'correct', label: 'Câu đúng', sortable: false, nowrap: true },
    { key: 'score', label: 'Điểm', sortable: false, nowrap: true },
    { key: 'result', label: 'Kết quả', sortable: false, nowrap: true },
  ];
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
  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'title', label: 'Khóa học', width: '22%' },
    { key: 'progress', label: 'Nội dung đã học', width: '17%' },
    { key: 'score', label: 'Điểm thi cao nhất', sortable: false, width: '9%' },
    {
      key: 'status',
      label: 'Trạng thái',
      sortable: false,
      width: '13%',
      nowrap: true,
    },
    { key: 'dueAt', label: 'Hạn hoàn thành', width: '9%', nowrap: true },
    { key: 'startedAt', label: 'Bắt đầu', width: '9%', nowrap: true },
    { key: 'completedAt', label: 'Hoàn thành', width: '10%' },
    { key: 'lastAccessAt', label: 'Truy cập gần nhất', width: '11%' },
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
