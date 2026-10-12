import { Component, inject } from '@angular/core';
import {
  Breadcrumb,
  Button,
  PageHeader,
  Segmented,
  Stepper,
  TabPanel,
  Tabs,
  type BreadcrumbItem,
  type SegmentedOption,
  type StepperItem,
  type TabItem,
} from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
import { NavSectionStore, type Period } from './data-access/nav-section.store';

@Component({
  selector: 'app-nav-section',
  imports: [
    DsSection,
    DsDemo,
    Segmented,
    Breadcrumb,
    PageHeader,
    Button,
    Stepper,
    Tabs,
    TabPanel,
  ],
  providers: [NavSectionStore],
  templateUrl: './nav-section.html',
})
export class NavSection {
  protected readonly store = inject(NavSectionStore);
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
