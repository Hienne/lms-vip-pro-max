import {
  OpenSessionCommandSchema,
  SaveProgressCommandSchema,
  type BlockDetail,
  type ProgressResult,
  type SaveProgressCommand,
  type StudySession,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import type {
  EnrollmentRecord,
  LearnerEnrollments,
} from './learner-enrollments';
import { ok, refuse } from './learning-reply';

/** The backend's lease: one writable study session per account, renewed by every accepted event. */
const LEASE_MS = 60_000;
/** Watched video time may not outrun the server clock by more than this factor. */
const MAX_SPEED = 2;
const DEFAULT_THRESHOLD = 80;

interface Lease {
  readonly userId: string;
  readonly sessionId: string;
  readonly fence: number;
  readonly enrollmentId: number;
  readonly blockId: number;
  expiresAt: number;
  released: boolean;
  lastSequence: number;
  lastPayload: string | null;
  lastResult: ProgressResult | null;
  lastAcceptedAt: number;
  /** Whether the last accepted event said the video was playing. */
  lastPlaying: boolean;
}

type Range = [number, number];
type BlockRow = EnrollmentRecord['blocks'][number];

const now = () => Date.now();
const iso = (time: number) => new Date(time).toISOString();

function union(ranges: readonly Range[]): Range[] {
  const sorted = ranges.map((r): Range => [...r]).sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  }
  return merged;
}

/**
 * The study session protocol in memory: the lease per account, the fence, the event sequence, the
 * `expectedVersion` check, and a simple scoring of the events (open, manual complete, last PDF
 * page, video ranges over the duration). It is a stand-in for the backend's rules, not a copy of
 * them; the app never computes any of this itself.
 */
export class LearnerStudy {
  private leases = new Map<string, Lease>();
  private fences = new Map<string, number>();
  private ranges = new Map<number, Range[]>();

  constructor(
    private readonly enrollments: LearnerEnrollments,
    private readonly callerId: (request: FakeRequest) => string,
  ) {}

  openSession(request: FakeRequest): FakeReply {
    const userId = this.callerId(request);
    const parsed = OpenSessionCommandSchema.safeParse(request.body);
    if (!parsed.success) return refuse('validationFailed');
    const command = parsed.data;
    const { record, block } = this.target(
      userId,
      command.enrollmentId,
      command.blockId,
    );
    const lease = this.leases.get(userId);
    const alive = lease && !lease.released && lease.expiresAt > now();
    const heldHere =
      lease !== undefined &&
      lease.sessionId === command.previousSessionId &&
      lease.fence === command.previousFence;
    if (alive && heldHere && lease.blockId === command.blockId) {
      // A retried claim or a reload of the same tab: the current session again.
      lease.expiresAt = now() + LEASE_MS;
      return ok(this.view(lease, record, block));
    }
    if (alive && !heldHere && !command.takeover) {
      return refuse('sessionInUse');
    }
    const fence = (this.fences.get(userId) ?? 0) + 1;
    this.fences.set(userId, fence);
    const next: Lease = {
      userId,
      sessionId: crypto.randomUUID(),
      fence,
      enrollmentId: command.enrollmentId,
      blockId: command.blockId,
      expiresAt: now() + LEASE_MS,
      released: false,
      lastSequence: 0,
      lastPayload: null,
      lastResult: null,
      lastAcceptedAt: now(),
      lastPlaying: false,
    };
    this.leases.set(userId, next);
    return ok(this.view(next, record, block));
  }

