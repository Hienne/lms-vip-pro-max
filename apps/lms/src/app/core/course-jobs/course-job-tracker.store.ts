import {
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
} from '@angular/core';
import {
  courseJobEndpoints,
  courseJobReviewPath,
  LIVE_COURSE_JOB_STATUSES,
  type CourseJob,
  type CourseJobSummary,
} from '@lms/contracts';
import { map, tap } from 'rxjs';
import { invalidation } from '../data-access/invalidation';
import { serverData } from '../data-access/server-data';
import { EndpointClient } from '../http/endpoint-client';
import { NetworkStore } from '../network/network.store';
import { pollWhileVisible } from '../polling/poll-while-visible';
import { SessionStore } from '../session/session.store';
import { CourseJobAccess } from './course-job-access';

/** How often a generation that is still running is asked about. */
export const COURSE_POLL_INTERVAL_MS = 3000;
/** How long the "ready to review" notice stays up when nobody closes it. */
export const COURSE_NOTICE_MS = 10000;
/** A job the app just started is kept this long even if the list does not show it yet. */
const UNLISTED_GRACE_MS = 60000;

/** A job that stopped working on its own, and when the app noticed. */
export interface FinishedCourseJob {
  readonly job: CourseJobSummary;
  readonly at: number;
}

const isLive = (job: CourseJobSummary): boolean =>
  LIVE_COURSE_JOB_STATUSES.includes(job.status);

const summaryOf = (job: CourseJob): CourseJobSummary => ({
  jobId: job.jobId,
  status: job.status,
  step: job.step ?? null,
  progress: job.progress,
  error: job.error ?? null,
  sourceFileName: job.source?.fileName ?? null,
  createdDraftId: job.createdDraftId ?? null,
  createTime: job.createTime,
});

/**
 * Follows the signed-in author's course generations: it reads the list from the server when the
 * app starts or reloads, so progress survives a reload and shows on every page, and asks again
 * every few seconds while one is queued or running. The server owns the status; this store only
 * remembers which jobs it is waiting for and announces each one that stops. Only instructors and
 * admins are asked at all. Everything resets when the user changes or signs out.
 */
@Injectable({ providedIn: 'root' })
export class CourseJobTrackerStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly network = inject(NetworkStore);
  private readonly access = inject(CourseJobAccess);

  private readonly userId = computed(() =>
    this.access.canGenerate$() ? this.session.user$()?.userId : undefined,
  );

  private readonly state = {
    live: linkedSignal<string | undefined, readonly CourseJobSummary[]>({
      source: this.userId,
      computation: () => [],
    }),
    lastFinished: linkedSignal<string | undefined, FinishedCourseJob | null>({
      source: this.userId,
      computation: () => null,
    }),
  };

  private readonly polls = invalidation();

  // A failed poll is not shown (the owl is not an error surface); the next tick tries again.
  private readonly pollData = serverData(
    () =>
      this.client.call(courseJobEndpoints.list).pipe(
        tap((jobs) => this.apply(jobs)),
        map(() => undefined),
      ),
    { params: () => this.userId(), reloadOn: this.polls },
  );

  readonly live$ = this.state.live.asReadonly();
  readonly lastFinished$ = this.state.lastFinished.asReadonly();
  readonly pollError$ = this.pollData.error;

  /** Where the first running job is, for the owl's label. */
  readonly progress$ = computed(() => this.live$()[0]?.progress ?? null);

  private readonly shouldPoll = computed(
    () =>
      this.live$().length > 0 &&
      !this.network.offline$() &&
      this.userId() !== undefined,
  );

  private readonly pollTimer = effect((onCleanup) => {
    if (!this.shouldPoll()) return;
    onCleanup(
      pollWhileVisible(COURSE_POLL_INTERVAL_MS, () => this.polls.bump()),
    );
  });

  private readonly noticeTimer = effect((onCleanup) => {
    if (this.lastFinished$() === null) return;
    const timer = setTimeout(() => this.dismiss(), COURSE_NOTICE_MS);
    onCleanup(() => clearTimeout(timer));
  });

  /** Starts waiting for a job that was just queued from the form. */
  track(job: CourseJob): void {
    const summary = summaryOf(job);
    if (!isLive(summary)) return;
    this.state.live.set([
      summary,
      ...this.live$().filter((j) => j.jobId !== summary.jobId),
    ]);
  }

  /** Starts waiting for a job a confirmed card started; the next poll fills in the rest. */
  trackById(jobId: number): void {
    if (this.live$().some((j) => j.jobId === jobId)) return;
    this.state.live.set([
      {
        jobId,
        status: 'queued',
        step: null,
        progress: 0,
        error: null,
        sourceFileName: null,
        createdDraftId: null,
        createTime: new Date().toISOString(),
      },
      ...this.live$(),
    ]);
    this.polls.bump();
  }

  dismiss(): void {
    this.state.lastFinished.set(null);
  }

  /** The review screen of a job. */
  pathOf(jobId: number): string {
    return courseJobReviewPath(jobId);
  }

  /**
   * Merges the server's list: the live jobs are the listed ones that still work; a job that was
   * live and no longer is announced. A job tracked while the call ran and not yet listed is kept.
   */
  private apply(listed: readonly CourseJobSummary[]): void {
    const byId = new Map(listed.map((j) => [j.jobId, j]));
    const kept = this.live$().filter(
      (j) =>
        !byId.has(j.jobId) &&
        Date.now() - Date.parse(j.createTime) < UNLISTED_GRACE_MS,
    );
    let finished: CourseJobSummary | null = null;
    for (const before of this.live$()) {
      const now = byId.get(before.jobId);
      if (now && !isLive(now)) finished = now;
    }
    this.state.live.set([...listed.filter(isLive), ...kept]);
    if (finished)
      this.state.lastFinished.set({ job: finished, at: Date.now() });
  }
}
