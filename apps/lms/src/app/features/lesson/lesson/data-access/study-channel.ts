import { signal } from '@angular/core';
import {
  learnerEndpoints,
  type ProgressResult,
  type StudySession,
} from '@lms/contracts';
import { interval, type Subscription } from 'rxjs';
import { toAppError, type AppError } from '../../../../core/errors/app-error';
import type { EndpointClient } from '../../../../core/http/endpoint-client';
import {
  actionFor,
  afterResult,
  enqueue,
  fromClaim,
  NOT_PLAYING,
  seekEvents,
  toCommand,
  type PlayTracker,
  type ProtocolState,
  type RefusalAction,
  type StudyEvent,
} from './study-protocol';
import type { HeldSession, StudySessionStorage } from './study-session.storage';

/** Where the account's one study session stands for the block on screen. */
export type StudyPhase =
  | 'idle'
  | 'claiming'
  | 'ready'
  /** Another device holds the session: nothing loads until the learner takes it over. */
  | 'takeover'
  /** Another device took the session while this one ran. */
  | 'moved'
  | 'media-changed'
  | 'block-error'
  | 'page-error'
  /** The claim could not be made (offline, a system failure). */
  | 'failed';

export type SaveState = 'idle' | 'saved' | 'failed';

export interface ClaimTarget {
  readonly enrollmentId: number;
  readonly blockId: number;
  readonly video: boolean;
}

export interface StudyChannelDeps {
  readonly client: EndpointClient;
  readonly storage: StudySessionStorage;
  readonly userId: () => string | undefined;
  /** The page is visible: a hidden tab sends no heartbeat. */
  readonly visible: () => boolean;
  /** Where the video on screen is now, to close its played range when the block is left. */
  readonly position?: () => number | undefined;
  /** Each result the server accepted, to show instead of the loaded progress. */
  readonly accepted: (result: ProgressResult) => void;
  /** The server wants a fresh read of the enrolment (a stale event, a changed block). */
  readonly resync: () => void;
}

/** Keeps the 60 s lease and the 5 min media cookie alive while the tab is visible. */
export const HEARTBEAT_MS = 20_000;

interface InFlight {
  readonly event: StudyEvent;
  readonly command: ReturnType<typeof toCommand>['command'];
  readonly tracker: PlayTracker;
}

/**
 * The tab's study session on one block: the claim, the events and what each refusal does
 * (SPEC-lesson-player → Study protocol). Created by `LessonStore`, which owns the rest of the
 * page; nothing here knows about lessons.
 *
 * Events go one at a time and the sent one is kept until the server acknowledges it, so a resend
 * after a lost answer carries the same payload. This is a hand-written serial queue instead of a
 * `serverMutation` on purpose: `serverMutation` cancels the run in flight, and a cancelled event
 * may still be applied by the server and break the sequence.
 */
export class StudyChannel {
  private readonly state = {
    phase: signal<StudyPhase>('idle'),
    save: signal<SaveState>('idle'),
    session: signal<StudySession | null>(null),
    error: signal<AppError | null>(null),
  };

  readonly phase$ = this.state.phase.asReadonly();
  readonly save$ = this.state.save.asReadonly();
  /** The last claim: where the block resumes. */
  readonly session$ = this.state.session.asReadonly();
  /** The refusal behind `takeover`, `moved`, `block-error`, `page-error` or `failed`. */
  readonly error$ = this.state.error.asReadonly();

  private protocol: ProtocolState | null = null;
  private tracker: PlayTracker = NOT_PLAYING;
  private held: HeldSession | null = null;
  /** What the page wants studied. */
  private wanted: ClaimTarget | undefined;
  /** The block the session is on, or is being claimed for. */
  private target: ClaimTarget | undefined;

  private waiting: StudyEvent[] = [];
  private inFlight: InFlight | null = null;
  private busy = false;
  private resyncs = 0;
  private afterIdle: (() => void) | null = null;
  private onSaved: ((saved: boolean) => void) | null = null;
  private heartbeat: Subscription | undefined;
  private destroyed = false;

  constructor(private readonly deps: StudyChannelDeps) {}

  /** The block to study, or none: the old one is closed first, then the new one claimed. */
  switchTo(target: ClaimTarget | undefined): void {
    if (this.destroyed) return;
    if (
      this.wanted?.enrollmentId === target?.enrollmentId &&
      this.wanted?.blockId === target?.blockId
    ) {
      return;
    }
    this.wanted = target;
    this.finishSave(false);
    // A claim in flight finishes first (`claimed` then claims what is wanted now).
    if (this.state.phase() === 'claiming') return;
    if (this.state.phase() === 'ready' && this.target) {
      // The session is still on the old block: what is queued for it goes first (a completion
      // must not be lost), then it is closed there, then the new one is claimed.
      this.queue(this.closeEvent());
      this.afterIdle = () => this.claimWanted();
      this.pump();
    } else if (this.busy) {
      // A lease is still being closed: the next block is claimed once that answers.
      this.afterIdle = () => this.claimWanted();
    } else {
      this.claimWanted();
    }
  }

