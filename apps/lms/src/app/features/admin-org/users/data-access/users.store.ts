import { computed, inject, Injectable, signal } from '@angular/core';
import { adminOrgEndpoints, type UserListItem } from '@lms/contracts';
import type { DataTableSort } from '@lms/ui';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { UserEditorStore } from '../../data-access/user-editor.store';

export const USERS_PAGE_SIZE = 10;

const collator = new Intl.Collator('vi');

/** The sortable columns' values; a user who never signed in sorts as the empty string. */
function sortValue(user: UserListItem, key: string): string {
  switch (key) {
    case 'roleName':
      return user.roleName;
    case 'unitName':
      return `${user.unitName} ${user.groupName}`;
    case 'status':
      return user.status;
    case 'lastLoginAt':
      return user.lastLoginAt ?? '';
    default:
      return user.name;
  }
}

/** The users list (the mockup's `users` page): filters, sorting and paging over the server's list. */
@Injectable()
export class UsersStore {
  private readonly client = inject(EndpointClient);
  private readonly editor = inject(UserEditorStore);

  private readonly state = {
    query: signal(''),
    role: signal(''),
    unit: signal(''),
    status: signal(''),
    sort: signal<DataTableSort | null>(null),
    page: signal(1),
  };

  /** Reloads on the editor's token, so every accepted mutation refreshes the list. */
  private readonly listData = serverData(
    () => this.client.call(adminOrgEndpoints.users),
    {
      reloadOn: this.editor.changes,
    },
  );

  readonly query$ = this.state.query.asReadonly();
  readonly role$ = this.state.role.asReadonly();
  readonly unit$ = this.state.unit.asReadonly();
  readonly status$ = this.state.status.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();

  readonly meta$ = this.editor.meta$;
  readonly me$ = this.editor.me$;
  readonly isLoading$ = this.listData.isLoading;
  readonly loadError$ = this.listData.error;

  /** Sentence under the title; a caller limited to one unit is told which. */
  readonly description$ = computed(() => {
    const scope = this.editor.me$()?.scopeUnitId;
    const unit = this.editor.meta$()?.allUnits.find((u) => u.id === scope);
    return unit
      ? `Bạn là quản trị viên đơn vị — chỉ thấy và quản lý người dùng thuộc ${unit.name}.`
      : 'Quản lý tài khoản, vai trò, đơn vị và trạng thái. Tài khoản bị khóa không đăng nhập được.';
  });

  /** Roles present in the list, for the role filter. */
  readonly roleOptions$ = computed(() => {
    const names = new Map(
      (this.listData.value() ?? []).map((u) => [u.roleId, u.roleName]),
    );
    return [...names]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => collator.compare(a.label, b.label));
  });

  private readonly filtered = computed(() => {
    const query = this.state.query().trim().toLowerCase();
    const role = this.state.role();
    const unit = this.state.unit();
    const status = this.state.status();
    return (this.listData.value() ?? []).filter(
      (u) =>
        (!query ||
          `${u.name} ${u.email} ${u.staffCode}`
            .toLowerCase()
            .includes(query)) &&
        (!role || u.roleId === role) &&
        (!unit || u.unitId === unit) &&
        (!status || u.status === status),
    );
  });

  private readonly sorted = computed(() => {
    const sort = this.state.sort();
    if (!sort) return this.filtered();
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...this.filtered()].sort(
      (a, b) =>
        sign * collator.compare(sortValue(a, sort.key), sortValue(b, sort.key)),
    );
  });

  readonly total$ = computed(() => this.sorted().length);
  /** The requested page, held inside the page count after a filter shrinks the list. */
  readonly page$ = computed(() =>
    Math.min(
      this.state.page(),
      Math.max(1, Math.ceil(this.total$() / USERS_PAGE_SIZE)),
    ),
  );
  readonly rows$ = computed(() => {
    const start = (this.page$() - 1) * USERS_PAGE_SIZE;
    return this.sorted().slice(start, start + USERS_PAGE_SIZE);
  });

  private setQuery(value: string): void {
    this.state.query.set(value);
  }

  private setRole(value: string): void {
    this.state.role.set(value);
  }

  private setUnit(value: string): void {
    this.state.unit.set(value);
  }

  private setStatus(value: string): void {
    this.state.status.set(value);
  }

  private setSort(sort: DataTableSort | null): void {
    this.state.sort.set(sort);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  search(query: string): void {
    this.setQuery(query);
    this.setPage(1);
  }

  filterRole(roleId: string): void {
    this.setRole(roleId);
    this.setPage(1);
  }

  filterUnit(unitId: string): void {
    this.setUnit(unitId);
    this.setPage(1);
  }

  filterStatus(status: string): void {
    this.setStatus(status);
    this.setPage(1);
  }

  sortBy(sort: DataTableSort): void {
    this.setSort(sort);
  }

  goToPage(page: number): void {
    this.setPage(page);
  }

  retryLoad(): void {
    this.listData.reload();
  }
}
