import { toSignal } from '@angular/core/rxjs-interop';
import {
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  courseContentEndpoints,
  CourseOutlineSchema,
  WORKING_STEP_STATUSES,
  type CourseContent,
  type CourseOutline,
  type GeneratedLesson,
  type LessonQuestions,
  type QuestionDecision,
} from '@lms/contracts';
import { map, switchMap, type Observable } from 'rxjs';
import { invalidation } from '../../../../../core/data-access/invalidation';
import { serverData } from '../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { NetworkStore } from '../../../../../core/network/network.store';

/** How often a job that is still being written is asked about. */
export const REVIEW_POLL_INTERVAL_MS = 3000;

type Action =
  | { readonly kind: 'save' }
  | { readonly kind: 'approve' }
  | { readonly kind: 'regenerate'; readonly key: string }
  | {
      readonly kind: 'decide';
      readonly key: string;
      readonly index: number;
      readonly decision: QuestionDecision;
    }
  | { readonly kind: 'retry' }
  | { readonly kind: 'draft' };

/** A lesson with the questions proposed for it. */
export interface LessonReview {
  readonly lesson: GeneratedLesson;
  readonly questions: LessonQuestions | undefined;
}

const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const withChapter = (
  outline: CourseOutline,
  chapter: number,
  change: (
    value: CourseOutline['chapters'][number],
  ) => CourseOutline['chapters'][number],
): CourseOutline => ({
  ...outline,
  chapters: outline.chapters.map((item, index) =>
    index === chapter ? change(item) : item,
  ),
});

const withLesson = (
  outline: CourseOutline,
  chapter: number,
  lesson: number,
  change: (
    value: CourseOutline['chapters'][number]['lessons'][number],
  ) => CourseOutline['chapters'][number]['lessons'][number],
): CourseOutline =>
  withChapter(outline, chapter, (item) => ({
    ...item,
    lessons: item.lessons.map((entry, index) =>
      index === lesson ? change(entry) : entry,
    ),
  }));

/**
 * The review of one AI course generation: what the model wrote, the outline the author edits and
 * approves, lessons to rewrite, questions to accept or reject, and the draft. The server owns
 * every state (outline lock, lesson status, decisions); this store reads it again every few
 * seconds while the model writes, and asks the server for each change.
 */
