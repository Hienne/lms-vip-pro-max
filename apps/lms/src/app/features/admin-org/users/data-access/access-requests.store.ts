import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  identityEndpoints,
  type AccessRequest,
  type AccessRequestKind,
  type AccessRequestsQuery,
  type AccessRequestStatus,
  type Page,
} from '@lms/contracts';
import { AccessRequestsChanged } from '../../../../core/admin/access-requests-changed';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';

export const ACCESS_REQUESTS_PAGE_SIZE = 10;

/**
 * The "Yêu cầu" tab of the Người dùng screen (SPEC-access-requests): what visitors asked for from
 * the sign-in page, waiting for an administrator. The server cuts the list to the caller's unit.
 * The pending count is read on its own, so the tab label shows it while the list is closed.
 */
@Injectable()
export class AccessRequestsStore {
  private readonly client = inject(EndpointClient);
  private readonly changed = inject(AccessRequestsChanged);

  /** The list is read only while its tab is open. */
  private readonly listShown = signal(false);

  private readonly state = {
    query: signal(''),
    kind: signal<AccessRequestKind | ''>(''),
    status: signal<AccessRequestStatus | ''>('PENDING'),
    page: signal(1),
    /** The temporary password of the reset just made; held only until the dialog closes. */
    temporaryPassword: signal<string | null>(null),
    /** The last page the server sent: the table stays while the next one loads. */
    shown: linkedSignal<
      Page<AccessRequest> | undefined,
      Page<AccessRequest> | undefined
    >({
      source: () => this.listData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  /** What the server is asked for; the 1-based table page is the backend's 0-based `page`. */
  private readonly request = computed((): AccessRequestsQuery => {
    const { query, kind, status, page } = this.state;
    return {
      page: page() - 1,
      size: ACCESS_REQUESTS_PAGE_SIZE,
      ...(query().trim() ? { q: query().trim().slice(0, 100) } : {}),
      ...(kind() ? { kind: kind() as AccessRequestKind } : {}),
      ...(status() ? { status: status() as AccessRequestStatus } : {}),
    };
  });

  private readonly listData = serverData(
    (query: AccessRequestsQuery) =>
      this.client.call(identityEndpoints.accessRequests, { query }),
    {
      params: () => (this.listShown() ? this.request() : undefined),
      reloadOn: this.changed,
    },
  );

  /** The total of a one-row page of pending requests: the cheapest count the backend offers. */
  private readonly countData = serverData(
    (query: AccessRequestsQuery) =>
      this.client.call(identityEndpoints.accessRequests, { query }),
    {
      params: () => ({ status: 'PENDING' as const, page: 0, size: 1 }),
      reloadOn: this.changed,
    },
  );

  private readonly rejection = serverMutation(
    (input: { readonly requestId: number; readonly note?: string }) =>
      this.client.call(identityEndpoints.rejectAccessRequest, {
        params: { requestId: input.requestId },
        body: input.note ? { note: input.note } : {},
      }),
    {
      errors: 'toast',
      success: () => 'Đã từ chối yêu cầu',
      invalidates: this.changed,
    },
  );

  private readonly approval = serverMutation(
    (input: { readonly requestId: number; readonly note?: string }) =>
      this.client.call(identityEndpoints.approveAccessRequest, {
        params: { requestId: input.requestId },
        body: input.note ? { note: input.note } : {},
      }),
    {
      errors: 'toast',
      success: () => 'Đã duyệt yêu cầu',
      invalidates: this.changed,
    },
  );

  /** Resets the account of a password-reset request; the answer carries the temporary password once. */
  private readonly passwordReset = serverMutation(
    (input: { readonly requestId: number; readonly note?: string }) =>
      this.client.call(identityEndpoints.resetPasswordForRequest, {
        params: { requestId: input.requestId },
        body: input.note ? { note: input.note } : {},
      }),
    {
      errors: 'alert',
      onSuccess: (result) =>
        this.setTemporaryPassword(result.temporaryPassword),
      invalidates: this.changed,
    },
  );

  readonly query$ = this.state.query.asReadonly();
  readonly kind$ = this.state.kind.asReadonly();
  readonly status$ = this.state.status.asReadonly();
  readonly page$ = this.state.page.asReadonly();

  readonly isLoading$ = computed(
    () => this.listData.isLoading() && this.state.shown() === undefined,
  );
  readonly loadError$ = this.listData.error;
  readonly isRejecting$ = this.rejection.isPending;
  readonly isApproving$ = this.approval.isPending;
  readonly isResettingPassword$ = this.passwordReset.isPending;
  readonly resetPasswordError$ = this.passwordReset.error;
  readonly temporaryPassword$ = this.state.temporaryPassword.asReadonly();

  readonly rows$ = computed(
    (): readonly AccessRequest[] => this.state.shown()?.items ?? [],
  );
  readonly total$ = computed(() => this.state.shown()?.totalElements ?? 0);
  readonly pendingCount$ = computed(
    () => this.countData.value()?.totalElements ?? 0,
  );

  // Setters: the only writers of state
  private setQuery(query: string): void {
    this.state.query.set(query);
  }

  private setKind(kind: AccessRequestKind | ''): void {
    this.state.kind.set(kind);
  }

  private setStatus(status: AccessRequestStatus | ''): void {
    this.state.status.set(status);
  }

  private setTemporaryPassword(password: string | null): void {
    this.state.temporaryPassword.set(password);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  // Commands: a changed filter starts again at the first page
  showList(): void {
    this.listShown.set(true);
  }

  hideList(): void {
    this.listShown.set(false);
  }

  search(query: string): void {
    this.setQuery(query);
    this.setPage(1);
  }

  filterKind(kind: string): void {
    this.setKind(kind as AccessRequestKind | '');
    this.setPage(1);
  }

  filterStatus(status: string): void {
    this.setStatus(status as AccessRequestStatus | '');
    this.setPage(1);
  }

  goToPage(page: number): void {
    this.setPage(page);
  }

  reject(requestId: number, note?: string): void {
    this.rejection.run({ requestId, note: note?.trim() || undefined });
  }

  approve(requestId: number, note?: string): void {
    this.approval.run({ requestId, note: note?.trim() || undefined });
  }

  resetPassword(requestId: number, note?: string): void {
    this.passwordReset.run({ requestId, note: note?.trim() || undefined });
  }

  /** Forgets the temporary password and any refusal; called when the reset dialog closes. */
  clearPasswordReset(): void {
    this.setTemporaryPassword(null);
    this.passwordReset.reset();
  }

  retryLoad(): void {
    this.listData.reload();
  }
}
