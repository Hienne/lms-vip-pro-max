import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  DataTable,
  DataTableCell,
  Empty,
  ErrorState,
  Icon,
  PageHeader,
  Search,
  Select,
  Spinner,
  TablePrimary,
  TableSub,
} from '@lms/ui';
import { AccountStatus } from '../../../shared/status/account-status';
import { RoleBadge } from '../../../shared/status/role-badge';
import { UserEditor } from '../components/user-editor/user-editor';
import { UserEditorStore } from '../data-access/user-editor.store';
import { USERS_PAGE_SIZE, UsersStore } from './data-access/users.store';

/** The users list (the mockup's `users` page): find, add, edit, lock and unlock accounts. */
@Component({
  selector: 'app-users',
  imports: [
    AccountStatus,
    Avatar,
    Button,
    Card,
    CardHeader,
    DataTable,
    DataTableCell,
    Empty,
    ErrorState,
    Icon,
    PageHeader,
    RoleBadge,
    RouterLink,
    Search,
    Select,
    Spinner,
    TablePrimary,
    TableSub,
    UserEditor,
  ],
  providers: [UserEditorStore, UsersStore],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users {
  protected readonly store = inject(UsersStore);
  protected readonly pageSize = USERS_PAGE_SIZE;
  protected readonly editorStore = inject(UserEditorStore);

  /** A role's display name from the lookup; a role the caller cannot list keeps its code. */
  protected roleName(code: string): string {
    return this.store.roles$().find((role) => role.code === code)?.name ?? code;
  }
}
