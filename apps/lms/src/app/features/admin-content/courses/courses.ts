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
  IconButton,
  Menu,
  PageHeader,
  Search,
  Select,
  Spinner,
  TablePrimary,
  TableSub,
  Tooltip,
} from '@lms/ui';
import {
  CATALOG_STATUS_LABEL,
  CatalogStatus,
} from '../../../shared/status/catalog-status';
import { CourseShares } from './components/course-shares/course-shares';
import { CopyCourseForm } from './components/copy-course-form/copy-course-form';
import { CoursesStore } from './data-access/courses.store';

/** The authoring list of courses (the mockup's `adminCourses`). */
@Component({
  selector: 'app-courses',
  imports: [
    Button,
    Card,
    CardHeader,
    CatalogStatus,
    CopyCourseForm,
    CourseShares,
    DataTable,
    DataTableCell,
    DrawerOutlet,
    Empty,
    ErrorState,
    FmtDatePipe,
    FormActions,
    Icon,
    IconButton,
    Menu,
    PageHeader,
    RouterLink,
    Search,
    Select,
    Spinner,
    TablePrimary,
    TableSub,
    Tooltip,
  ],
  providers: [CoursesStore],
  templateUrl: './courses.html',
  styleUrl: './courses.scss',
})
export class Courses {
  protected readonly store = inject(CoursesStore);
  protected readonly statuses = Object.entries(CATALOG_STATUS_LABEL);
}
