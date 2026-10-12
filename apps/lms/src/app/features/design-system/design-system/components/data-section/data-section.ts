import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Avatar,
  AvatarGroup,
  Badge,
  Card,
  Icon,
  List,
  ListIcon,
  ListItem,
  Progress,
  Ring,
  Table,
  TableWrap,
  type BadgeTone,
} from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

/** Rows of the mockup's sample table (pages/design-system.js). */
const SAMPLE_ROWS: readonly {
  readonly code: string;
  readonly title: string;
  readonly pct: number;
  readonly status: string;
  readonly tone: BadgeTone;
  readonly outline: boolean;
}[] = [
  {
    code: 'NV-101',
    title: 'Tổng quan hệ thống Core Banking',
    pct: 82,
    status: 'Đã xuất bản',
    tone: 'success',
    outline: false,
  },
  {
    code: 'VH-201',
    title: 'Quy trình quản lý thay đổi',
    pct: 54,
    status: 'Đã xuất bản',
    tone: 'success',
    outline: false,
  },
  {
    code: 'VH-301',
    title: 'Vận hành cuối ngày (EOD/COB)',
    pct: 23,
    status: 'Tạm dừng',
    tone: 'warning',
    outline: false,
  },
  {
    code: 'CN-101',
    title: 'An toàn thông tin cho cán bộ CNTT',
    pct: 0,
    status: 'Nháp',
    tone: 'neutral',
    outline: true,
  },
];

const LIST_ITEMS = [
  { title: 'Tổng quan Core Banking', icon: 'layers' },
  { title: 'Quy trình thay đổi', icon: 'workflow' },
] as const;

@Component({
  selector: 'app-data-section',
  imports: [
    DsSection,
    DsDemo,
    RouterLink,
    List,
    ListItem,
    ListIcon,
    Avatar,
    AvatarGroup,
    Badge,
    Card,
    Icon,
    Progress,
    Ring,
    Table,
    TableWrap,
  ],
  templateUrl: './data-section.html',
  styleUrl: './data-section.scss',
})
export class DataSection {
  protected readonly rows = SAMPLE_ROWS;
  protected readonly listItems = LIST_ITEMS;
  protected readonly people = [
    'Nguyễn Ngọc Anh',
    'Lê Hoàng Nam',
    'Trần Thị Bích',
    'Đỗ Minh Quân',
  ] as const;
}
