import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtDatetimePipe,
  FmtRelativePipe,
  Icon,
  List,
  ListIcon,
  ListItem,
  Progress,
  Spinner,
  TabPanel,
  Table,
  TablePrimary,
  TableSub,
  TableWrap,
  Tabs,
} from '@lms/ui';
import { DueDate } from '../../../shared/course/due-date';
import { AccountStatus } from '../../../shared/status/account-status';
import { CourseStatus } from '../../../shared/status/course-status';
import { isUnitAdmin, RoleBadge } from '../../../shared/status/role-badge';
import { UserEditor } from '../components/user-editor/user-editor';
import { UserEditorStore } from '../data-access/user-editor.store';
import { UserDetailStore } from './data-access/user-detail.store';

/**
 * One user (the mockup's `userDetail`): header with the edit and lock actions, then the courses
 * assigned, the quiz history, the role with the menus it grants, and the account's activity.
 * The competency tab and the extend-deadline button wait for the charts and the assignment screen.
 */
@Component({
  selector: 'app-user-detail',
  imports: [
    AccountStatus,
    Avatar,
    Badge,
    Breadcrumb,
    Button,
    Card,
    CourseStatus,
    DueDate,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtDatetimePipe,
    FmtRelativePipe,
    Icon,
    List,
    ListIcon,
    ListItem,
    Progress,
    RoleBadge,
    RouterLink,
    Spinner,
    TabPanel,
    Table,
    TablePrimary,
    TableSub,
    TableWrap,
    Tabs,
    UserEditor,
  ],
  providers: [UserEditorStore, UserDetailStore],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail {
  protected readonly store = inject(UserDetailStore);
  protected readonly isUnitAdmin = isUnitAdmin;

  protected readonly editorStore = inject(UserEditorStore);
}
