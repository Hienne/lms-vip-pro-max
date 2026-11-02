import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  feedbackEndpoints,
  type AnchorCommand,
  type FeedbackKind,
  type LessonCommentView,
} from '@lms/contracts';
import { confirm } from '@lms/ui';
import { filter } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/** The comments the lesson view carries, and the size of every page "Xem thêm nhận xét" asks for. */
const COMMENT_PAGE_SIZE = 20;

const SENT: Record<FeedbackKind, string> = {
  comment: 'Đã gửi nhận xét',
  question: 'Đã gửi câu hỏi',
  report: 'Đã gửi báo cáo',
};

/**
 * The learner's rating, comments, questions and reports on one lesson: the section's read and the
 * commands that change it. `lessonId` is `undefined` while the lesson cannot be read, which keeps the
 * read idle. Call it in a store's field initializer. Every change reads the section again.
 */
export function lessonFeedback(lessonId: () => number | undefined) {
  const client = inject(EndpointClient);
  const dialog = inject(Dialog);
  const destroyRef = inject(DestroyRef);
  const changed = invalidation();
  /** How many of each kind were sent: the form of a kind empties when its own count changes. */
  const sentKinds = signal<Partial<Record<FeedbackKind, number>>>({});

  const feedback = serverData(
    (id: number) =>
      client.call(feedbackEndpoints.lessonFeedback, {
        params: { lessonId: id },
      }),
    { params: lessonId, reloadOn: changed },
  );

  /** Pages after the first, read by "Xem thêm nhận xét". A new comment starts the list over. */
  const more = linkedSignal<number | undefined, readonly LessonCommentView[]>({
    source: lessonId,
    computation: () => [],
  });
  const nextPage = linkedSignal<number | undefined, number>({
    source: lessonId,
    computation: () => 1,
  });

  /** The choice waiting for the call in flight to return, and what that call carries. */
  const wanted = signal<{ readonly id: number; readonly stars: number } | null>(
    null,
  );
  const inFlight = signal<{
    readonly id: number;
    readonly stars: number;
  } | null>(null);

  let intermediate = false;

  /**
   * Saves one rating at a time: aborting a request in the browser does not stop the server from
   * applying it, so a new call must never cancel one in flight. A choice made meanwhile waits in
   * `wanted` and goes out when the call returns, so the last choice is the one stored.
   */
  const rating = serverMutation(
    (input: { readonly lessonId: number; readonly stars: number }) =>
      client.call(feedbackEndpoints.rateLesson, {
        params: { lessonId: input.lessonId },
        body: { stars: input.stars },
      }),
    {
      errors: 'toast',
      onSuccess: () => {
        intermediate = wanted() !== null;
        inFlight.set(null);
        sendRating();
      },
      // A choice already waiting makes this answer an intermediate one: only the last is announced.
      success: (input) =>
        intermediate
          ? null
          : {
              title: 'Cảm ơn bạn đã đánh giá',
              detail: `${input.stars}/5 sao`,
            },
      invalidates: changed,
    },
  );

  /** Sends the waiting choice once nothing is in flight. */
  function sendRating() {
    const next = wanted();
    if (inFlight() || !next) return;
    wanted.set(null);
    inFlight.set(next);
    rating.run({ lessonId: next.id, stars: next.stars });
  }

  const sending = serverMutation(
    (input: {
      readonly lessonId: number;
      readonly kind: FeedbackKind;
      readonly text: string;
      readonly anchor: AnchorCommand;
    }) =>
      client.call(feedbackEndpoints.sendFeedback, {
        params: { lessonId: input.lessonId },
        body: { kind: input.kind, text: input.text, anchor: input.anchor },
      }),
    {
      errors: 'toast',
      onSuccess: (sent) => {
        if (sent.kind === 'comment') {
          more.set([]);
          nextPage.set(1);
        }
        sentKinds.update((kinds) => ({
          ...kinds,
          [sent.kind]: (kinds[sent.kind] ?? 0) + 1,
        }));
      },
      success: (input) => SENT[input.kind],
      invalidates: changed,
    },
  );

  const loadingMore = serverMutation(
    (input: { readonly lessonId: number; readonly page: number }) =>
      client.call(feedbackEndpoints.lessonComments, {
        params: { lessonId: input.lessonId },
        query: { page: input.page, size: COMMENT_PAGE_SIZE },
      }),
    {
      errors: 'toast',
      onSuccess: (page) => {
        more.update((loaded) => [...loaded, ...page.items]);
        nextPage.update((n) => n + 1);
      },
    },
  );

  /**
   * The stars the learner just chose, shown until the read says what the server holds. While a rating
   * is still on its way a reload does not take it back, or the stars would jump to an earlier choice.
   */
  const choice = linkedSignal<unknown, number | null>({
    source: () => feedback.value(),
    computation: (_, previous) =>
      untracked(() => (inFlight() ? (previous?.value ?? null) : null)),
  });

  // A failed rating is not retried: the stars go back to what the server holds.
  effect(() => {
    if (!rating.error()) return;
    untracked(() => {
      inFlight.set(null);
      wanted.set(null);
      choice.set(null);
    });
  });

  const firstPage = computed(() => feedback.value()?.comments);
  const comments = computed((): readonly LessonCommentView[] => {
    const first = firstPage()?.items ?? [];
    const seen = new Set(first.map((c) => c.id));
    return [...first, ...more().filter((c) => !seen.has(c.id))];
  });

  return {
    loading: feedback.isLoading,
    error: feedback.error,
    rating: computed(() => feedback.value()?.rating ?? null),
    myStars: computed(() => choice() ?? feedback.value()?.myStars ?? 0),
    comments,
    commentTotal: computed(() => firstPage()?.totalElements ?? 0),
    hasMore: computed(
      () => comments().length < (firstPage()?.totalElements ?? 0),
    ),
    moreBusy: loadingMore.isPending,
    questions: computed(
      () => feedback.value()?.mine.filter((m) => m.kind === 'question') ?? [],
    ),
    reports: computed(
      () => feedback.value()?.mine.filter((m) => m.kind === 'report') ?? [],
    ),
    sending: sending.isPending,
    sentKinds: sentKinds.asReadonly(),
    retry: () => feedback.reload(),
    /** The last choice is the one stored, however fast the stars are arrowed across. */
    rate: (id: number, stars: number) => {
      choice.set(stars);
      const sending = inFlight();
      // Choosing what is already on its way needs no second call.
      wanted.set(
        sending?.id === id && sending.stars === stars ? null : { id, stars },
      );
      sendRating();
    },
    send: (input: {
      readonly lessonId: number;
      readonly kind: FeedbackKind;
      readonly text: string;
      readonly anchor: AnchorCommand;
    }) => {
      if (input.kind !== 'report') {
        sending.run(input);
        return;
      }
      confirm(dialog, {
        title: 'Gửi báo cáo nội dung?',
        message:
          'Báo cáo sẽ được gửi tới giảng viên/quản trị nội dung để xem xét.',
        confirmLabel: 'Gửi báo cáo',
        tone: 'danger',
      })
        .pipe(filter(Boolean), takeUntilDestroyed(destroyRef))
        .subscribe(() => sending.run(input));
    },
    moreComments: (id: number) =>
      loadingMore.run({ lessonId: id, page: nextPage() }),
  };
}
