import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
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

  const rating = serverMutation(
    (input: { readonly lessonId: number; readonly stars: number }) =>
      client.call(feedbackEndpoints.rateLesson, {
        params: { lessonId: input.lessonId },
        body: { stars: input.stars },
      }),
    {
      errors: 'toast',
      success: (input) => ({
        title: 'Cảm ơn bạn đã đánh giá',
        detail: `${input.stars}/5 sao`,
      }),
      invalidates: changed,
    },
  );

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

  /** The stars the learner just chose, shown until the read says what the server holds. */
  const choice = linkedSignal<unknown, number | null>({
    source: () => [feedback.value(), rating.error()],
    computation: () => null,
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
    /** Latest choice only: a new run cancels the one in flight, so arrowing across the stars saves one value. */
    rate: (id: number, stars: number) => {
      choice.set(stars);
      rating.run({ lessonId: id, stars });
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
