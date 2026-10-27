import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Checkbox,
  DataTable,
  DataTableCell,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtRelativePipe,
  Icon,
  PageHeader,
  Progress,
  Search,
  Segmented,
  Skeleton,
  TablePrimary,
  type SegmentedOption,
} from '@lms/ui';
import { ProgressCounts } from '../../../shared/learning/progress-counts/progress-counts';
import { UnavailableNote } from '../../../shared/learning/unavailable-note/unavailable-note';
import { CourseStatus } from '../../../shared/status/course-status';
import {
  PROGRESS_PAGE_SIZE,
  ProgressStore,
  type ProgressStatusFilter,
} from './data-access/progress.store';

/** The learner's progress over all their courses (the mockup's `progress` page, F.8). */
@Component({
  selector: 'app-progress',
  imports: [
    Button,
    Checkbox,
    CourseStatus,
    DataTable,
    DataTableCell,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtRelativePipe,
    Icon,
    PageHeader,
    Progress,
    ProgressCounts,
    RouterLink,
    Search,
    Segmented,
    Skeleton,
    TablePrimary,
    UnavailableNote,
  ],
  providers: [ProgressStore],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
})
export class LearningProgress {
  protected readonly store = inject(ProgressStore);
  protected readonly pageSize = PROGRESS_PAGE_SIZE;
  protected readonly statuses: readonly SegmentedOption<ProgressStatusFilter>[] =
    [
      { value: 'all', label: 'Tất cả' },
      { value: 'not_started', label: 'Chưa bắt đầu' },
      { value: 'in_progress', label: 'Đang học' },
      { value: 'completed', label: 'Hoàn thành' },
    ];
  protected readonly columns = [
    { key: 'title', label: 'Khóa học' },
    { key: 'code', label: 'Mã', sortable: false },
    { key: 'progress', label: 'Tiến độ' },
    { key: 'required', label: 'Bài bắt buộc', sortable: false },
    { key: 'status', label: 'Trạng thái', sortable: false },
    { key: 'startedAt', label: 'Bắt đầu' },
    { key: 'lastAccessAt', label: 'Truy cập gần nhất' },
    { key: 'completedAt', label: 'Hoàn thành' },
    { key: 'dueAt', label: 'Hạn' },
  ];
}
