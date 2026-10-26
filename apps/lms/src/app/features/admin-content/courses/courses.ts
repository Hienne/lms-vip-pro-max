import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  DataTableCell,
  DrawerOutlet,
  Empty,
  ErrorState,
  FmtDatePipe,
  FormActions,
  Icon,
  Menu,
  PageHeader,
  Search,
  Select,
  Spinner,
  TablePrimary,
  TableSub,
} from '@lms/ui';
import { RequiredMark } from '../../../shared/course/required-mark';
import {
  CATALOG_STATUS_LABEL,
  CatalogStatus,
} from '../../../shared/status/catalog-status';
import { CopyCourseForm } from './components/copy-course-form/copy-course-form';
import { COURSES_PAGE_SIZE, CoursesStore } from './data-access/courses.store';

/** The authoring list of courses (the mockup's `adminCourses`). */
@Component({
  selector: 'app-courses',
  imports: [
    Button,
    Card,
    CardHeader,
    CatalogStatus,
    CopyCourseForm,
    DataTable,
    DataTableCell,
    DrawerOutlet,
    Empty,
    ErrorState,
    FmtDatePipe,
    FormActions,
    Icon,
    Menu,
    PageHeader,
    RequiredMark,
    RouterLink,
    Search,
    Select,
    Spinner,
    TablePrimary,
    TableSub,
  ],
  providers: [CoursesStore],
  templateUrl: './courses.html',
  styleUrl: './courses.scss',
})
export class Courses {
  protected readonly store = inject(CoursesStore);
  protected readonly pageSize = COURSES_PAGE_SIZE;
  protected readonly statuses = Object.entries(CATALOG_STATUS_LABEL);
}
