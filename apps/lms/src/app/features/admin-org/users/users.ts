import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  TabPanel,
  Tabs,
  type TabItem,
} from '@lms/ui';
import { AccountStatus } from '../../../shared/status/account-status';
import { RoleBadge } from '../../../shared/status/role-badge';
import { AccessRequests } from './components/access-requests/access-requests';
import { UserEditor } from '../components/user-editor/user-editor';
import { UserEditorStore } from '../data-access/user-editor.store';
import { AccessRequestsStore } from './data-access/access-requests.store';
import { USERS_PAGE_SIZE, UsersStore } from './data-access/users.store';

/** The users list (the mockup's `users` page): find, add, edit, lock and unlock accounts. */
@Component({
  selector: 'app-users',
  imports: [
    AccessRequests,
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
    TabPanel,
    Tabs,
    UserEditor,
  ],
  providers: [UserEditorStore, UsersStore, AccessRequestsStore],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users {
  protected readonly store = inject(UsersStore);
  protected readonly pageSize = USERS_PAGE_SIZE;
  protected readonly editorStore = inject(UserEditorStore);
  private readonly requests = inject(AccessRequestsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly tabParam = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** `?tab=requests` opens the requests; anything else is the user list. */
  protected readonly tab = computed(() =>
    this.tabParam().get('tab') === 'requests' ? 'requests' : 'users',
  );

  protected readonly tabs = computed((): readonly TabItem[] => {
    const pending = this.requests.pendingCount$();
    return [
      { id: 'users', label: 'Người dùng' },
      {
        id: 'requests',
        label: 'Yêu cầu',
        ...(pending > 0 ? { count: pending } : {}),
      },
    ];
  });

  protected selectTab(id: string): void {
    // The tab list reports its initial selection too; only a real change is a navigation.
    if (id === this.tab()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id === 'requests' ? 'requests' : null },
      queryParamsHandling: 'merge',
    });
  }
}