  saveProgress(request: FakeRequest): FakeReply {
    const userId = this.callerId(request);
    const parsed = SaveProgressCommandSchema.safeParse(request.body);
    if (!parsed.success) return refuse('validationFailed');
    const command = parsed.data;
    const enrollmentId = Number(request.params['enrollmentId']);
    const blockId = Number(request.params['blockId']);
    const { record, lesson, block } = this.target(
      userId,
      enrollmentId,
      blockId,
    );
    const lease = this.leases.get(userId);
    if (
      !lease ||
      lease.sessionId !== command.sessionId ||
      lease.fence !== command.sessionFence ||
      lease.enrollmentId !== enrollmentId ||
      lease.blockId !== blockId
    ) {
      return refuse('sessionExpired');
    }
    const payload = JSON.stringify(command);
    if (command.sequence === lease.lastSequence && lease.lastResult !== null) {
      // The same event again is acknowledged without side effects; another payload is stale.
      return payload === lease.lastPayload
        ? ok(structuredClone(lease.lastResult))
        : refuse('staleEvent');
    }
    if (lease.released || lease.expiresAt <= now()) {
      return refuse('sessionExpired');
    }
    if (command.sequence !== lease.lastSequence + 1) {
      return refuse('staleEvent');
    }
    const progress = record.blocks.find((b) => b.blockId === blockId);
    if (!progress) return refuse('resourceNotFound');
    if (command.expectedVersion !== progress.rowVersion) {
      return refuse('learningConflict');
    }
    const asset = block.assets[0]?.asset;
    if (command.assetId !== null && command.assetId !== (asset?.id ?? null)) {
      return refuse('mediaChanged');
    }

    // Refused before any row changes, so a rejected event leaves the version as it was.
    const pages = asset?.pageCount ?? 0;
    if (
      command.eventType === 'PDF_PAGE' &&
      (command.pdfPage === undefined || (pages > 0 && command.pdfPage > pages))
    ) {
      return refuse('validationFailed');
    }

    this.apply(lease, command, record, block, progress);
    const lessonRow = record.lessons.find(
      (l) => l.lessonId === lesson.lesson.id,
    );
    if (!lessonRow) return refuse('resourceNotFound');
    this.rollUp(record, lessonRow.lessonId, blockId);

    if (command.eventType === 'CLOSE') lease.released = true;
    else lease.expiresAt = now() + LEASE_MS;
    lease.lastSequence = command.sequence;
    lease.lastPayload = payload;
    lease.lastAcceptedAt = now();
    lease.lastPlaying = command.playing;

    const result: ProgressResult = {
      block: { ...progress },
      lesson: { ...lessonRow },
      enrollment: { ...record.enrollment },
      session: {
        sessionId: lease.sessionId,
        sessionFence: lease.fence,
        lastAcceptedSequence: lease.lastSequence,
        leaseState: lease.released ? 'released' : 'active',
        leaseExpiresAt: iso(lease.expiresAt),
      },
    };
    lease.lastResult = structuredClone(result);
    return ok(result);
  }

  private view(
    lease: Lease,
    record: EnrollmentRecord,
    block: BlockDetail,
  ): StudySession {
    const progress = record.blocks.find((b) => b.blockId === lease.blockId);
    return {
      sessionId: lease.sessionId,
      sessionFence: lease.fence,
      leaseExpiresAt: iso(lease.expiresAt),
      lastAcceptedSequence: lease.lastSequence,
      enrollmentId: lease.enrollmentId,
      blockId: lease.blockId,
      assetId: block.assets[0]?.asset.id ?? null,
      expectedVersion: progress?.rowVersion ?? 0,
      resume: progress ? { ...progress } : null,
    };
  }

  /** The caller's own enrolment (403 otherwise) and a block of its revision. */
  private target(userId: string, enrollmentId: number, blockId: number) {
    const record = this.enrollments.byId(enrollmentId);
    if (!record) return refuse('resourceNotFound');
    if (record.enrollment.userId !== userId) return refuse('accessDenied');
    for (const chapter of record.content.chapters) {
      for (const lesson of chapter.lessons) {
        const block = lesson.blocks.find((b) => b.block.id === blockId);
        if (block) return { record, lesson, block };
      }
    }
    return refuse('resourceNotFound');
  }

  /** Applies the event to the block's progress row. Completion never goes back. */
  private apply(
    lease: Lease,
    command: SaveProgressCommand,
    record: EnrollmentRecord,
    detail: BlockDetail,
    progress: BlockRow,
  ): void {
    const { block } = detail;
    const asset = detail.assets[0]?.asset;
    const at = iso(now());
    progress.rowVersion += 1;
    progress.lastEventSequence = command.sequence;
    progress.lastAccessAt = at;
    progress.updateTime = at;
    progress.mediaAssetId = asset?.id ?? progress.mediaAssetId ?? null;
    if (progress.status === 'not_started') {
      progress.status = 'in_progress';
      progress.startedAt = at;
    }
    if (command.videoPositionSeconds !== undefined) {
      progress.lastVideoPositionSeconds = command.videoPositionSeconds;
    }
    const done = () => {
      if (progress.status !== 'completed') {
        progress.status = 'completed';
        progress.completedAt = at;
      }
      progress.progressPercent = 100;
    };

    switch (command.eventType) {
      case 'OPEN':
        if (block.completionMode === 'open') done();
        break;
      case 'PLAY':
      case 'HEARTBEAT':
      case 'PAUSE':
        this.creditRange(lease, command, progress, asset?.durationSeconds);
        if (
          block.completionMode === 'video_coverage' &&
          (progress.progressPercent ?? 0) >=
            (block.completionThreshold ?? DEFAULT_THRESHOLD)
        ) {
          done();
        }
        break;
      case 'PDF_PAGE': {
        const pages = asset?.pageCount ?? 0;
        const page = command.pdfPage ?? 1;
        progress.lastPdfPage = page;
        if (block.completionMode === 'pdf_end' && pages > 0) {
          if (page >= pages) done();
          else if (progress.status !== 'completed') {
            progress.progressPercent = Math.round((page / pages) * 100);
          }
        }
        break;
      }
      case 'COMPLETE':
        if (command.complete && block.completionMode === 'manual') done();
        break;
      case 'SEEK':
      case 'CLOSE':
        break;
    }
    const lessonId = detail.block.lessonId;
    const lessonRow = record.lessons.find((l) => l.lessonId === lessonId);
    if (lessonRow && lessonRow.status === 'not_started') {
      lessonRow.status = 'in_progress';
      lessonRow.startedAt = at;
    }
  }

