import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  COMMUNITY_LIMITS,
  communityEndpoints,
  type ContentDetail,
} from '@lms/contracts';
import { filter, forkJoin, map, of, switchMap, type Observable } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import {
  askLifecycleReason,
  type LifecycleDialogAction,
} from '../../components/lifecycle-dialog/lifecycle-dialog';
import { reportContent } from '../../components/report-dialog/report-dialog';
import type { VoteValue } from '../../components/vote/vote';
import { CommunityChanges } from '../../data-access/community-changes';
import { CONTENT_KIND_LABELS } from '../../data-access/community-labels';
import { reloadOnConflict } from '../../data-access/conflict';
import {
  createFields,
  type DraftFields,
} from '../../data-access/content-authoring';

/** Answers shown on one question; the server orders them accepted first, then by score. */
const ANSWER_PAGE = 50;

const NOUNS: Readonly<Record<string, string>> = {
  question: 'câu hỏi',
  answer: 'câu trả lời',
  article: 'bài viết',
  lesson_learned: 'bài học',
};

interface LifecycleInput {
  readonly content: ContentDetail;
  readonly action: LifecycleDialogAction;
}

/**
 * Chi tiết nội dung (CM-03): a question with its answers, an article or a lesson learned. Every
 * write goes to the server and the page reads the content again; buttons follow the
 * `capabilities` the server sends. An answer's own address shows its question.
 */