  /** The learner chose to move the session here ("Học trên thiết bị này"). */
  takeOver(): void {
    if (this.destroyed || this.state.phase() === 'claiming') return;
    this.claimWanted(true);
  }

  /** Claims the block again with the ids this tab holds ("Thử lại", "Tải lại bài"). */
  reclaim(): void {
    if (this.destroyed || this.state.phase() === 'claiming') return;
    this.finishSave(false);
    if (this.busy) {
      // The request in flight is answered first: its answer frees the slot, which would
      // otherwise be the claim's, and the next event would reuse a sequence still in flight.
      this.afterIdle = () => this.claimWanted();
      return;
    }
    this.claimWanted();
  }

  /** The player reports something the learner did. */
  send(event: StudyEvent): void {
    if (this.destroyed || this.state.phase() !== 'ready') return;
    this.queue(event);
    this.pump();
  }

  /** Let the page advance only after the current block's queued writes are acknowledged. */
  saveBeforeLeaving(
    event: StudyEvent | undefined,
    settled: (saved: boolean) => void,
  ): void {
    if (this.destroyed || this.state.phase() !== 'ready') {
      settled(false);
      return;
    }
    this.onSaved = settled;
    if (event) this.queue(event);
    this.pump();
  }

  /** A seek: the range played up to where it started is closed first, then the `SEEK`. */
  seek(from: number, to: number, playing: boolean): void {
    for (const event of seekEvents(this.tracker, from, to, playing)) {
      this.send(event);
    }
  }

  /** Sends the unsent event again after "Chưa lưu được tiến độ". */
  retry(): void {
    if (this.destroyed) return;
    if (this.state.phase() === 'ready') this.pump();
    else this.reclaim();
  }

  /** Route leave: `CLOSE` the block, best effort, and stop the timer. */
  destroy(): void {
    if (this.destroyed) return;
    this.finishSave(false);
    if (this.state.phase() === 'ready') {
      this.queue(this.closeEvent());
      this.pump();
    }
    this.destroyed = true;
    this.stopHeartbeat();
  }

  /** `CLOSE` for the block on screen; a video closes its range where the player is now. */
  private closeEvent(): StudyEvent {
    // Without a player, the last reported position stands in: a video event always carries one.
    const position = this.target?.video
      ? (this.deps.position?.() ?? this.tracker.position ?? undefined)
      : undefined;
    return position === undefined
      ? { type: 'CLOSE', playing: false }
      : { type: 'CLOSE', playing: false, positionSeconds: position };
  }

  private queue(event: StudyEvent): void {
    this.waiting = [...enqueue(this.waiting, event)];
  }

  private clearWork(): void {
    this.waiting = [];
    this.inFlight = null;
    this.afterIdle = null;
    this.resyncs = 0;
  }

  // ---- claim ----

  private claimWanted(takeover = false): void {
    // A claim for a block starts with nothing of the one before it.
    this.clearWork();
    this.target = this.wanted;
    this.claim(false, takeover);
  }

  /**
   * Claims the target block with the ids this tab holds. A silent claim (after a lost lease or a
   * resync) keeps the queue and the tracker and never takes over; the first claim of a block
   * starts again and sends `OPEN`.
   */
  private claim(silent: boolean, takeover = false): void {
    const target = this.target;
    this.stopHeartbeat();
    if (!target) {
      this.protocol = null;
      this.state.phase.set('idle');
      return;
    }
    const userId = this.deps.userId();
    const previous =
      this.held ??
      (userId ? this.deps.storage.read(userId, target.enrollmentId) : null);
    this.busy = true;
    if (!silent) {
      this.state.phase.set('claiming');
      this.state.error.set(null);
    }
    this.deps.client
      .call(learnerEndpoints.openSession, {
        body: {
          enrollmentId: target.enrollmentId,
          blockId: target.blockId,
          takeover,
          ...(previous
            ? {
                previousSessionId: previous.sessionId,
                previousFence: previous.sessionFence,
              }
            : {}),
        },
      })
      .subscribe({
        next: (session) => this.claimed(target, session, silent),
        error: (error: unknown) => {
          this.busy = false;
          const failure = toAppError(error);
          this.state.error.set(failure);
          this.settle(actionFor(failure, silent ? 'reclaim' : 'claim'));
        },
      });
  }

  private claimed(
    target: ClaimTarget,
    session: StudySession,
    silent: boolean,
  ): void {
    this.busy = false;
    this.remember(session);
    if (!silent && (this.destroyed || !this.wanted)) {
      this.closeLease(target, session);
      return;
    }
    if (!silent && target !== this.wanted) {
      // The learner moved on while this claim was in flight. It is a real lease on the server,
      // so its ids are kept for the next claim, which studies the block wanted now.
      this.claimWanted();
      return;
    }
    this.protocol = fromClaim(session);
    this.state.session.set(session);
    this.state.phase.set('ready');
    this.startHeartbeat();
    if (silent) {
      this.pump();
      return;
    }
    this.tracker = NOT_PLAYING;
    this.resyncs = 0;
    this.state.save.set('idle');
    const resume = session.resume?.lastVideoPositionSeconds;
    this.queue(
      target.video
        ? { type: 'OPEN', playing: false, positionSeconds: resume ?? 0 }
        : { type: 'OPEN' },
    );
    this.pump();
  }

