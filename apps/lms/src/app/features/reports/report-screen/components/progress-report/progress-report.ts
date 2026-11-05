import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Card,
  DataTable,
  DataTableCell,
  Empty,
  ErrorState,
  Badge,
  FmtDatePipe,
  FmtDatetimePipe,
  FmtNumPipe,
  FmtPctPipe,
  Segmented,
  Spinner,
  TablePrimary,
  type DataTableColumn,
  type SegmentedOption,
} from '@lms/ui';
import { ReportScreenStore } from '../../data-access/report-screen.store';
import { PROGRESS_PAGE_SIZE } from '../../data-access/progress-report';
import type { ProgressView } from '../../data-access/report-query';

const COUNT_COLUMNS: readonly DataTableColumn[] = [
  { key: 'enrollments', label: 'Lượt học', sortable: false },
  { key: 'learners', label: 'Học viên', sortable: false },
  { key: 'completed', label: 'Hoàn thành', sortable: false },
  { key: 'inProgress', label: 'Đang học', sortable: false },
  { key: 'notStarted', label: 'Chưa bắt đầu', sortable: false },
  { key: 'overdue', label: 'Quá hạn', sortable: false },
  { key: 'completionRate', label: 'Tỷ lệ hoàn thành', sortable: false },
  { key: 'averageProgress', label: 'Tiến độ TB', sortable: false },
];

/** "Tiến độ & hoàn thành": the server's counts by course or by unit, and the learner list. */
@Component({
  selector: 'app-progress-report',
  imports: [
    RouterLink,
    Card,
    DataTable,
    DataTableCell,
    Empty,
    ErrorState,
    Badge,
    FmtDatePipe,
    FmtDatetimePipe,
    FmtNumPipe,
    FmtPctPipe,
    Segmented,
    Spinner,
    TablePrimary,
  ],
  templateUrl: './progress-report.html',
  styleUrl: './progress-report.scss',
})
export class ProgressReport {
  protected readonly store = inject(ReportScreenStore);
  protected readonly report = this.store.progress;
  protected readonly pageSize = PROGRESS_PAGE_SIZE;
  protected readonly views: readonly SegmentedOption<ProgressView>[] = [
    { value: 'course', label: 'Theo khóa học' },
    { value: 'org', label: 'Theo đơn vị' },
    { value: 'learners', label: 'Theo học viên' },
  ];
  protected readonly groupColumns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Tên', sortable: false },
    ...COUNT_COLUMNS,
  ];
  /** The sortable columns are the server's sort keys. */
  protected readonly learnerColumns: readonly DataTableColumn[] = [
    { key: 'userId', label: 'Mã cán bộ', sortable: false },
    { key: 'fullName', label: 'Học viên', sortable: false },
    { key: 'orgName', label: 'Đơn vị', sortable: false },
    { key: 'course', label: 'Khóa học', sortable: false },
    { key: 'progressPercent', label: 'Tiến độ (%)' },
    { key: 'status', label: 'Trạng thái', sortable: false },
    { key: 'dueAt', label: 'Hạn' },
    { key: 'overdue', label: 'Quá hạn', sortable: false },
    { key: 'lastAccessAt', label: 'Học gần nhất' },
  ];
  protected readonly numberKeys = COUNT_COLUMNS.map((c) => c.key).filter(
    (key) => key !== 'completionRate' && key !== 'averageProgress',
  ) as readonly (
    | 'enrollments'
    | 'learners'
    | 'completed'
    | 'inProgress'
    | 'notStarted'
    | 'overdue'
  )[];
}
