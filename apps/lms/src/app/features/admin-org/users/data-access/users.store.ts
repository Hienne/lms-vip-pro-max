import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  identityEndpoints,
  type AccountStatus,
  type ListUsersQuery,
  type Page,
  type UserSummary,
} from '@lms/contracts';
import type { DataTableSort } from '@lms/ui';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { UserEditorStore } from '../../data-access/user-editor.store';

export const USERS_PAGE_SIZE = 10;

/** A table column's key to the sort field the backend accepts. */
const SORT_FIELD: Readonly<Record<string, string>> = {
  userId: 'id',
  fullName: 'fullName',
};

/** A list row: the table wants an `id`, the user's own key is the staff code. */
export type UserRow = UserSummary & { readonly id: string };

const idParam = (value: string | null): number | undefined => {
  const id = Number(value);
  return value && Number.isInteger(id) ? id : undefined;
};

/**
 * The users list (the mockup's `users` page): the server filters, sorts and pages, scoped to the
 * caller. The filters start from the page URL, so the org screen can link to one team's members.
 */
@Injectable()
export class UsersStore {
  private readonly client = inject(EndpointClient);
  private readonly editor = inject(UserEditorStore);
  private readonly route = inject(ActivatedRoute);

  private readonly state = {
    query: signal(''),
    roleCode: signal(''),
    orgId: signal<number | undefined>(
      idParam(this.route.snapshot.queryParamMap.get('orgId')),
    ),
    teamId: signal<number | undefined>(
      idParam(this.route.snapshot.queryParamMap.get('teamId')),
    ),
    status: signal<AccountStatus | ''>(''),
    sort: signal<DataTableSort | null>(null),
    page: signal(1),
    /** The last page the server sent: the table stays while the next one loads. */
    shown: linkedSignal<
      Page<UserSummary> | undefined,
      Page<UserSummary> | undefined
    >({
      source: () => this.listData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  /** What the server is asked for; the 1-based table page is the backend's 0-based `page`. */
  private readonly request = computed((): ListUsersQuery => {
    const { query, roleCode, orgId, teamId, status, sort, page } = this.state;
    const chosen = status();
    const order = sort();
    const field = order ? SORT_FIELD[order.key] : undefined;
    return {
      page: page() - 1,
      size: USERS_PAGE_SIZE,
      ...(query().trim() ? { q: query().trim().slice(0, 100) } : {}),
      ...(roleCode() ? { roleCode: roleCode() } : {}),
      ...(orgId() !== undefined ? { orgId: orgId() } : {}),
      ...(teamId() !== undefined ? { teamId: teamId() } : {}),
      ...(chosen ? { status: chosen } : {}),
      ...(field && order ? { sort: `${field},${order.dir}` } : {}),
    };
  });

  /** Reloads on the editor's token, so every accepted mutation refreshes the list. */
  private readonly listData = serverData(
    (query: ListUsersQuery) =>
      this.client.call(identityEndpoints.listUsers, { query }),
    { params: () => this.request(), reloadOn: this.editor.changes },
  );

  readonly query$ = this.state.query.asReadonly();
  readonly roleCode$ = this.state.roleCode.asReadonly();
  readonly orgId$ = this.state.orgId.asReadonly();
  readonly teamId$ = this.state.teamId.asReadonly();
  readonly status$ = this.state.status.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly page$ = this.state.page.asReadonly();

  readonly roles$ = this.editor.roles$;
  /** Role names by code; a role the caller cannot list is shown by its code. */
  readonly roleNames$ = computed(() =>
    Object.fromEntries(this.roles$().map((role) => [role.code, role.name])),
  );
  readonly orgs$ = this.editor.orgs$;
  readonly me$ = this.editor.me$;
  readonly isLoading$ = computed(
    () => this.listData.isLoading() && this.state.shown() === undefined,
  );
  readonly loadError$ = this.listData.error;

  readonly rows$ = computed(
    (): readonly UserRow[] =>
      this.state.shown()?.items.map((user) => ({ ...user, id: user.userId })) ??
      [],
  );
  readonly total$ = computed(() => this.state.shown()?.totalElements ?? 0);

  /** Sentence under the title; a caller limited to one org is told which. */
  readonly description$ = computed(() => {
    const me = this.me$();
    return me?.scopeSummary === 'limited' && me.org
      ? `Bạn chỉ thấy và quản lý người dùng thuộc ${me.org.name}.`
      : 'Quản lý tài khoản, vai trò, đơn vị và trạng thái. Tài khoản bị khóa không đăng nhập được.';
  });

  // Setters: the only writers of state
  private setQuery(query: string): void {
    this.state.query.set(query);
  }

  private setRoleCode(roleCode: string): void {
    this.state.roleCode.set(roleCode);
  }

  private setOrgId(orgId: number | undefined): void {
    this.state.orgId.set(orgId);
  }

  private setTeamId(teamId: number | undefined): void {
    this.state.teamId.set(teamId);
  }

  private setStatus(status: AccountStatus | ''): void {
    this.state.status.set(status);
  }

  private setSort(sort: DataTableSort): void {
    this.state.sort.set(sort);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  // Commands: a changed filter or sort starts again at the first page
  search(query: string): void {
    this.setQuery(query);
    this.setPage(1);
  }

  filterRole(roleCode: string): void {
    this.setRoleCode(roleCode);
    this.setPage(1);
  }

  filterOrg(orgId: string): void {
    this.setOrgId(idParam(orgId || null));
    this.setTeamId(undefined);
    this.setPage(1);
  }

  clearTeam(): void {
    this.setTeamId(undefined);
    this.setPage(1);
  }

  filterStatus(status: string): void {
    this.setStatus(status as AccountStatus | '');
    this.setPage(1);
  }

  sortBy(sort: DataTableSort): void {
    this.setSort(sort);
    this.setPage(1);
  }

  goToPage(page: number): void {
    this.setPage(page);
  }

  retryLoad(): void {
    this.listData.reload();
  }
}
