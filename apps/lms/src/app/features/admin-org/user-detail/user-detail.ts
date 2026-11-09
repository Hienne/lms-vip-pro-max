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
  PageHeader,
} from '@lms/ui';
import { DueDate } from '../../../shared/course/due-date';
import { AccountStatus } from '../../../shared/status/account-status';
import { CourseStatus } from '../../../shared/status/course-status';
import { RoleBadge } from '../../../shared/status/role-badge';
import { GrantPicker } from '../components/grant-picker/grant-picker';
import { UserEditor } from '../components/user-editor/user-editor';
import { UserEditorStore } from '../data-access/user-editor.store';
import { UserDetailStore } from './data-access/user-detail.store';
import { XpAdjustForm } from './components/xp-adjust-form/xp-adjust-form';

/**
 * One user (the mockup's `userDetail`): header with the edit and status actions, then the info and
 * the role grants (with the picker to add one) from the backend, and the courses, quiz history and
 * activity tabs that exist only on the mock API.
 */
@Component({
  selector: 'app-user-detail',
  imports: [
    PageHeader,
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
    FmtDatetimePipe,
    FmtRelativePipe,
    GrantPicker,
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
    XpAdjustForm,
  ],
  providers: [UserEditorStore, UserDetailStore],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail {
  protected readonly store = inject(UserDetailStore);

  protected readonly editorStore = inject(UserEditorStore);
}