@Injectable()
export class CourseReviewStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly network = inject(NetworkStore);

  readonly jobId$ = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('jobId'));
        return Number.isInteger(id) && id > 0 ? id : undefined;
      }),
    ),
  );

  private readonly polls = invalidation();

  private readonly data = serverData(
    (jobId: number) =>
      this.client.call(courseContentEndpoints.content, { params: { jobId } }),
    { params: () => this.jobId$(), reloadOn: this.polls },
  );

  readonly content$ = this.data.value;
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;

  reload(): void {
    this.data.reload();
  }

  /** The model is writing: asks again every few seconds so the screen follows it. */
  private readonly working = computed(() => {
    const status = this.content$()?.status;
    return status === 'queued' || status === 'running';
  });

  private readonly pollTimer = effect((onCleanup) => {
    if (!this.working() || this.network.offline$()) return;
    const timer = setInterval(() => this.polls.bump(), REVIEW_POLL_INTERVAL_MS);
    onCleanup(() => clearInterval(timer));
  });

  // ---- the outline the author edits ---------------------------------------------------------

  private readonly saved = computed(() => this.content$()?.outline ?? null, {
    equal: sameJson,
  });

  /** The outline as edited on screen; it follows the server's until the author changes it. */
  readonly outline$ = linkedSignal<CourseOutline | null, CourseOutline | null>({
    source: this.saved,
    computation: (outline) => outline,
  });

  readonly editable$ = computed(() => {
    const content = this.content$();
    return !!content && !content.outlineLocked && !!content.outline;
  });

  readonly dirty$ = computed(() => !sameJson(this.outline$(), this.saved()));
  readonly outlineValid$ = computed(
    () => CourseOutlineSchema.safeParse(this.outline$()).success,
  );

  setOutlineTitle(value: string): void {
    this.outline$.update((o) => (o ? { ...o, title: value } : o));
  }

  setOutlineSummary(value: string): void {
    this.outline$.update((o) => (o ? { ...o, summary: value } : o));
  }

  setChapterTitle(chapter: number, value: string): void {
    this.outline$.update((o) =>
      o ? withChapter(o, chapter, (c) => ({ ...c, title: value })) : o,
    );
  }

  setLessonTitle(chapter: number, lesson: number, value: string): void {
    this.outline$.update((o) =>
      o ? withLesson(o, chapter, lesson, (l) => ({ ...l, title: value })) : o,
    );
  }

  setLessonMinutes(chapter: number, lesson: number, value: string): void {
    const minutes = Number(value);
    this.outline$.update((o) =>
      o
        ? withLesson(o, chapter, lesson, (l) => ({
            ...l,
            estimatedMinutes: Number.isFinite(minutes) ? minutes : 0,
          }))
        : o,
    );
  }

  /** One objective per line. */
  setLessonObjectives(chapter: number, lesson: number, text: string): void {
    const objectives = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
    this.outline$.update((o) =>
      o ? withLesson(o, chapter, lesson, (l) => ({ ...l, objectives })) : o,
    );
  }

  addLesson(chapter: number): void {
    this.outline$.update((o) =>
      o
        ? withChapter(o, chapter, (c) => ({
            ...c,
            lessons: [
              ...c.lessons,
              { title: 'Bài mới', objectives: [], estimatedMinutes: 10 },
            ],
          }))
        : o,
    );
  }

  removeLesson(chapter: number, lesson: number): void {
    this.outline$.update((o) =>
      o
        ? withChapter(o, chapter, (c) => ({
            ...c,
            lessons: c.lessons.filter((_, index) => index !== lesson),
          }))
        : o,
    );
  }

  removeChapter(chapter: number): void {
    this.outline$.update((o) =>
      o
        ? { ...o, chapters: o.chapters.filter((_, index) => index !== chapter) }
        : o,
    );
  }

  // ---- what the model wrote -----------------------------------------------------------------

  readonly lessons$ = computed<readonly LessonReview[]>(() => {
    const content = this.content$();
    if (!content) return [];
    return content.lessons.map((lesson) => ({
      lesson,
      questions: content.questions.find((q) => q.lessonKey === lesson.key),
    }));
  });

  readonly failedLessons$ = computed(() =>
    this.lessons$().filter((item) => item.lesson.status === 'failed'),
  );

  readonly allWritten$ = computed(() => {
    const lessons = this.content$()?.lessons ?? [];
    return lessons.length > 0 && lessons.every((l) => l.status === 'done');
  });

  readonly draftId$ = computed(() => this.content$()?.createdDraftId ?? null);

  /** The draft needs an approved outline and every lesson written; it is made once. */
  readonly canDraft$ = computed(() => {
    const content = this.content$();
    return (
      !!content &&
      content.outlineLocked &&
      this.allWritten$() &&
      this.draftId$() === null &&
      !this.working()
    );
  });

  isWorking(lesson: GeneratedLesson): boolean {
    return WORKING_STEP_STATUSES.includes(lesson.status);
  }

  // ---- changes the author asks for ----------------------------------------------------------

  private perform(action: Action): Observable<CourseContent | unknown> {
    const jobId = this.jobId$() ?? 0;
    const params = { jobId };
    switch (action.kind) {
      case 'save':
        return this.client.call(courseContentEndpoints.updateOutline, {
          params,
          body: this.outline$() as CourseOutline,
        });
      case 'approve': {
        const approve = () =>
          this.client.call(courseContentEndpoints.approveOutline, { params });
        return this.dirty$()
          ? this.client
              .call(courseContentEndpoints.updateOutline, {
                params,
                body: this.outline$() as CourseOutline,
              })
              .pipe(switchMap(approve))
          : approve();
      }
      case 'regenerate':
        return this.client.call(courseContentEndpoints.regenerateLesson, {
          params: { jobId, key: action.key },
        });
      case 'decide':
        return this.client.call(courseContentEndpoints.decideQuestion, {
          params: { jobId, key: action.key, index: action.index },
          body: { decision: action.decision },
        });
      case 'retry':
        return this.client.call(courseContentEndpoints.retry, { params });
      case 'draft':
        return this.client.call(courseContentEndpoints.createDraft, { params });
    }
  }

  private readonly acting = serverMutation(
    (action: Action) => this.perform(action),
    {
      errors: 'alert',
      invalidates: this.polls,
      success: (action) =>
        action.kind === 'draft'
          ? 'Đã tạo bản nháp khóa học'
          : action.kind === 'approve'
            ? 'Đã duyệt dàn ý, trợ lý đang viết các bài học'
            : action.kind === 'save'
              ? 'Đã lưu dàn ý'
              : null,
    },
  );

  readonly isActing$ = this.acting.isPending;
  readonly actionError$ = this.acting.error;

  saveOutline(): void {
    this.acting.run({ kind: 'save' });
  }

  approveOutline(): void {
    this.acting.run({ kind: 'approve' });
  }

  regenerate(key: string): void {
    this.acting.run({ kind: 'regenerate', key });
  }

  decide(key: string, index: number, decision: QuestionDecision): void {
    this.acting.run({ kind: 'decide', key, index, decision });
  }

  retry(): void {
    this.acting.run({ kind: 'retry' });
  }

  createDraft(): void {
    this.acting.run({ kind: 'draft' });
  }
}
