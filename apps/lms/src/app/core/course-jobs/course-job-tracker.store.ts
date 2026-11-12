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
import { LOCAL_STORAGE } from '../storage/local-storage';
import { CourseJobAccess } from './course-job-access';

/** How often a generation that is still running is asked about. */
export const COURSE_POLL_INTERVAL_MS = 3000;
/** How long the "ready to review" notice stays up when nobody closes it; a failure notice never goes by itself. */
export const COURSE_NOTICE_MS = 10000;
/** A job the app just started is kept this long even if the list does not show it yet. */
const UNLISTED_GRACE_MS = 60000;

/** A job that stopped working on its own, and when the app noticed. */
export interface FinishedCourseJob {
  readonly job: CourseJobSummary;
  readonly at: number;
}

const DISMISSED_KEY = 'lms.courseJobNoticesDismissed';
const DISMISSED_KEPT = 50;

/** The editor step where a failed job is picked up: the questions step for that job's last step, else the outline and lessons. */
const failedStep = (job: CourseJobSummary): number =>
  job.step?.startsWith('question') ? 2 : 1;

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
  courseId: job.courseId ?? null,
});

/**
 * Follows the signed-in author's course generations: it reads the list from the server when the
 * app starts or reloads, so progress survives a reload and shows on every page, and asks again
 * every few seconds while one is queued or running. The server owns the status; this store only
 * remembers which jobs it is waiting for and announces each one that stops. A failure notice
 * stays until the user dismisses it and survives a reload (the dismissed jobs are remembered in
 * this browser). Only instructors and admins are asked at all. Everything resets when the user changes or signs out.
 */
@Injectable({ providedIn: 'root' })
export class CourseJobTrackerStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly network = inject(NetworkStore);
  private readonly access = inject(CourseJobAccess);
  private readonly storage = inject(LOCAL_STORAGE);
  /** Failed jobs of the last list, so a dismissal covers every notice the list could bring back. */
  private failedListed: readonly number[] = [];

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
      this.client.call(courseJobEndpoints.active).pipe(
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
    const finished = this.lastFinished$();
    if (finished === null || finished.job.status === 'failed') return;
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
    const finished = this.lastFinished$();
    if (finished?.job.status === 'failed') {
      this.remember([finished.job.jobId, ...this.failedListed]);
    }
    this.state.lastFinished.set(null);
  }

  /** Where a notice opens: step 2 of the course form (3 when the questions failed), else the old review screen. */
  pathOf(job: CourseJobSummary): string {
    if (job.courseId == null) return courseJobReviewPath(job.jobId);
    const step = job.status === 'failed' ? failedStep(job) : 1;
    return `/admin/courses/${job.courseId}/edit?step=${step}`;
  }

  private dismissedIds(): readonly number[] {
    try {
      const raw = this.storage?.getItem(this.dismissedKey());
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((id): id is number => typeof id === 'number')
        : [];
    } catch {
      return [];
    }
  }

  private dismissedKey(): string {
    return `${DISMISSED_KEY}.${this.userId() ?? ''}`;
  }

  private remember(ids: readonly number[]): void {
    const merged = [...new Set([...ids, ...this.dismissedIds()])].slice(
      0,
      DISMISSED_KEPT,
    );
    try {
      this.storage?.setItem(this.dismissedKey(), JSON.stringify(merged));
    } catch {
      // Storage is a convenience: without it the notice returns after a reload.
    }
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
    this.failedListed = listed
      .filter((j) => j.status === 'failed')
      .map((j) => j.jobId);
    if (finished) {
      this.state.lastFinished.set({ job: finished, at: Date.now() });
      return;
    }
    // A failure the user has not dismissed yet (it may have happened while the app was closed).
    if (this.lastFinished$() !== null) return;
    const dismissed = this.dismissedIds();
    const unseen = listed.find(
      (j) => j.status === 'failed' && !dismissed.includes(j.jobId),
    );
    if (unseen) this.state.lastFinished.set({ job: unseen, at: Date.now() });
  }
}
