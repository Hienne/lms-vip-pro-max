import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  Input,
  Kpi,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  Table,
  TableWrap,
} from '@lms/ui';
import { ReportScreenStore } from './data-access/report-screen.store';

@Component({
  selector: 'app-report-screen',
  imports: [
    DatePipe,
    RouterLink,
    Button,
    Card,
    ErrorState,
    Icon,
    Input,
    Kpi,
    PageHeader,
    Pagination,
    Select,
    Spinner,
    Table,
    TableWrap,
  ],
  providers: [ReportScreenStore],
  templateUrl: './report-screen.html',
  styleUrl: './report-screen.scss',
})
export class ReportScreen {
  protected readonly store = inject(ReportScreenStore);
  protected readonly dims = [
    ['learners', 'Học viên'],
    ['courses', 'Khóa học'],
    ['programs', 'Chương trình'],
    ['groups', 'Phòng / nhóm'],
    ['units', 'Đơn vị'],
    ['status', 'Trạng thái hoàn thành'],
    ['results', 'Kết quả kiểm tra'],
    ['competency', 'Năng lực'],
  ];
}
