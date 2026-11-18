import type {
  BlockProgress,
  ProgressResult,
  StudySession,
} from '@lms/contracts';
import type { AppError } from '../../../../core/errors/app-error';
import {
  actionFor,
  afterResult,
  enqueue,
  fromClaim,
  MAX_RESYNCS,
  NOT_PLAYING,
  toCommand,
  type PlayTracker,
  type ProtocolState,
  type StudyEvent,
} from './study-protocol';

const SESSION_ID = '5b0c1c3e-5d57-4a3f-9a3f-0c6f6f0a1b01';

const claim: StudySession = {
  sessionId: SESSION_ID,
  sessionFence: 3,
  leaseExpiresAt: '2026-10-26T10:01:00',
  lastAcceptedSequence: 4,
  enrollmentId: 11,
  blockId: 21,
  assetId: 7,
  expectedVersion: 9,
  resume: null,
};

const state: ProtocolState = fromClaim(claim);

const result = (over: {
  sequence?: number;
  version?: number;
  fence?: number;
  session?: string;
}): ProgressResult =>
  ({
    block: { rowVersion: over.version ?? 10 } as BlockProgress,
    lesson: {},
    enrollment: {},
    session: {
      sessionId: over.session ?? SESSION_ID,
      sessionFence: over.fence ?? 3,
      lastAcceptedSequence: over.sequence ?? 5,
      leaseState: 'active',
    },
  }) as unknown as ProgressResult;

const failure = (messageCode?: string, kind: AppError['kind'] = 'refused') =>
  ({ kind, message: 'x', messageCode }) as AppError;