@Injectable()
export class ContentStore {
  private readonly client = inject(EndpointClient);
  private readonly changes = inject(CommunityChanges);
  private readonly dialog = inject(Dialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly refresh = invalidation();

  readonly contentId$ = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('id'));
        return Number.isInteger(id) && id > 0 ? id : undefined;
      }),
    ),
    { initialValue: undefined },
  );

  private readonly state = {
    /** One id per answer composer, so a retried send does not post twice. */
    answerRequestId: signal(crypto.randomUUID()),
    /** The content views are counted once per visit. */
    viewed: signal<number | undefined>(undefined),
    /** Counts the answers posted from this page, so the composer clears after each. */
    answersPosted: signal(0),
  };

  private readonly detailData = serverData(
    (contentId: number) =>
      this.client.call(communityEndpoints.content, {
        params: { contentId },
        query: {},
      }),
    { params: () => this.contentId$(), reloadOn: this.refresh },
  );

  /** The answers with their bodies: the list carries only a summary, so each is read in full. */
  private readonly answersData = serverData(
    (questionId: number) =>
      this.client
        .call(communityEndpoints.answers, {
          params: { questionId },
          query: { size: ANSWER_PAGE },
        })
        .pipe(
          switchMap((page) =>
            (page.items.length
              ? forkJoin(
                  page.items.map((card) =>
                    this.client.call(communityEndpoints.content, {
                      params: { contentId: card.contentId },
                      query: {},
                    }),
                  ),
                )
              : of([] as ContentDetail[])
            ).pipe(map((items) => ({ items, total: page.totalElements }))),
          ),
        ),
    {
      params: () => {
        const detail = this.detailData.value();
        return detail?.kind === 'question' ? detail.contentId : undefined;
      },
      reloadOn: this.refresh,
    },
  );

  private readonly voteMutation = serverMutation(
    ({ contentId, value }: { contentId: number; value: VoteValue }) =>
      this.client.call(communityEndpoints.vote, {
        params: { contentId },
        body: { value },
      }),
    { errors: 'toast', invalidates: [this.refresh, this.changes.contents] },
  );

  private readonly savedMutation = serverMutation(
    (content: ContentDetail) =>
      this.client.call(communityEndpoints.setBookmark, {
        params: { contentId: content.contentId },
        body: { saved: !content.saved },
      }),
    {
      errors: 'toast',
      success: (content) => (content.saved ? 'Đã bỏ lưu' : 'Đã lưu'),
      invalidates: [this.refresh, this.changes.saved],
    },
  );

  private readonly followMutation = serverMutation(
    (content: ContentDetail) =>
      this.client.call(communityEndpoints.setSubscription, {
        body: {
          contentId: content.contentId,
          mode: this.isFollowing(content) ? 'off' : 'instant',
        },
      }),
    {
      errors: 'toast',
      success: (content) =>
        this.isFollowing(content) ? 'Đã bỏ theo dõi' : 'Đang theo dõi',
      invalidates: this.refresh,
    },
  );

  private readonly acceptMutation = serverMutation(
    ({ answer }: { answer: ContentDetail | null }) => {
      const question = this.requireDetail();
      return this.client
        .call(communityEndpoints.acceptAnswer, {
          params: { questionId: question.contentId },
          body: {
            expectedContentVersion: question.contentVersion,
            answerContentId: answer?.contentId ?? null,
            answerRevisionId: answer?.publishedRevision?.revisionId ?? null,
          },
        })
        .pipe(reloadOnConflict(this.dialog, () => this.refresh.bump()));
    },
    {
      errors: 'toast',
      success: ({ answer }) =>
        answer ? 'Đã chấp nhận câu trả lời' : 'Đã bỏ chấp nhận',
      invalidates: [this.refresh, this.changes.contents],
    },
  );

  private readonly lifecycleMutation = serverMutation(
    ({ content, action }: LifecycleInput) =>
      askLifecycleReason(this.dialog, {
        action,
        contentId: content.contentId,
        noun: NOUNS[content.kind] ?? 'nội dung',
      }).pipe(
        filter((draft) => draft !== undefined),
        switchMap((draft): Observable<ContentDetail> => {
          if (action === 'duplicate' || action === 'unduplicate') {
            return this.client.call(communityEndpoints.markDuplicate, {
              params: { questionId: content.contentId },
              body: {
                expectedContentVersion: content.contentVersion,
                targetQuestionId: draft.targetQuestionId ?? null,
                reason: draft.reason,
              },
            });
          }
          return this.client.call(communityEndpoints.changeLifecycle, {
            params: { contentId: content.contentId },
            body: {
              expectedContentVersion: content.contentVersion,
              action,
              reason: draft.reason,
            },
          });
        }),
        reloadOnConflict(this.dialog, () => this.refresh.bump()),
      ),
    {
      errors: 'toast',
      success: ({ action }) => LIFECYCLE_DONE[action],
      invalidates: [this.refresh, this.changes.contents],
      onSuccess: (result) => {
        // A deleted question leaves nothing to show; a deleted answer leaves its question.
        if (
          result.lifecycleStatus === 'deleted' &&
          result.contentId === this.contentId$()
        ) {
          void this.router.navigate([
            result.kind === 'question'
              ? '/community/questions'
              : '/community/articles',
          ]);
        }
      },
    },
  );

  private readonly reportMutation = serverMutation(
    (contentId: number) =>
      reportContent(this.dialog).pipe(
        filter((draft) => draft !== undefined),
        switchMap((draft) =>
          this.client.call(communityEndpoints.createReport, {
            body: { contentId, ...draft },
          }),
        ),
      ),
    {
      errors: 'toast',
      success: () => ({
        title: 'Đã gửi báo cáo',
        detail: 'Điều phối viên sẽ xem xét.',
      }),
      invalidates: this.changes.reports,
    },
  );

  private readonly answerMutation = serverMutation(
    ({ fields, publish }: { fields: DraftFields; publish: boolean }) => {
      const question = this.requireDetail();
      const title = `Câu trả lời cho “${question.publishedRevision?.title ?? ''}”`;
      return this.client
        .call(communityEndpoints.createAnswer, {
          params: { questionId: question.contentId },
          body: {
            clientRequestId: this.state.answerRequestId(),
            ...createFields(fields),
            title: title.slice(0, COMMUNITY_LIMITS.title.max),
          },
        })
        .pipe(
          switchMap((created) =>
            publish
              ? this.client.call(communityEndpoints.publishContent, {
                  params: { contentId: created.contentId },
                  body: {
                    expectedContentVersion: created.contentVersion,
                    expectedRevisionVersion:
                      created.draftRevision?.revisionVersion ?? 0,
                  },
                })
              : of(created),
          ),
        );
    },
    {
      errors: 'toast',
      success: ({ publish }) =>
        publish
          ? 'Đã đăng câu trả lời'
          : {
              title: 'Đã lưu nháp',
              detail: 'Bản nháp chỉ mình bạn thấy, xem lại trong Của tôi.',
            },
      invalidates: [this.refresh, this.changes.contents],
      onSuccess: (answer) => {
        this.state.answerRequestId.set(crypto.randomUUID());
        this.state.answersPosted.update((n) => n + 1);
        if (answer.draftRevision && !answer.publishedRevision) {
          void this.router.navigate([
            '/community/contents',
            answer.contentId,
            'edit',
          ]);
        }
      },
    },
  );

  constructor() {
    // An answer's own address shows its question; the view is counted once per content.
    effect(() => {
      const detail = this.detailData.value();
      if (!detail) return;
      untracked(() => {
        if (detail.kind === 'answer' && detail.questionId) {
          void this.router.navigate(
            ['/community/contents', detail.questionId],
            {
              replaceUrl: true,
              fragment: `answer-${detail.contentId}`,
            },
          );
          return;
        }
        if (
          detail.publishedRevision &&
          this.state.viewed() !== detail.contentId
        ) {
          this.state.viewed.set(detail.contentId);
          this.client
            .call(communityEndpoints.recordView, {
              params: { contentId: detail.contentId },
            })
            .subscribe({ error: () => undefined });
        }
      });
    });
  }

  // Selectors
  readonly detail$ = this.detailData.value;
  readonly isLoading$ = this.detailData.isLoading;
  readonly loadError$ = this.detailData.error;
  readonly kind$ = computed(() => this.detailData.value()?.kind);
  readonly kindLabel$ = computed(
    () => CONTENT_KIND_LABELS[this.detailData.value()?.kind ?? ''] ?? '',
  );
  readonly isArchived$ = computed(
    () => this.detailData.value()?.lifecycleStatus === 'archived',
  );
  readonly isClosed$ = computed(
    () => this.detailData.value()?.lifecycleStatus === 'closed',
  );
  readonly isFollowing$ = computed(() => {
    const detail = this.detailData.value();
    return !!detail && this.isFollowing(detail);
  });
  /** In the server's order: the accepted answer first, then by score. */
  readonly answers$ = computed(
    (): readonly ContentDetail[] => this.answersData.value()?.items ?? [],
  );
  /** Answers past the one page the question reads, said under the list instead of dropped. */
  readonly answersNotShown$ = computed(() => {
    const answers = this.answersData.value();
    return answers ? Math.max(0, answers.total - answers.items.length) : 0;
  });
  readonly answersLoading$ = this.answersData.isLoading;
  readonly answersError$ = this.answersData.error;
  readonly isVoting$ = this.voteMutation.isPending;
  readonly isBusy$ = computed(
    () =>
      this.savedMutation.isPending() ||
      this.followMutation.isPending() ||
      this.acceptMutation.isPending() ||
      this.lifecycleMutation.isPending(),
  );
  readonly isAnswering$ = this.answerMutation.isPending;
  readonly answersPosted$ = this.state.answersPosted.asReadonly();

  // Setters
  // Commands
  vote(contentId: number, value: VoteValue): void {
    this.voteMutation.run({ contentId, value });
  }

  toggleSaved(): void {
    this.savedMutation.run(this.requireDetail());
  }

  toggleFollow(): void {
    this.followMutation.run(this.requireDetail());
  }

  accept(answer: ContentDetail): void {
    this.acceptMutation.run({ answer });
  }

  unaccept(): void {
    this.acceptMutation.run({ answer: null });
  }

  changeLifecycle(content: ContentDetail, action: LifecycleDialogAction): void {
    this.lifecycleMutation.run({ content, action });
  }

  report(contentId: number): void {
    this.reportMutation.run(contentId);
  }

  postAnswer(fields: DraftFields, publish: boolean): void {
    this.answerMutation.run({ fields, publish });
  }

  retryLoad(): void {
    this.detailData.reload();
  }

  retryAnswers(): void {
    this.answersData.reload();
  }

  private isFollowing(content: ContentDetail): boolean {
    return !!content.subscriptionMode && content.subscriptionMode !== 'off';
  }

  private requireDetail(): ContentDetail {
    const detail = this.detailData.value();
    if (!detail) throw new Error('The content is not loaded');
    return detail;
  }
}

const LIFECYCLE_DONE: Readonly<Record<LifecycleDialogAction, string>> = {
  close: 'Đã đóng câu hỏi',
  reopen: 'Đã mở lại',
  archive: 'Đã lưu trữ',
  soft_delete: 'Đã xóa',
  duplicate: 'Đã đánh dấu trùng lặp',
  unduplicate: 'Đã bỏ đánh dấu trùng lặp',
};
