import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BarChart,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  DataTableCell,
  DonutChart,
  Empty,
  ErrorState,
  Icon,
  Kpi,
  PageHeader,
  Progress,
  RadarChart,
  Search,
  Select,
  Spinner,
  type DataTableColumn,
} from '@lms/ui';
import {
  ReportScreenStore,
  REPORT_DIMENSIONS,
} from './data-access/report-screen.store';
@Component({
  selector: 'app-report-screen',
  imports: [
    RouterLink,
    BarChart,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    CardHeader,
    DataTable,
    DataTableCell,
    DonutChart,
    Empty,
    ErrorState,
    Icon,
    Kpi,
    PageHeader,
    Progress,
    RadarChart,
    Search,
    Select,
    Spinner,
  ],
  providers: [ReportScreenStore],
  templateUrl: './report-screen.html',
  styleUrl: './report-screen.scss',
})
export class ReportScreen {
  protected readonly store = inject(ReportScreenStore);
  protected readonly dims = REPORT_DIMENSIONS;
  protected readonly courseColumns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Khóa học', sortable: false },
    { key: 'enrolments', label: 'Học viên', sortable: false },
    { key: 'pct', label: 'Tiến độ TB', sortable: false },
    { key: 'completed', label: 'Hoàn thành', sortable: false },
    { key: 'overdue', label: 'Quá hạn', sortable: false },
    { key: 'avgScore', label: 'Điểm TB', sortable: false },
    { key: 'passRate', label: 'Tỷ lệ đạt', sortable: false },
  ];
  protected print(): void {
    window.print();
  }
}
