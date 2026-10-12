import { Component, inject } from '@angular/core';
import {
  Badge,
  Breadcrumb,
  Button,
  PageHeader,
  Segmented,
  SortableItem,
  SortableList,
  Stepper,
  TabPanel,
  Tabs,
  Tree,
  type BadgeTone,
  type BreadcrumbItem,
  type SegmentedOption,
  type StepperItem,
  type TabItem,
  type TreeNode,
} from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
import { NavSectionStore, type Period } from './data-access/nav-section.store';

interface PublishStatus {
  readonly label: string;
  readonly tone: BadgeTone;
}

const DRAFT: PublishStatus = { label: 'Nháp', tone: 'neutral' };
const PAUSED: PublishStatus = { label: 'Tạm dừng', tone: 'warning' };

/** Domain → program → course sample of the mockup's content tree. */
const CONTENT_TREE: readonly TreeNode<PublishStatus>[] = [
  {
    id: 'domain-ops',
    label: 'Nghiệp vụ',
    icon: 'layers',
    children: [
      {
        id: 'program-foundation',
        label: 'Nền tảng Core Banking',
        icon: 'network',
        children: [
          {
            id: 'course-overview',
            label: 'Tổng quan hệ thống Core Banking',
            icon: 'book-open',
          },
          {
            id: 'course-accounts',
            label: 'Tài khoản và giao dịch',
            icon: 'book-open',
            data: DRAFT,
          },
        ],
      },
    ],
  },
  {
    id: 'domain-run',
    label: 'Vận hành',
    icon: 'layers',
    children: [
      {
        id: 'program-eod',
        label: 'Vận hành cuối ngày',
        icon: 'network',
        children: [
          {
            id: 'course-eod',
            label: 'Vận hành cuối ngày (EOD/COB)',
            icon: 'book-open',
            data: PAUSED,
          },
        ],
      },
    ],
  },
];

@Component({
  selector: 'app-nav-section',
  imports: [
    DsSection,
    DsDemo,
    Segmented,
    Breadcrumb,
    PageHeader,
    Button,
    SortableList,
    SortableItem,

    Tree,
    Badge,
    Stepper,
    Tabs,
    TabPanel,
  ],
  providers: [NavSectionStore],
  templateUrl: './nav-section.html',
})
export class NavSection {
  protected readonly store = inject(NavSectionStore);
  protected readonly contentTree = CONTENT_TREE;
  protected readonly trail: readonly BreadcrumbItem[] = [
    { label: 'Khóa học', href: '/design-system' },
    { label: 'Nền tảng nghiệp vụ', href: '/design-system' },
    { label: 'Tổng quan Core Banking' },
  ];
  protected readonly wizardSteps: readonly StepperItem[] = [
    { label: 'Thông tin' },
    { label: 'Nội dung' },
    { label: 'Bài thi' },
    { label: 'Xuất bản' },
  ];
  protected readonly tabItems: readonly TabItem[] = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'courses', label: 'Khóa học', count: 6 },
    { id: 'exams', label: 'Bài thi' },
  ];
  protected readonly periods: readonly SegmentedOption<Period>[] = [
    { value: 'week', label: 'Tuần' },
    { value: 'month', label: 'Tháng' },
    { value: 'quarter', label: 'Quý' },
  ];
}