describe('study protocol', () => {
  describe('the state a claim and a result leave', () => {
    it('starts at the session sequence and version', () => {
      expect(state).toEqual({
        sessionId: SESSION_ID,
        sessionFence: 3,
        assetId: 7,
        lastSequence: 4,
        version: 9,
      });
    });

    it('takes the next sequence and version from the result', () => {
      const next = afterResult(state, result({ sequence: 5, version: 10 }));
      expect(next).toMatchObject({ lastSequence: 5, version: 10 });
      expect(
        toCommand(next, NOT_PLAYING, { type: 'HEARTBEAT' }).command,
      ).toMatchObject({
        sequence: 6,
        expectedVersion: 10,
      });
    });

    it('ignores a result of another session or fence', () => {
      expect(afterResult(state, result({ session: 'other-session' }))).toBe(
        state,
      );
      expect(afterResult(state, result({ fence: 4 }))).toBe(state);
    });

    it('keeps no asset for a block without one', () => {
      expect(fromClaim({ ...claim, assetId: null }).assetId).toBeNull();
      expect(fromClaim({ ...claim, assetId: undefined }).assetId).toBeNull();
    });
  });

  describe('the request of an event', () => {
    it('echoes the session, fence and asset and sends sequence = last + 1', () => {
      const { command } = toCommand(state, NOT_PLAYING, {
        type: 'PDF_PAGE',
        pdfPage: 3,
      });
      expect(command).toEqual({
        sessionId: SESSION_ID,
        sessionFence: 3,
        eventType: 'PDF_PAGE',
        assetId: 7,
        playing: false,
        expectedVersion: 9,
        sequence: 5,
        complete: false,
        pdfPage: 3,
      });
    });

    it('is the same request for the same inputs, so a resend carries the same payload', () => {
      const event: StudyEvent = { type: 'COMPLETE', complete: true };
      expect(toCommand(state, NOT_PLAYING, event)).toEqual(
        toCommand(state, NOT_PLAYING, event),
      );
    });

    it('sends complete only for a completion', () => {
      expect(
        toCommand(state, NOT_PLAYING, { type: 'COMPLETE', complete: true })
          .command.complete,
      ).toBe(true);
      expect(
        toCommand(state, NOT_PLAYING, { type: 'OPEN' }).command.complete,
      ).toBe(false);
    });
  });

  describe('the watched range of a video', () => {
    const playing = (position: number): PlayTracker => ({
      playing: true,
      position,
    });

    it('keeps the fractional tail of the video in the saved range', () => {
      const { command } = toCommand(state, playing(9.914), {
        type: 'PAUSE',
        playing: false,
        positionSeconds: 11.136125,
      });
      expect(command.videoPositionSeconds).toBe(11.136);
      expect(command.watchedFromSeconds).toBe(9.914);
      expect(command.watchedToSeconds).toBe(11.136);
    });

    it('is absent on the first event after OPEN: nothing has played yet', () => {
      const open = toCommand(state, NOT_PLAYING, {
        type: 'OPEN',
        positionSeconds: 120,
      });
      expect(open.command.watchedFromSeconds).toBeUndefined();
      expect(open.tracker).toEqual({ playing: false, position: 120 });
      const play = toCommand(state, open.tracker, {
        type: 'PLAY',
        playing: true,
        positionSeconds: 120,
      });
      expect(play.command.watchedFromSeconds).toBeUndefined();
      expect(play.tracker).toEqual({ playing: true, position: 120 });
    });

    it('goes on a heartbeat that follows a playing event, from the last reported position', () => {
      const beat = toCommand(state, playing(120), {
        type: 'HEARTBEAT',
        playing: true,
        positionSeconds: 130,
      });
      expect(beat.command).toMatchObject({
        watchedFromSeconds: 120,
        watchedToSeconds: 130,
        videoPositionSeconds: 130,
        playing: true,
      });
      expect(beat.tracker).toEqual({ playing: true, position: 130 });
    });

    it('goes on the pause that ends a play and the tracker stops playing', () => {
      const pause = toCommand(state, playing(130), {
        type: 'PAUSE',
        playing: false,
        positionSeconds: 134,
      });
      expect(pause.command).toMatchObject({
        watchedFromSeconds: 130,
        watchedToSeconds: 134,
      });
      expect(pause.tracker).toEqual({ playing: false, position: 134 });
    });

    it('never goes on a SEEK or an OPEN, even while playing', () => {
      for (const type of ['SEEK', 'OPEN'] as const) {
        const { command } = toCommand(state, playing(120), {
          type,
          playing: true,
          positionSeconds: 300,
        });
        expect(command.watchedFromSeconds).toBeUndefined();
        expect(command.watchedToSeconds).toBeUndefined();
      }
    });

    it('keeps a range from spanning a seek: close at the old spot, SEEK with none, play, then range from the new spot', () => {
      const events: StudyEvent[] = [
        { type: 'HEARTBEAT', playing: true, positionSeconds: 25 },
        { type: 'SEEK', playing: false, positionSeconds: 60 },
        { type: 'PLAY', playing: true, positionSeconds: 60 },
        { type: 'HEARTBEAT', playing: true, positionSeconds: 80 },
      ];
      let tracker: PlayTracker = playing(10);
      const sent = events.map((event) => {
        const next = toCommand(state, tracker, event);
        tracker = next.tracker;
        return next.command;
      });

      expect(
        sent.map((c) => [c.watchedFromSeconds, c.watchedToSeconds]),
      ).toEqual([
        [10, 25],
        [undefined, undefined],
        [undefined, undefined],
        [60, 80],
      ]);
      expect(sent[1]).toMatchObject({
        eventType: 'SEEK',
        videoPositionSeconds: 60,
      });
      // No range covers any second between 25 and 60.
      expect(
        sent.some(
          (c) =>
            c.watchedFromSeconds !== undefined &&
            c.watchedFromSeconds < 60 &&
            (c.watchedToSeconds ?? 0) > 25,
        ),
      ).toBe(false);
    });

    it('is absent after a pause: the next heartbeat did not follow a playing event', () => {
      const { command } = toCommand(
        state,
        { playing: false, position: 134 },
        {
          type: 'HEARTBEAT',
          playing: false,
          positionSeconds: 150,
        },
      );
      expect(command.watchedFromSeconds).toBeUndefined();
    });

    it('is absent when the position moved backwards', () => {
      const { command } = toCommand(state, playing(200), {
        type: 'HEARTBEAT',
        playing: true,
        positionSeconds: 100,
      });
      expect(command.watchedFromSeconds).toBeUndefined();
    });

    it('is absent on an event with no position, such as a page or a completion', () => {
      const { command } = toCommand(state, playing(200), {
        type: 'COMPLETE',
        complete: true,
      });
      expect(command.watchedFromSeconds).toBeUndefined();
    });
  });

  describe('the events waiting for the queue', () => {
    const beat = (position: number): StudyEvent => ({
      type: 'HEARTBEAT',
      playing: true,
      positionSeconds: position,
    });

    it('keeps one heartbeat: a newer one replaces the one still waiting', () => {
      expect(enqueue([beat(10)], beat(20))).toEqual([beat(20)]);
    });

    it('keeps every other event in order, and a heartbeat after one', () => {
      const play: StudyEvent = {
        type: 'PLAY',
        playing: true,
        positionSeconds: 5,
      };
      const pause: StudyEvent = { type: 'PAUSE', positionSeconds: 9 };
      expect(enqueue([play], pause)).toEqual([play, pause]);
      expect(enqueue([play], beat(10))).toEqual([play, beat(10)]);
      expect(enqueue([beat(10)], pause)).toEqual([beat(10), pause]);
    });

    describe('a burst of seeks', () => {
      const seek = (position: number): StudyEvent => ({
        type: 'SEEK',
        playing: false,
        positionSeconds: position,
      });
      const play = (position: number): StudyEvent => ({
        type: 'PLAY',
        playing: true,
        positionSeconds: position,
      });

      /** What the player queues for each seek while playing: close, seek, play again. */
      function seekWhilePlaying(
        waiting: readonly StudyEvent[],
        from: number,
        to: number,
      ): readonly StudyEvent[] {
        return [beat(from), seek(to), play(to)].reduce(enqueue, waiting);
      }

      it('replaces a seek still waiting, with the playback queued after it', () => {
        const waiting = [beat(30), seek(40), play(40), beat(41)];
        expect(enqueue(waiting, seek(50))).toEqual([beat(30), seek(50)]);
      });

      it('replaces a seek still waiting while paused', () => {
        expect(enqueue([seek(40)], seek(50))).toEqual([seek(50)]);
      });

      it('keeps a seek once a pause or another event follows it', () => {
        const pause: StudyEvent = { type: 'PAUSE', positionSeconds: 45 };
        expect(enqueue([seek(40), pause], seek(50))).toEqual([
          seek(40),
          pause,
          seek(50),
        ]);
      });

      it('keeps ten seeks in a row to three waiting events', () => {
        let waiting: readonly StudyEvent[] = [];
        let at = 30;
        for (let step = 1; step <= 10; step++) {
          waiting = seekWhilePlaying(waiting, at, at + 10);
          at += 10;
        }
        expect(waiting).toEqual([beat(30), seek(130), play(130)]);
      });

      it('never sends a range over the part skipped by the burst', () => {
        let waiting: readonly StudyEvent[] = [];
        for (const [from, to] of [
          [30, 40],
          [40.4, 50],
          [50.2, 60],
        ]) {
          waiting = seekWhilePlaying(waiting, from, to);
        }
        waiting = enqueue(waiting, beat(80));

        let tracker: PlayTracker = { playing: true, position: 10 };
        const ranges = waiting.map((event) => {
          const next = toCommand(state, tracker, event);
          tracker = next.tracker;
          return [
            next.command.watchedFromSeconds,
            next.command.watchedToSeconds,
          ];
        });
        expect(ranges).toEqual([
          [10, 30],
          [undefined, undefined],
          [undefined, undefined],
          [60, 80],
        ]);
      });
    });
  });

  describe('what a refusal means', () => {
    it.each([
      ['LEARNING-SESSION_IN_USE', 'claim', 'prompt-takeover'],
      ['LEARNING-SESSION_IN_USE', 'reclaim', 'moved'],
      ['LEARNING-SESSION_IN_USE', 'event', 'moved'],
      ['LEARNING-SESSION_EXPIRED', 'event', 'reclaim'],
      ['LEARNING-STALE_EVENT', 'event', 'resync'],
      ['LEARNING-CONFLICT', 'event', 'resync'],
      ['LEARNING-MEDIA_CHANGED', 'event', 'media-changed'],
      ['LEARNING-MEDIA_CHANGED', 'claim', 'media-changed'],
      ['LEARNING-ASSET_PROCESSING', 'claim', 'block-error'],
      ['LEARNING-ASSET_INVALID', 'claim', 'block-error'],
      ['LEARNING-NOT_AVAILABLE', 'claim', 'page-error'],
      ['LEARNING-NOT_AVAILABLE', 'event', 'page-error'],
    ] as const)('%s on %s is %s', (code, phase, action) => {
      expect(actionFor(failure(code), phase)).toBe(action);
    });

    it('sends a stale or conflicting event to a re-claim at most twice in a row', () => {
      expect(
        actionFor(failure('LEARNING-STALE_EVENT'), 'event', MAX_RESYNCS - 1),
      ).toBe('resync');
      expect(
        actionFor(failure('LEARNING-STALE_EVENT'), 'event', MAX_RESYNCS),
      ).toBe('save-failed');
      expect(
        actionFor(failure('LEARNING-CONFLICT'), 'event', MAX_RESYNCS),
      ).toBe('save-failed');
    });

    it('is a page error for a 403 whatever the code', () => {
      expect(actionFor(failure(undefined, 'forbidden'), 'claim')).toBe(
        'page-error',
      );
      expect(
        actionFor(failure('CORE-ACCESS_DENIED', 'forbidden'), 'event'),
      ).toBe('page-error');
    });

    it('is a failed save when offline, on a system failure, or when the lease cannot be renewed', () => {
      expect(actionFor(failure(undefined, 'offline'), 'event')).toBe(
        'save-failed',
      );
      expect(actionFor(failure('CORE-INTERNAL_ERROR', 'server'), 'event')).toBe(
        'save-failed',
      );
      expect(actionFor(failure('LEARNING-SESSION_EXPIRED'), 'reclaim')).toBe(
        'save-failed',
      );
    });
  });
});
