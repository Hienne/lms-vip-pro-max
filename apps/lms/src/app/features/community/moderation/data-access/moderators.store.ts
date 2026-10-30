import { Dialog } from '@angular/cdk/dialog';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  communityEndpoints,
  type ModeratorStatus,
  type ModeratorView,
  type PersonRef,
} from '@lms/contracts';
import { forkJoin, map, switchMap, timer } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import { CommunityChanges } from '../../data-access/community-changes';
import { reloadOnConflict } from '../../data-access/conflict';

const MODERATORS_PAGE_SIZE = 100;
const CANDIDATES = 10;
const SEARCH_DELAY_MS = 300;
const APPOINTING_ROLES = ['ADMIN', 'SUPER_ADMIN'];

/** The drawer: appoint someone new, or revoke or re-grant an existing moderator. */
export type ModeratorEdit =
  | { readonly kind: 'grant' }
  | { readonly kind: 'revoke' | 'regrant'; readonly moderator: ModeratorView };

/**
 * Người điều phối (CM-08): the moderators of the user's unit, for an ADMIN of the unit; a 403
 * hides the tab. Appointing picks from the unit's active staff (C141).
 */
@Injectable()
export class ModeratorsStore {
  private readonly client = inject(EndpointClient);
  private readonly changes = inject(CommunityChanges);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);

  private readonly state = {
    status: signal<ModeratorStatus>('active'),
    edit: signal<ModeratorEdit | undefined>(undefined),
    candidateQuery: signal(''),
  };

  private readonly orgId = computed(() => this.session.user$()?.org?.id);

  /**
   * Display only: an ADMIN appoints moderators (C42), and a moderator may also read the list, so
   * the tab follows the role. The server checks every grant again.
   */
  readonly canAppoint$ = computed(
    () =>
      this.session
        .user$()
        ?.grants.some((grant) => APPOINTING_ROLES.includes(grant.roleCode)) ??
      false,
  );

  private readonly listData = serverData(
    ({ orgId, status }: { orgId: number; status: ModeratorStatus }) =>
      this.client.call(communityEndpoints.moderators, {
        query: { orgId, status, size: MODERATORS_PAGE_SIZE },
      }),
    {
      params: () => {
        const orgId = this.orgId();
        return orgId && this.canAppoint$()
          ? { orgId, status: this.state.status() }
          : undefined;
      },
      reloadOn: this.changes.moderators,
    },
  );

  private readonly candidatesData = serverData(
    ({ orgId, q }: { orgId: number; q: string }) =>
      timer(SEARCH_DELAY_MS).pipe(
        switchMap(() =>
          this.client.call(communityEndpoints.moderatorCandidates, {
            query: { orgId, size: CANDIDATES, ...(q ? { q } : {}) },
          }),
        ),
      ),
    {
      params: () => {
        const orgId = this.orgId();
        return orgId && this.state.edit()?.kind === 'grant'
          ? { orgId, q: this.state.candidateQuery().trim().slice(0, 100) }
          : undefined;
      },
    },
  );

  /**
   * Every grant the unit has, active and revoked (C140 lists one status at a time): active ones
   * leave the picker, and a revoked one gives the version to send when that person is appointed
   * again.
   */
  private readonly allData = serverData(
    (orgId: number) =>
      forkJoin(
        (['active', 'revoked'] as const).map((status) =>
          this.client.call(communityEndpoints.moderators, {
            query: { orgId, status, size: MODERATORS_PAGE_SIZE },
          }),
        ),
      ).pipe(map((pages) => pages.flatMap((page) => page.items))),
    {
      params: () =>
        this.state.edit()?.kind === 'grant' ? this.orgId() : undefined,
      reloadOn: this.changes.moderators,
    },
  );

  private readonly saveMutation = serverMutation(
    ({
      userId,
      active,
      reason,
    }: {
      userId: string;
      active: boolean;
      reason: string;
    }) => {
      const orgId = this.orgId();
      if (!orgId) throw new Error('The user has no unit');
      const known = this.knownGrant(userId);
      return this.client
        .call(communityEndpoints.setModerator, {
          params: { userId },
          body: { orgId, active, reason, expectedVersion: known?.version ?? 0 },
        })
        .pipe(
          reloadOnConflict(this.dialog, () => this.changes.moderators.bump()),
        );
    },
    {
      errors: 'alert',
      success: ({ active }) =>
        active ? 'Đã bổ nhiệm người điều phối' : 'Đã thu hồi quyền điều phối',
      invalidates: this.changes.moderators,
      onSuccess: () => this.setEdit(undefined),
    },
  );

  // Selectors
  readonly status$ = this.state.status.asReadonly();
  readonly moderators$ = computed(() => this.listData.value()?.items ?? []);
  readonly isLoading$ = this.listData.isLoading;
  readonly loadError$ = this.listData.error;
  readonly isForbidden$ = computed(
    () => this.listData.error()?.kind === 'forbidden',
  );
  readonly edit$ = this.state.edit.asReadonly();
  readonly candidateQuery$ = this.state.candidateQuery.asReadonly();
  readonly candidates$ = computed((): readonly PersonRef[] => {
    const active = new Set(
      (this.allData.value() ?? [])
        .filter((m) => m.status === 'active')
        .map((m) => m.userId),
    );
    return (this.candidatesData.value()?.items ?? []).filter(
      (person) => !active.has(person.userId),
    );
  });
  readonly candidatesLoading$ = this.candidatesData.isLoading;
  readonly isSaving$ = this.saveMutation.isPending;
  readonly saveError$ = this.saveMutation.error;

  // Setters
  private setStatus(status: ModeratorStatus): void {
    this.state.status.set(status);
  }

  private setEdit(edit: ModeratorEdit | undefined): void {
    this.state.edit.set(edit);
    this.state.candidateQuery.set('');
    this.saveMutation.reset();
  }

  // Commands
  showStatus(status: ModeratorStatus): void {
    this.setStatus(status);
  }

  startEdit(edit: ModeratorEdit): void {
    this.setEdit(edit);
  }

  cancelEdit(): void {
    this.setEdit(undefined);
  }

  searchCandidates(q: string): void {
    this.state.candidateQuery.set(q);
  }

  save(userId: string, reason: string): void {
    const edit = this.state.edit();
    if (!edit) return;
    this.saveMutation.run({ userId, active: edit.kind !== 'revoke', reason });
  }

  retryLoad(): void {
    this.listData.reload();
  }

  private knownGrant(userId: string): ModeratorView | undefined {
    const edit = this.state.edit();
    if (edit && edit.kind !== 'grant') return edit.moderator;
    return (this.allData.value() ?? []).find((m) => m.userId === userId);
  }
}
