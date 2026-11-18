import type {
  ProgressEventType,
  ProgressResult,
  SaveProgressCommand,
  StudySession,
} from '@lms/contracts';
import type { AppError } from '../../../../core/errors/app-error';

/**
 * The study session protocol as pure functions (SPEC-lesson-player → Study protocol): what to echo
 * on the next event, which video range an event may carry, and what each refusal means. The store
 * owns the signals and the queue; nothing here touches the clock, the network or a signal.
 */

/** What the app must echo on the next event of the block it studies. */
export interface ProtocolState {
  readonly sessionId: string;
  readonly sessionFence: number;
  readonly assetId: number | null;
  /** The receipt's `lastAcceptedSequence`; the next event sends one above it. */
  readonly lastSequence: number;
  /** The block progress's `rowVersion`, sent as `expectedVersion`. */
  readonly version: number;
}

/** What the player reports; the protocol turns it into a request. */
export interface StudyEvent {
  readonly type: ProgressEventType;
  /** True only while a video is actually playing. */
  readonly playing?: boolean;
  readonly positionSeconds?: number;
  readonly pdfPage?: number;
  readonly complete?: boolean;
}

/** Where the last reported video position was, and whether the video was playing there. */
export interface PlayTracker {
  readonly playing: boolean;
  readonly position: number | null;
}

export const NOT_PLAYING: PlayTracker = { playing: false, position: null };

/** The state a claim starts: the session's own sequence and version. */
export function fromClaim(session: StudySession): ProtocolState {
  return {
    sessionId: session.sessionId,
    sessionFence: session.sessionFence,
    assetId: session.assetId ?? null,
    lastSequence: session.lastAcceptedSequence,
    version: session.expectedVersion,
  };
}

/**
 * The state after the server accepted an event: the receipt's sequence and the block's new
 * version. A result of another session or fence leaves the state alone.
 */
export function afterResult(
  state: ProtocolState,
  result: ProgressResult,
): ProtocolState {
  const { session, block } = result;
  if (
    session.sessionId !== state.sessionId ||
    session.sessionFence !== state.sessionFence
  ) {
    return state;
  }
  return {
    ...state,
    lastSequence: session.lastAcceptedSequence,
    version: block.rowVersion,
  };
}

/** Match the stored media precision so the final fraction of a second counts. */
function mediaSecond(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

/** The events that never carry a watched range. */
const RANGELESS: readonly ProgressEventType[] = ['SEEK', 'OPEN'];

/**
 * The request for an event, and the tracker to hold after it. A range goes only on an event that
 * follows one with `playing: true`, is not a `SEEK` or `OPEN`, and moves forward from the last
 * reported position. The same inputs give the same request, so a resend after a lost answer
 * carries the same payload.
 */
export function toCommand(
  state: ProtocolState,
  tracker: PlayTracker,
  event: StudyEvent,
): { command: SaveProgressCommand; tracker: PlayTracker } {
  const playing = event.playing ?? false;
  const position = event.positionSeconds;
  const closesRange =
    tracker.playing &&
    tracker.position !== null &&
    position !== undefined &&
    position >= tracker.position &&
    !RANGELESS.includes(event.type);

  const command: SaveProgressCommand = {
    sessionId: state.sessionId,
    sessionFence: state.sessionFence,
    eventType: event.type,
    assetId: state.assetId,
    playing,
    expectedVersion: state.version,
    sequence: state.lastSequence + 1,
    complete: event.complete ?? false,
    ...(position !== undefined
      ? { videoPositionSeconds: mediaSecond(position) }
      : {}),
    ...(closesRange
      ? {
          watchedFromSeconds: mediaSecond(tracker.position as number),
          watchedToSeconds: mediaSecond(position),
        }
      : {}),
    ...(event.pdfPage !== undefined ? { pdfPage: event.pdfPage } : {}),
  };
  return {
    command,
    tracker: { playing, position: position ?? tracker.position },
  };
}

/**
 * Adds an event to those waiting for the queue. A heartbeat replaces a heartbeat that is still
 * waiting: the newer one covers the same range and more, so they never pile up behind a slow
 * request.
 */
export function enqueue(
  waiting: readonly StudyEvent[],
  event: StudyEvent,
): readonly StudyEvent[] {
  const last = waiting.at(-1);
  if (event.type === 'HEARTBEAT' && last?.type === 'HEARTBEAT') {
    return [...waiting.slice(0, -1), event];
  }
  if (event.type === 'SEEK') {
    const replaced = unsentSeek(waiting);
    if (replaced >= 0) return [...waiting.slice(0, replaced), event];
  }
  return [...waiting, event];
}

/**
 * Where a seek still waiting starts, when only playback after it has been queued since (its PLAY and
 * heartbeats); -1 otherwise. A newer seek replaces that whole run: the range before the first seek
 * was already closed by the heartbeat ahead of it, a seek carries no range, and the PLAY after the
 * newer seek opens the next one, so dropping the run only ever drops watched time, never adds any.
 * Holding an arrow key on the progress bar then keeps the queue at a few events, not one burst per
 * key repeat.
 */
function unsentSeek(waiting: readonly StudyEvent[]): number {
  for (let index = waiting.length - 1; index >= 0; index--) {
    const type = waiting[index].type;
    if (type === 'SEEK') return index;
    if (type !== 'PLAY' && type !== 'HEARTBEAT') return -1;
  }
  return -1;
}

/** Where a refusal happened: the claim, an event, or the silent claim after `SESSION_EXPIRED`. */
export type RefusalPhase = 'claim' | 'event' | 'reclaim';

/** How many times in a row a stale or conflicting event is answered by a re-claim. */
export const MAX_RESYNCS = 2;

export type RefusalAction =
  /** Ask before moving the session here: the learner must click "Học trên thiết bị này". */
  | 'prompt-takeover'
  /** The lease ran out: claim again without asking. */
  | 'reclaim'
  /** Another device took the session while this one ran. */
  | 'moved'
  /** The event was out of step: drop it, claim again and reload the enrolment. */
  | 'resync'
  /** The block's content changed under the learner. */
  | 'media-changed'
  /** Only this block cannot be shown; the others stay usable. */
  | 'block-error'
  /** The whole page cannot be shown. */
  | 'page-error'
  /** Nothing is saved for now; the queue keeps the unsent event and the learner may retry. */
  | 'save-failed';

/**
 * What each failure of the claim or of an event means for the player. `resyncs` counts the
 * stale or conflicting answers in a row, so a loop of re-claims ends in `save-failed`.
 */
export function actionFor(
  error: AppError,
  phase: RefusalPhase,
  resyncs = 0,
): RefusalAction {
  if (error.kind === 'forbidden') return 'page-error';
  switch (error.messageCode) {
    case 'LEARNING-SESSION_IN_USE':
      return phase === 'claim' ? 'prompt-takeover' : 'moved';
    case 'LEARNING-SESSION_EXPIRED':
      return phase === 'event' && resyncs < MAX_RESYNCS
        ? 'reclaim'
        : 'save-failed';
    case 'LEARNING-STALE_EVENT':
    case 'LEARNING-CONFLICT':
      return resyncs < MAX_RESYNCS ? 'resync' : 'save-failed';
    case 'LEARNING-MEDIA_CHANGED':
      return 'media-changed';
    case 'LEARNING-ASSET_PROCESSING':
    case 'LEARNING-ASSET_INVALID':
      return 'block-error';
    case 'LEARNING-NOT_AVAILABLE':
      return 'page-error';
    default:
      return 'save-failed';
  }
}
