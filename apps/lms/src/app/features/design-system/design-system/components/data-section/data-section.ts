import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Avatar,
  AvatarGroup,
  Badge,
  Card,
  FmtBytesPipe,
  FmtDatePipe,
  FmtDatetimePipe,
  FmtDaysLeftPipe,
  FmtMinutesPipe,
  FmtNumPipe,
  FmtPctPipe,
  FmtRelativePipe,
  FmtScorePipe,
  FmtTimePipe,
  Icon,
  Kpi,
  List,
  ListIcon,
  ListItem,
  ListRow,
  Progress,
  Ring,
  SectionCard,
  Stat,
  StatStrip,
  Table,
  TableCell,
  TableCol,
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

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

@Component({
  selector: 'app-data-section',
  imports: [
    DsSection,
    DsDemo,
    RouterLink,
    List,
    ListItem,
    ListIcon,
    ListRow,
    SectionCard,
    Stat,
    StatStrip,
    TableCell,
    TableCol,
    Avatar,
    AvatarGroup,
    Badge,
    Card,
    FmtBytesPipe,
    FmtDatePipe,
    FmtDatetimePipe,
    FmtDaysLeftPipe,
    FmtMinutesPipe,
    FmtNumPipe,
    FmtPctPipe,
    FmtRelativePipe,
    FmtScorePipe,
    FmtTimePipe,
    Icon,
    Kpi,
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
  /** Sample timestamps for the format demo, relative to when the page opened. */
  protected readonly samples = {
    justNow: Date.now() - 10 * 1000,
    minutes: Date.now() - 5 * 60 * 1000,
    hours: Date.now() - 3 * HOUR,
    days: Date.now() - 4 * DAY,
    old: Date.now() - 45 * DAY,
    due: Date.now() + 6.5 * DAY,
    fixed: new Date(2026, 2, 5, 9, 7),
  } as const;
  protected readonly people = [
    'Nguyễn Ngọc Anh',
    'Lê Hoàng Nam',
    'Trần Thị Bích',
    'Đỗ Minh Quân',
  ] as const;
}