  /**
   * A claim that answers after nobody wants it any more is still a lease on the server: it is
   * closed at once and nothing else starts (no `OPEN`, no heartbeat, no new claim).
   */
  private closeLease(target: ClaimTarget, session: StudySession): void {
    this.target = target;
    this.protocol = fromClaim(session);
    this.tracker = NOT_PLAYING;
    this.state.phase.set('idle');
    this.waiting = [{ type: 'CLOSE', playing: false }];
    this.pump();
  }

  private remember(session: StudySession): void {
    this.held = {
      sessionId: session.sessionId,
      sessionFence: session.sessionFence,
    };
    const userId = this.deps.userId();
    if (userId)
      this.deps.storage.write(userId, session.enrollmentId, this.held);
  }

  /** Puts a refusal into the phase the page shows. Nothing is sent from a phase but `ready`. */
  private settle(action: RefusalAction): void {
    this.stopHeartbeat();
    this.waiting = [];
    this.inFlight = null;
    // Nothing is saved from a refused phase; a failed save keeps saying so.
    if (action !== 'save-failed') this.state.save.set('idle');
    this.state.phase.set(
      {
        'prompt-takeover': 'takeover',
        moved: 'moved',
        'media-changed': 'media-changed',
        'block-error': 'block-error',
        'page-error': 'page-error',
        'save-failed': 'failed',
        reclaim: 'failed',
        resync: 'failed',
      }[action] as StudyPhase,
    );
  }

  // ---- events ----

  private pump(): void {
    if (this.busy) return;
    if (!this.inFlight) {
      const event = this.waiting.shift();
      if (!event) {
        this.finishSave(true);
        this.runAfterIdle();
        return;
      }
      if (!this.protocol) return;
      const { command, tracker } = toCommand(
        this.protocol,
        this.tracker,
        event,
      );
      this.inFlight = { event, command, tracker };
    }
    const { command, tracker } = this.inFlight;
    const target = this.target;
    if (!target) return;
    const { enrollmentId, blockId } = target;
    this.busy = true;
    this.deps.client
      .call(learnerEndpoints.saveProgress, {
        params: { enrollmentId, blockId },
        body: command,
      })
      .subscribe({
        next: (result) => this.acknowledged(result, tracker),
        error: (error: unknown) => this.refused(error),
      });
  }

  private acknowledged(result: ProgressResult, tracker: PlayTracker): void {
    this.busy = false;
    this.inFlight = null;
    this.resyncs = 0;
    if (this.protocol) this.protocol = afterResult(this.protocol, result);
    this.tracker = tracker;
    this.state.save.set('saved');
    this.deps.accepted(result);
    this.pump();
  }

  private refused(error: unknown): void {
    this.busy = false;
    this.finishSave(false);
    if (this.destroyed) {
      // The page is gone: a `CLOSE` that cannot be sent is dropped, not claimed again.
      this.inFlight = null;
      this.waiting = [];
      return;
    }
    const failure = toAppError(error);
    const action = actionFor(failure, 'event', this.resyncs);
    switch (action) {
      case 'reclaim': {
        // The lease ran out: claim again quietly and send the same event with the new ids.
        const event = this.inFlight?.event;
        this.inFlight = null;
        if (event) this.waiting.unshift(event);
        this.claim(true);
        return;
      }
      case 'resync':
        // Out of step: drop the event, claim again for a fresh sequence and version, and have
        // the enrolment read again.
        this.resyncs += 1;
        this.inFlight = null;
        this.deps.resync();
        this.claim(true);
        return;
      case 'save-failed':
        // The queue keeps the unsent event; "Thử lại" sends it again unchanged.
        this.state.save.set('failed');
        this.state.error.set(failure);
        // A block change does not wait for a `CLOSE` that cannot be sent.
        if (this.afterIdle) {
          this.inFlight = null;
          this.waiting = [];
          this.runAfterIdle();
        }
        return;
      default:
        this.state.error.set(failure);
        this.settle(action);
    }
  }

  private runAfterIdle(): void {
    const next = this.afterIdle;
    this.afterIdle = null;
    next?.();
  }

  private finishSave(saved: boolean): void {
    const callback = this.onSaved;
    this.onSaved = null;
    callback?.(saved);
  }

  // ---- heartbeat ----

  private startHeartbeat(): void {
    this.stopHeartbeat();
    if (this.destroyed) return;
    this.heartbeat = interval(HEARTBEAT_MS).subscribe(() => {
      // A playing video reports every 10 s itself, with its range.
      if (this.deps.visible() && !this.tracker.playing) {
        // The server requires a position on every event of a video block.
        const position = this.target?.video ? this.tracker.position : null;
        this.send(
          position === null
            ? { type: 'HEARTBEAT', playing: false }
            : { type: 'HEARTBEAT', playing: false, positionSeconds: position },
        );
      }
    });
  }

  private stopHeartbeat(): void {
    this.heartbeat?.unsubscribe();
    this.heartbeat = undefined;
  }
}
