import { Dialog } from '@angular/cdk/dialog';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  communityEndpoints,
  communityMediaEndpoints,
  communityReviewEndpoints as review,
  type ReviewInvitation,
  type ReviewThread,
  VisibilitySchema,
} from '@lms/contracts';
import { confirm } from '@lms/ui';
import { EMPTY, filter, map, switchMap, tap, type Observable } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { CommunityChanges } from '../../data-access/community-changes';
import { reloadOnConflict } from '../../data-access/conflict';
import {
  askReviewAction,
  type ReviewActionDraft,
} from '../components/review-action-dialog/review-action-dialog';

type Tab = 'design' | 'invitations' | 'conclusion';
type Command =
  | { kind: 'open' | 'invite' | 'conclude' | 'close' | 'follow_up' }
  | { kind: 'thread'; thread: ReviewThread; action: 'resolve' | 'reopen' }
  | {
      kind: 'respond';
      invitation: ReviewInvitation;
      action: 'accept' | 'decline' | 'complete' | 'cancel';
    };
type ThreadQuery = {
  contentId: number;
  revisionId: number;
  status?: 'open' | 'resolved';
  page: number;
};
type PageInput = { contentId: number; page: number };

@Injectable()
export class ReviewDetailStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly files = inject(FileSaver);
  private readonly changes = inject(CommunityChanges);
  private readonly state = {
    tab: signal<Tab>('design'),
    selectedRevision: signal<number | undefined>(undefined),
    threadStatus: signal<'' | 'open' | 'resolved'>(''),
    threadPage: signal(1),
    invitationPage: signal(1),
    historyPage: signal(1),
    requestId: signal(crypto.randomUUID()),
    posted: signal(0),
  };
  readonly id$ = toSignal(
    this.route.paramMap.pipe(
      map((p) => {
        const id = Number(p.get('id'));
        return Number.isSafeInteger(id) && id > 0 ? id : undefined;
      }),
      tap(() => this.resetRoute()),
    ),
  );
  private readonly refresh = invalidation();
  private readonly detail = serverData(
    (contentId: number) =>
      this.client.call(review.detail, { params: { contentId } }),
    { params: () => this.id$(), reloadOn: this.refresh },
  );
  private readonly history = serverData(
    ({ contentId, page }: PageInput) =>
      this.client.call(communityEndpoints.revisions, {
        params: { contentId },
        query: { page: page - 1, size: 20 },
      }),
    {
      params: () => {
        const contentId = this.id$();
        return contentId
          ? { contentId, page: this.state.historyPage() }
          : undefined;
      },
      reloadOn: this.refresh,
    },
  );
  private readonly revision = serverData(
    ({ contentId, revisionId }: { contentId: number; revisionId: number }) =>
      this.client.call(communityEndpoints.revision, {
        params: { contentId, revisionId },
      }),
    {
      params: () => {
        const contentId = this.id$();
        const revisionId = this.selectedRevisionId$();
        return contentId && revisionId ? { contentId, revisionId } : undefined;
      },
      reloadOn: this.refresh,
    },
  );
  private readonly threads = serverData(
    ({ contentId, ...query }: ThreadQuery) =>
      this.client.call(review.threads, {
        params: { contentId },
        query: { ...query, page: query.page - 1, size: 20 },
      }),
    {
      params: () => {
        const contentId = this.id$();
        const revisionId = this.selectedRevisionId$();
        const status = this.state.threadStatus();
        return contentId && revisionId
          ? {
              contentId,
              revisionId,
              ...(status ? { status } : {}),
              page: this.state.threadPage(),
            }
          : undefined;
      },
      reloadOn: this.refresh,
    },
  );
  private readonly invitations = serverData(
    ({ contentId, page }: PageInput) =>
      this.client.call(review.invitations, {
        params: { contentId },
        query: { page: page - 1, size: 20 },
      }),
    {
      params: () => {
        const contentId = this.id$();
        return contentId && this.state.tab() === 'invitations'
          ? { contentId, page: this.state.invitationPage() }
          : undefined;
      },
      reloadOn: this.refresh,
    },
  );
  private readonly mutation = serverMutation(
    (command: Command) =>
      this.execute(command).pipe(
        reloadOnConflict(this.dialog, () => this.refresh.bump()),
      ),
    {
      errors: 'toast',
      success: () => 'Đã cập nhật hồ sơ review',
      invalidates: [this.refresh, this.changes.contents],
      onSuccess: (result) => {
        if (result.editId)
          void this.router.navigate([
            '/community/reviews',
            result.editId,
            'edit',
          ]);
      },
    },
  );
  private readonly createThread = serverMutation(
    ({ section, body }: { section: string; body: string }) =>
      this.client
        .call(review.createThread, {
          params: { contentId: this.requireId() },
          body: {
            clientRequestId: this.state.requestId(),
            revisionId: this.requireRevisionId(),
            anchor: { type: 'section', section },
            bodyMarkdown: body,
          },
        })
        .pipe(reloadOnConflict(this.dialog, () => this.refresh.bump())),
    {
      errors: 'toast',
      success: () => 'Đã gửi góp ý',
      invalidates: [this.refresh, this.changes.contents],
      onSuccess: () => {
        this.setPosted(this.state.posted() + 1);
        this.setRequestId(crypto.randomUUID());
      },
    },
  );
  private readonly download = serverMutation(
    ({ revisionAssetId, name }: { revisionAssetId: number; name: string }) =>
      this.client
        .call(communityMediaEndpoints.content, { params: { revisionAssetId } })
        .pipe(map((blob) => ({ blob, name }))),
    {
      errors: 'toast',
      onSuccess: ({ blob, name }) => this.files.save(blob, name),
    },
  );

  readonly detail$ = this.detail.value;
  readonly isLoading$ = this.detail.isLoading;
  readonly error$ = this.detail.error;
  readonly tab$ = this.state.tab.asReadonly();
  readonly selectedRevisionId$ = computed(
    () =>
      this.state.selectedRevision() ??
      this.detail.value()?.publishedRevision?.revisionId,
  );
  readonly revision$ = this.revision.value;
  readonly revisionLoading$ = this.revision.isLoading;
  readonly revisionError$ = this.revision.error;
  readonly history$ = computed(
    () =>
      this.history
        .value()
        ?.items.filter((r) =>
          ['published', 'superseded'].includes(r.revisionStatus),
        ) ?? [],
  );
  readonly historyTotal$ = computed(
    () => this.history.value()?.totalElements ?? 0,
  );
  readonly historyError$ = this.history.error;
  readonly historyPage$ = this.state.historyPage.asReadonly();
  readonly threads$ = computed(() => this.threads.value()?.items ?? []);
  readonly threadsTotal$ = computed(
    () => this.threads.value()?.totalElements ?? 0,
  );
  readonly threadsLoading$ = this.threads.isLoading;
  readonly threadsError$ = this.threads.error;
  readonly threadPage$ = this.state.threadPage.asReadonly();
  readonly threadStatus$ = this.state.threadStatus.asReadonly();
  readonly invitations$ = computed(() => this.invitations.value()?.items ?? []);
  readonly invitationsTotal$ = computed(
    () => this.invitations.value()?.totalElements ?? 0,
  );
  readonly invitationsLoading$ = this.invitations.isLoading;
  readonly invitationsError$ = this.invitations.error;
  readonly invitationPage$ = this.state.invitationPage.asReadonly();
  readonly busy$ = computed(
    () => this.mutation.isPending() || this.createThread.isPending(),
  );
  readonly downloading$ = this.download.isPending;
  readonly posted$ = this.state.posted.asReadonly();
  readonly canComment$ = computed(
    () => this.detail.value()?.reviewCapabilities.includes('comment') ?? false,
  );
  readonly title$ = computed(
    () =>
      (
        this.detail.value()?.publishedRevision ??
        this.detail.value()?.draftRevision
      )?.title ?? 'Review kiến trúc',
  );
  readonly designAssets$ = computed(
    () =>
      this.revision.value()?.assets?.filter((a) => a.usage === 'design_file') ??
      [],
  );

  private setTab(value: Tab): void {
    this.state.tab.set(value);
  }
  private setSelectedRevision(value: number | undefined): void {
    this.state.selectedRevision.set(value);
  }
  private setThreadStatus(value: '' | 'open' | 'resolved'): void {
    this.state.threadStatus.set(value);
  }
  private setThreadPage(value: number): void {
    this.state.threadPage.set(value);
  }
  private setInvitationPage(value: number): void {
    this.state.invitationPage.set(value);
  }
  private setHistoryPage(value: number): void {
    this.state.historyPage.set(value);
  }
  private setPosted(value: number): void {
    this.state.posted.set(value);
  }
  private setRequestId(value: ReturnType<typeof crypto.randomUUID>): void {
    this.state.requestId.set(value);
  }
  showTab(value: Tab): void {
    this.setTab(value);
  }
  selectRevision(value: string): void {
    const id = Number(value);
    if (id > 0) {
      this.setSelectedRevision(id);
      this.setThreadPage(1);
    }
  }
  filterThreads(value: '' | 'open' | 'resolved'): void {
    this.setThreadStatus(value);
    this.setThreadPage(1);
  }
  threadPage(value: number): void {
    this.setThreadPage(value);
  }
  invitationPage(value: number): void {
    this.setInvitationPage(value);
  }
  historyPage(value: number): void {
    this.setHistoryPage(value);
  }
  act(command: Command): void {
    if (!this.busy$()) this.mutation.run(command);
  }
  postThread(section: string, body: string): void {
    if (!this.busy$())
      this.createThread.run({ section: section.trim(), body: body.trim() });
  }
  downloadDesign(revisionAssetId: number, name: string): void {
    this.download.run({ revisionAssetId, name });
  }
  retry(): void {
    this.refresh.bump();
  }
  private resetRoute(): void {
    this.setTab('design');
    this.setSelectedRevision(undefined);
    this.setThreadStatus('');
    this.setThreadPage(1);
    this.setInvitationPage(1);
    this.setHistoryPage(1);
    this.setRequestId(crypto.randomUUID());
    this.setPosted(0);
  }
  private requireId(): number {
    const id = this.id$();
    if (!id) throw new Error('Missing review id');
    return id;
  }
  private requireRevisionId(): number {
    const id = this.selectedRevisionId$();
    if (!id) throw new Error('Missing review revision');
    return id;
  }

  private execute(command: Command): Observable<{ editId?: number }> {
    const detail = this.detail.value();
    if (!detail) return EMPTY;
    const params = { contentId: detail.contentId };
    const expectedContentVersion = detail.contentVersion;
    const done = () => ({});
    const answered = (
      draft: ReviewActionDraft | undefined,
    ): draft is ReviewActionDraft => draft !== undefined;
    switch (command.kind) {
      case 'invite':
        return askReviewAction(this.dialog, 'invite').pipe(
          filter(answered),
          switchMap((draft) =>
            this.client.call(review.invite, {
              params,
              body: {
                reviewerUserIds: [
                  ...new Set(draft.text.split(/[\s,;]+/).filter(Boolean)),
                ],
                ...(draft.expiresAt
                  ? { expiresAt: new Date(draft.expiresAt).toISOString() }
                  : {}),
              },
            }),
          ),
          map(done),
        );
      case 'thread':
        return askReviewAction(this.dialog, command.action).pipe(
          filter(answered),
          switchMap((draft) =>
            this.client.call(review.threadAction, {
              params: { threadId: command.thread.threadId },
              body: {
                expectedVersion: command.thread.version,
                action: command.action,
                note: draft.text.trim(),
              },
            }),
          ),
          map(done),
        );
      case 'conclude': {
        const revision = detail.publishedRevision;
        if (!revision) return EMPTY;
        return askReviewAction(this.dialog, 'conclude').pipe(
          filter(answered),
          switchMap((draft) =>
            this.client.call(review.conclude, {
              params,
              body: {
                expectedContentVersion,
                concludedRevisionId: revision.revisionId,
                conclusion: draft.text.trim(),
              },
            }),
          ),
          map(done),
        );
      }
      case 'close':
        return askReviewAction(this.dialog, 'close').pipe(
          filter(answered),
          switchMap((draft) =>
            this.client.call(review.close, {
              params,
              body: { expectedContentVersion, reason: draft.text.trim() },
            }),
          ),
          map(done),
        );
      case 'open':
        return confirm(this.dialog, {
          title: 'Mở lấy ý kiến?',
          message:
            'Mọi người có quyền đọc có thể góp ý vào phiên bản thiết kế đã đăng.',
          confirmLabel: 'Mở lấy ý kiến',
        }).pipe(
          filter(Boolean),
          switchMap(() =>
            this.client.call(review.open, {
              params,
              body: {
                expectedContentVersion,
                action: 'open_review',
                reason: 'Mở lấy ý kiến thiết kế',
              },
            }),
          ),
          map(done),
        );
      case 'respond':
        return this.client
          .call(review.respond, {
            params: { invitationId: command.invitation.invitationId },
            body: {
              expectedVersion: command.invitation.version,
              action: command.action,
            },
          })
          .pipe(map(done));
      case 'follow_up': {
        const revision = detail.publishedRevision;
        if (!revision) return EMPTY;
        return confirm(this.dialog, {
          title: 'Tạo vòng review tiếp theo?',
          message:
            'Tạo bản nháp mới từ thiết kế này và giữ nguyên hồ sơ đã chốt.',
          confirmLabel: 'Tạo bản nháp',
        }).pipe(
          filter(Boolean),
          switchMap(() =>
            this.client.call(review.followUp, {
              params,
              body: {
                clientRequestId: this.state.requestId(),
                sourceRevisionId: revision.revisionId,
                title: revision.title,
                bodyMarkdown: revision.bodyMarkdown,
                summary: revision.summary ?? undefined,
                visibility: VisibilitySchema.parse(detail.visibility),
                primaryGuildId: detail.primaryGuildId ?? undefined,
                tagIds: detail.tags?.map((t) => t.tagId),
                context: revision.context
                  ? {
                      review: revision.context.review
                        ? {
                            problem: revision.context.review.problem ?? '',
                            constraints:
                              revision.context.review.constraints ?? undefined,
                            decisionsNeeded:
                              revision.context.review.decisionsNeeded ?? [],
                          }
                        : undefined,
                    }
                  : undefined,
                assets: revision.assets
                  ?.filter((a) => a.usage === 'design_file')
                  .map((a) => ({
                    assetId: a.assetId,
                    usage: 'design_file' as const,
                    caption: a.caption ?? undefined,
                    sortNo: a.sortNo ?? 0,
                  })),
              },
            }),
          ),
          map((created) => ({ editId: created.contentId })),
        );
      }
    }
  }
}
