import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import {
  courseContentEndpoints,
  courseJobEndpoints,
  LIVE_COURSE_JOB_STATUSES,
  type CourseJob,
  type LessonAiState,
} from '@lms/contracts';
import { map } from 'rxjs';
import { CourseJobAccess } from '../../../../core/course-jobs/course-job-access';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { NetworkStore } from '../../../../core/network/network.store';
import { pollWhileVisible } from '../../../../core/polling/poll-while-visible';
import { CourseEditorStore } from './course-editor.store';

/** How often the job of the open course is asked about while it runs. */
export const COURSE_AI_POLL_INTERVAL_MS = 3000;

/** What the AI is doing for the course, as step 2 tells it. */
export type AiPhase =
  | 'outline'
  | 'approval'
  | 'writing'
  | 'failed'
  | 'stopped'
  | 'done';

/** The key the server gives a lesson of the outline: `c<chapter>l<lesson>`, both from 1. */
export const lessonKeyOf = (chapter: number, lesson: number): string =>
  `c${chapter + 1}l${lesson + 1}`;

/** Where a lesson is in the lessons grid, the way {@link CourseAiJobStore.lessonStates$} keys it. */
export const lessonPlace = (chapter: number, lesson: number): string =>
  `${chapter}.${lesson}`;

const WRITING_STEPS: readonly string[] = ['lesson', 'questions'];

/**
 * The AI job that fills the open course (step 2). The server owns every state; this store finds
 * the job of the course, asks about it every few seconds while it runs and the tab is visible,
 * tells the editor to read the course again whenever the job moved (so written lessons appear
 * without a reload), and sends the author's commands: approve the outline, stop, retry, rewrite
 * a lesson. Nothing is asked of a course the AI did not start.
 */
@Injectable()
export class CourseAiJobStore {
  private readonly client = inject(EndpointClient);
  private readonly editor = inject(CourseEditorStore);
  private readonly access = inject(CourseJobAccess);
  private readonly network = inject(NetworkStore);

  private readonly polls = invalidation();

  /** The course whose job is looked for: an AI course the signed-in author may manage. */
  private readonly lookupCourseId = computed(() => {
    const course = this.editor.course$();
    return course?.revision.aiGenerated && this.access.canGenerate$()
      ? course.course.id
      : undefined;
  });

  private readonly found = serverData(
    (courseId: number) =>
      this.client
        .call(courseJobEndpoints.list)
        .pipe(map((jobs) => jobs.find((job) => job.courseId === courseId))),
    { params: () => this.lookupCourseId() },
  );

  private readonly jobData = serverData(
    (jobId: number) =>
      this.client.call(courseJobEndpoints.get, { params: { jobId } }),
    { params: () => this.found.value()?.jobId, reloadOn: this.polls },
  );

  readonly job$ = computed((): CourseJob | undefined => this.jobData.value());

  readonly running$ = computed(() => {
    const status = this.job$()?.status;
    return !!status && LIVE_COURSE_JOB_STATUSES.includes(status);
  });

  readonly phase$ = computed((): AiPhase | null => {
    const job = this.job$();
    if (!job) return null;
    switch (job.status) {
      case 'queued':
      case 'running':
        return WRITING_STEPS.includes(job.step ?? '') ? 'writing' : 'outline';
      case 'waiting_approval':
        return 'approval';
      case 'failed':
        return 'failed';
      case 'completed':
        return 'done';
      default:
        return 'stopped';
    }
  });

  /** The state of each lesson the AI manages, by its place (`chapter.lesson`, both from 0). */
  readonly lessonStates$ = computed(() => {
    const states = new Map<string, LessonAiState>();
    this.editor.course$()?.chapters.forEach(({ lessons }, chapter) =>
      lessons.forEach(({ lesson }, index) => {
        if (lesson.aiState)
          states.set(lessonPlace(chapter, index), lesson.aiState);
      }),
    );
    return states;
  });

  /** The line under the stepper: what the AI is doing now. Null when there is nothing to say. */
  readonly statusLine$ = computed((): string | null => {
    const phase = this.phase$();
    if (phase === 'outline') return 'Đang tạo dàn ý…';
    if (phase === 'approval')
      return 'Dàn ý đã sẵn sàng. Sửa nếu cần rồi duyệt để AI viết bài.';
    if (phase === 'stopped')
      return 'Đã dừng tạo bằng AI. Các bài đã viết được giữ lại.';
    if (phase === 'done') return 'AI đã viết xong các bài học.';
    if (phase !== 'writing') return null;
    if (this.job$()?.step === 'questions') return 'Đang đề xuất câu hỏi…';
    const states = [...this.lessonStates$().values()];
    const finished = states.filter(
      (state) => state === 'written' || state === 'user_edited',
    ).length;
    return `Đang viết bài ${Math.min(finished + 1, states.length)}/${states.length}…`;
  });

