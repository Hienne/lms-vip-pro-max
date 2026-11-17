import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  Button,
  Card,
  Chip,
  DrawerOutlet,
  Empty,
  ErrorState,
  Icon,
  PageHeader,
  Pagination,
  Search,
  Segmented,
  Select,
  Skeleton,
  type SegmentedOption,
} from '@lms/ui';
import { CourseCard } from '../../../shared/course/course-card';
import {
  COURSE_STATUS_LABEL,
  LEVEL_LABEL,
  REQUIREMENT_LABEL,
} from '../../../shared/course/course-labels';
import {
  CATALOG_PAGE_SIZE,
  CatalogStore,
  type CatalogScope,
} from './data-access/catalog.store';

const entries = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as [K, string][]).map(([value, label]) => ({
    value,
    label,
  }));

/** The course catalogue (the mockup's `catalog` page), and the learner's assigned courses. */
@Component({
  selector: 'app-catalog',
  imports: [
    Button,
    Card,
    Chip,
    DrawerOutlet,
    NgTemplateOutlet,
    CourseCard,
    Empty,
    ErrorState,
    Icon,
    PageHeader,
    Pagination,
    Search,
    Segmented,
    Select,
    Skeleton,
  ],
  providers: [CatalogStore],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
})
export class Catalog {
  protected readonly store = inject(CatalogStore);
  protected readonly pageSize = CATALOG_PAGE_SIZE;
  protected readonly placeholders = Array.from({ length: 6 }, (_, i) => i);

  protected readonly scopes: readonly SegmentedOption<CatalogScope>[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'mine', label: 'Đã tham gia' },
    { value: 'assigned', label: 'Được giao' },
  ];
  protected readonly levels = entries(LEVEL_LABEL);
  protected readonly requirements = entries(REQUIREMENT_LABEL);
  protected readonly statuses = [
    ...entries(COURSE_STATUS_LABEL),
    { value: 'overdue', label: 'Quá hạn' },
    { value: 'assigned', label: 'Được giao' },
  ];
}
