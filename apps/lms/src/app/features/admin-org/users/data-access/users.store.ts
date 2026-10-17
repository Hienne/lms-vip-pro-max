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
  };

  /** What the server is asked for; the 1-based table page is the backend's 0-based `page`. */
  private readonly request = computed((): ListUsersQuery => {
    const { query, roleCode, orgId, teamId, status, sort, page } = this.state;
    const field = sort() ? SORT_FIELD[sort()!.key] : undefined;
    return {
      page: page() - 1,
      size: USERS_PAGE_SIZE,
      ...(query().trim() ? { q: query().trim().slice(0, 100) } : {}),
      ...(roleCode() ? { roleCode: roleCode() } : {}),
      ...(orgId() !== undefined ? { orgId: orgId() } : {}),
      ...(teamId() !== undefined ? { teamId: teamId() } : {}),
      ...(status() ? { status: status() as AccountStatus } : {}),
      ...(field ? { sort: `${field},${sort()!.dir}` } : {}),
    };
  });

  /** Reloads on the editor's token, so every accepted mutation refreshes the list. */
  private readonly listData = serverData(
    (query: ListUsersQuery) =>
      this.client.call(identityEndpoints.listUsers, { query }),
    { params: () => this.request(), reloadOn: this.editor.changes },
  );

  /** The last page the server sent: the table stays while the next one loads. */
  private readonly shown = linkedSignal<
    ReturnType<typeof this.listData.value>,
    ReturnType<typeof this.listData.value>
  >({
    source: this.listData.value,
    computation: (next, previous) => next ?? previous?.value,
  });

  readonly query$ = this.state.query.asReadonly();
  readonly roleCode$ = this.state.roleCode.asReadonly();
  readonly orgId$ = this.state.orgId.asReadonly();
  readonly teamId$ = this.state.teamId.asReadonly();
  readonly status$ = this.state.status.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly page$ = this.state.page.asReadonly();

  readonly roles$ = this.editor.roles$;
  readonly orgs$ = this.editor.orgs$;
  readonly me$ = this.editor.me$;
  readonly isLoading$ = computed(
    () => this.listData.isLoading() && this.shown() === undefined,
  );
  readonly loadError$ = this.listData.error;

  readonly rows$ = computed(
    (): readonly UserRow[] =>
      this.shown()?.items.map((user) => ({ ...user, id: user.userId })) ?? [],
  );
  readonly total$ = computed(() => this.shown()?.totalElements ?? 0);

  /** Sentence under the title; a caller limited to one org is told which. */
  readonly description$ = computed(() => {
    const me = this.me$();
    const scoped = me && !me.grants.some((g) => g.scope.type === 'GLOBAL');
    return scoped && me.org
      ? `Bạn chỉ thấy và quản lý người dùng thuộc ${me.org.name}.`
      : 'Quản lý tài khoản, vai trò, đơn vị và trạng thái. Tài khoản bị khóa không đăng nhập được.';
  });

  search(query: string): void {
    this.state.query.set(query);
    this.state.page.set(1);
  }

  filterRole(roleCode: string): void {
    this.state.roleCode.set(roleCode);
    this.state.page.set(1);
  }

  filterOrg(orgId: string): void {
    this.state.orgId.set(idParam(orgId || null));
    this.state.teamId.set(undefined);
    this.state.page.set(1);
  }

  clearTeam(): void {
    this.state.teamId.set(undefined);
    this.state.page.set(1);
  }

  filterStatus(status: string): void {
    this.state.status.set(status as AccountStatus | '');
    this.state.page.set(1);
  }

  sortBy(sort: DataTableSort): void {
    this.state.sort.set(sort);
    this.state.page.set(1);
  }

  goToPage(page: number): void {
    this.state.page.set(page);
  }

  retryLoad(): void {
    this.listData.reload();
  }
}