  /** Why chapters and lessons cannot be added, removed or reordered now; null when they can. */
  readonly structureLock$ = computed((): string | null =>
    this.phase$() === 'writing'
      ? 'AI đang viết bài nên chưa thể thêm, xóa hoặc đổi thứ tự chương và bài. Dừng tạo bằng AI nếu muốn sửa cấu trúc.'
      : null,
  );

  /** A lesson being written by the AI is not opened for editing; the rest are. */
  isWriting(chapter: number, lesson: number): boolean {
    return this.lessonStates$().get(lessonPlace(chapter, lesson)) === 'writing';
  }

  // ---- following the job -----------------------------------------------------------------

  private readonly pollTimer = effect((onCleanup) => {
    if (!this.running$() || this.network.offline$()) return;
    onCleanup(
      pollWhileVisible(COURSE_AI_POLL_INTERVAL_MS, () => this.polls.bump()),
    );
  });

  /** What changed in the job last time the course was read for it. */
  private seen: string | undefined;

  /** The job moved (or has just been found): the course is read again for the lessons it wrote. */
  private readonly followProgress = effect(() => {
    const job = this.job$();
    if (!job) return;
    const signature = [job.status, job.step, job.progress, job.updateTime].join(
      '|',
    );
    untracked(() => {
      if (signature === this.seen) return;
      this.seen = signature;
      this.editor.reloadCourse();
    });
  });

  /** A command went through: the job is asked about at once, and the course follows its change. */
  private moved(): void {
    this.polls.bump();
  }

  // ---- commands ---------------------------------------------------------------------------

  private readonly approveMutation = serverMutation(
    (jobId: number) =>
      this.client.call(courseContentEndpoints.approveOutline, {
        params: { jobId },
      }),
    {
      errors: 'toast',
      success: () => 'Đã duyệt dàn ý, AI bắt đầu viết bài',
      onSuccess: () => this.moved(),
    },
  );

  private readonly stopMutation = serverMutation(
    (jobId: number) =>
      this.client.call(courseJobEndpoints.stop, { params: { jobId } }),
    {
      errors: 'toast',
      success: () => 'Đã dừng tạo bằng AI',
      onSuccess: () => this.moved(),
    },
  );

  private readonly retryMutation = serverMutation(
    (jobId: number) =>
      this.client.call(courseContentEndpoints.retry, { params: { jobId } }),
    { errors: 'toast', onSuccess: () => this.moved() },
  );

  private readonly rewriteMutation = serverMutation(
    (input: { jobId: number; key: string }) =>
      this.client.call(courseContentEndpoints.regenerateLesson, {
        params: input,
      }),
    {
      errors: 'toast',
      success: () => 'AI đang viết lại bài học',
      onSuccess: () => this.moved(),
    },
  );

  readonly isBusy$ = computed(
    () =>
      this.approveMutation.isPending() ||
      this.stopMutation.isPending() ||
      this.retryMutation.isPending() ||
      this.rewriteMutation.isPending(),
  );

  /** "Duyệt dàn ý và viết bài": the server reads the outline from the saved draft. */
  approve(): void {
    const job = this.job$();
    if (job && this.phase$() === 'approval')
      this.approveMutation.run(job.jobId);
  }

  stop(): void {
    const job = this.job$();
    if (job && this.running$()) this.stopMutation.run(job.jobId);
  }

  retry(): void {
    const job = this.job$();
    if (job && this.phase$() === 'failed') this.retryMutation.run(job.jobId);
  }

  /** "Viết lại bằng AI" for the lesson at this place; the others stay as they are. */
  rewrite(chapter: number, lesson: number): void {
    const job = this.job$();
    if (job) {
      this.rewriteMutation.run({
        jobId: job.jobId,
        key: lessonKeyOf(chapter, lesson),
      });
    }
  }

  /** The lesson may be rewritten: the AI manages it and is not writing it right now. */
  canRewrite(chapter: number, lesson: number): boolean {
    const state = this.lessonStates$().get(lessonPlace(chapter, lesson));
    return !!this.job$() && !!state && state !== 'writing';
  }
}