  /** Credits the reported range to the watched set: only after a playing event, within 2x elapsed. */
  private creditRange(
    lease: Lease,
    command: SaveProgressCommand,
    progress: BlockRow,
    duration: number | null | undefined,
  ): void {
    if (!duration) return;
    const known = this.ranges.get(progress.id) ?? [];
    if (known.length === 0 && (progress.watchedSeconds ?? 0) > 0) {
      known.push([0, progress.watchedSeconds ?? 0]);
    }
    const from = command.watchedFromSeconds;
    const to = command.watchedToSeconds;
    if (
      lease.lastPlaying &&
      from !== undefined &&
      to !== undefined &&
      to > from
    ) {
      const elapsed = (now() - lease.lastAcceptedAt) / 1000;
      const credited = Math.min(
        to - from,
        MAX_SPEED * elapsed,
        duration - from,
      );
      if (credited > 0) known.push([from, from + credited]);
    }
    const merged = union(known);
    this.ranges.set(progress.id, merged);
    const watched = merged.reduce((sum, [a, b]) => sum + (b - a), 0);
    progress.watchedSeconds = Math.round(watched * 1000) / 1000;
    if (progress.status === 'completed') return;
    const coverage = Math.min(100, (watched / duration) * 100);
    progress.progressPercent = Math.round(coverage);
  }

  /** Lesson and course percentages from the blocks and lessons the server counts as done. */
  private rollUp(
    record: EnrollmentRecord,
    lessonId: number,
    blockId: number,
  ): void {
    const at = iso(now());
    const lessons = record.content.chapters.flatMap((c) => c.lessons);
    const lesson = lessons.find((l) => l.lesson.id === lessonId);
    const lessonRow = record.lessons.find((l) => l.lessonId === lessonId);
    if (!lesson || !lessonRow) return;

    const required = lesson.blocks.filter((b) => b.block.isRequired !== false);
    const doneCount = required.filter(
      (b) =>
        record.blocks.find((x) => x.blockId === b.block.id)?.status ===
        'completed',
    ).length;
    lessonRow.rowVersion += 1;
    lessonRow.lastAccessAt = at;
    lessonRow.progressPercent = required.length
      ? Math.round((doneCount / required.length) * 100)
      : 0;
    if (required.length > 0 && doneCount === required.length) {
      if (lessonRow.status !== 'completed') lessonRow.completedAt = at;
      lessonRow.status = 'completed';
    }

    const totalLessons = lessons.filter((l) => l.lesson.isRequired !== false);
    const completedLessons = totalLessons.filter(
      (l) =>
        record.lessons.find((x) => x.lessonId === l.lesson.id)?.status ===
        'completed',
    ).length;
    const enrollment = record.enrollment;
    enrollment.rowVersion += 1;
    enrollment.lastAccessAt = at;
    enrollment.lastLessonId = lessonId;
    enrollment.lastBlockId = blockId;
    enrollment.startedAt ??= at;
    enrollment.progressPercent = Math.max(
      enrollment.progressPercent ?? 0,
      totalLessons.length
        ? Math.round((completedLessons / totalLessons.length) * 100)
        : 0,
    );
    if (enrollment.status === 'not_started') enrollment.status = 'in_progress';
    if (completedLessons === totalLessons.length && totalLessons.length > 0) {
      enrollment.status = 'completed';
      enrollment.completedAt ??= at;
    }
  }
}
