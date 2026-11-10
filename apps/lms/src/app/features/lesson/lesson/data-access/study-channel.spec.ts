import {
  learnerEndpoints,
  type ProgressResult,
  type SaveProgressCommand,
  type StudySession,
} from '@lms/contracts';
import { Observable } from 'rxjs';
import { ApiError } from '../../../../core/http/api-error';
import type { EndpointClient } from '../../../../core/http/endpoint-client';
import {
  HEARTBEAT_MS,
  StudyChannel,
  type ClaimTarget,
  type StudyChannelDeps,
} from './study-channel';
import type { StudySessionStorage } from './study-session.storage';

/** A request the channel sent, held until the spec answers or fails it. */
interface Call {
  readonly endpoint: unknown;
  readonly body: unknown;
  closed: boolean;
  answer(value: unknown): void;
  fail(error: unknown): void;
}

const BLOCK_A: ClaimTarget = { enrollmentId: 1, blockId: 10, video: false };
const BLOCK_B: ClaimTarget = { enrollmentId: 1, blockId: 20, video: true };
const VIDEO_A: ClaimTarget = { enrollmentId: 1, blockId: 10, video: true };

const expired = () =>
  new ApiError('LEARNING-SESSION_EXPIRED', undefined, 'Phiên đã hết hạn', 409);

describe('StudyChannel', () => {
  let calls: Call[];
  let channel: StudyChannel;
  let visible: boolean;
  let leases: number;
  let inFlight: number;
  /** The most requests the channel had open at once. */
  let peak: number;
  /** Where the player is now, as the page reads it when the channel closes a block. */
  let position: number | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    visible = true;
    leases = 0;
    inFlight = 0;
    peak = 0;
    position = undefined;
    const client = {
      call: (endpoint: unknown, request: { body?: unknown }) =>
        new Observable<unknown>((subscriber) => {
          // The slot is free as soon as the answer is on its way, before the handlers run: what
          // they send next is a new request, not one beside this.
          const done = () => {
            if (call.closed) return;
            call.closed = true;
            inFlight -= 1;
          };
          const call: Call = {
            endpoint,
            body: request.body,
            closed: false,
            answer: (value) => {
              done();
              subscriber.next(value);
              subscriber.complete();
            },
            fail: (error) => {
              done();
              subscriber.error(error);
            },
          };
          calls.push(call);
          peak = Math.max(peak, ++inFlight);
          return done;
        }),
    } as unknown as EndpointClient;
    const deps: StudyChannelDeps = {
      client,
      storage: {
        read: () => null,
        write: () => undefined,
      } as unknown as StudySessionStorage,
      userId: () => 'u1',
      visible: () => visible,
      position: () => position,
      accepted: () => undefined,
      resync: () => undefined,
    };
    channel = new StudyChannel(deps);
  });

  afterEach(() => {
    channel.destroy();
    vi.useRealTimers();
  });

  const claims = () =>
    calls.filter((c) => c.endpoint === learnerEndpoints.openSession);
  const events = () =>
    calls.filter((c) => c.endpoint === learnerEndpoints.saveProgress);
  const sentEvents = () => events().map((c) => c.body as SaveProgressCommand);
  const types = () => sentEvents().map((e) => e.eventType);

  const session = (blockId: number): StudySession => ({
    sessionId: `00000000-0000-4000-8000-00000000000${++leases}`,
    sessionFence: leases,
    leaseExpiresAt: '2026-10-27T10:01:00',
    lastAcceptedSequence: 0,
    enrollmentId: 1,
    blockId,
    assetId: null,
    expectedVersion: 1,
    resume: null,
  });
  const result = (command: SaveProgressCommand): ProgressResult =>
    ({
      block: { rowVersion: command.expectedVersion + 1 },
      session: {
        sessionId: command.sessionId,
        sessionFence: command.sessionFence,
        lastAcceptedSequence: command.sequence,
        leaseState: command.eventType === 'CLOSE' ? 'released' : 'active',
      },
    }) as unknown as ProgressResult;

  /** Answers the request at `index` of its kind: a claim with a fresh lease, an event with a receipt. */
  const claimAnswered = (index = claims().length - 1) => {
    const call = claims()[index];
    const body = call.body as { blockId: number };
    call.answer(session(body.blockId));
  };
  const eventAnswered = (index = events().length - 1) => {
    const call = events()[index];
    call.answer(result(call.body as SaveProgressCommand));
  };

  /** Answers every event still open, and the ones sent because of those answers. */
  const drain = () => {
    for (let open = events().filter((c) => !c.closed); open.length; ) {
      for (const call of open)
        call.answer(result(call.body as SaveProgressCommand));
      open = events().filter((c) => !c.closed);
    }
  };

  /** The channel on `target` with its `OPEN` acknowledged. */
  function open(target: ClaimTarget = BLOCK_A): void {
    channel.switchTo(target);
    claimAnswered();
    eventAnswered();
    expect(channel.phase$()).toBe('ready');
  }

  describe('after destroy', () => {
    it('does not start a heartbeat for a claim that answers late, and only closes its lease', () => {
      channel.switchTo(BLOCK_A);
      expect(channel.phase$()).toBe('claiming');

      channel.destroy();
      claimAnswered();
      drain();
      vi.advanceTimersByTime(HEARTBEAT_MS * 3);
      drain();

      expect(types()).toEqual(['CLOSE']);
      expect(claims()).toHaveLength(1);
    });

    it('closes the lease of a claim that answers after the page stopped wanting a block', () => {
      channel.switchTo(BLOCK_A);
      channel.switchTo(undefined);
      claimAnswered();
      drain();
      vi.advanceTimersByTime(HEARTBEAT_MS * 3);
      drain();

      expect(types()).toEqual(['CLOSE']);
      expect(claims()).toHaveLength(1);
      expect(channel.phase$()).toBe('idle');
    });

    it('does not restart the heartbeat when the lease expired before the closing claim answers', () => {
      open();
      vi.advanceTimersByTime(HEARTBEAT_MS);
      expect(types()).toEqual(['OPEN', 'HEARTBEAT']);
      events()[1].fail(expired());
      expect(claims()).toHaveLength(2);

      channel.destroy();
      claimAnswered();
      drain();
      vi.advanceTimersByTime(HEARTBEAT_MS * 3);
      drain();

      // The refused heartbeat is sent again with the new lease, then the close; no timer after.
      expect(types()).toEqual(['OPEN', 'HEARTBEAT', 'HEARTBEAT', 'CLOSE']);
      expect(claims()).toHaveLength(2);
    });

    it('does not claim again when its closing event is refused as expired', () => {
      open();
      channel.destroy();
      expect(types()).toEqual(['OPEN', 'CLOSE']);

      events()[1].fail(expired());
      vi.advanceTimersByTime(HEARTBEAT_MS * 3);

      expect(claims()).toHaveLength(1);
      expect(types()).toEqual(['OPEN', 'CLOSE']);
    });

    it('ignores what the player reports and what the page asks for', () => {
      open();
      channel.destroy();
      const sent = calls.length;

      channel.send({ type: 'PAUSE', playing: false, positionSeconds: 3 });
      channel.retry();
      channel.reclaim();
      channel.takeOver();
      channel.switchTo(BLOCK_B);

      expect(calls).toHaveLength(sent);
    });
  });

  it('claims the next block only after the unwanted lease is closed', () => {
    channel.switchTo(BLOCK_A);
    channel.switchTo(undefined);
    claimAnswered();
    channel.switchTo(BLOCK_B);
    expect(types()).toEqual(['CLOSE']);
    expect(claims()).toHaveLength(1);

    eventAnswered();
    expect(claims()).toHaveLength(2);
    expect(claims()[1].body).toMatchObject({ blockId: 20 });
  });

  describe('closing a block', () => {
    const play = () => {
      channel.send({ type: 'PLAY', playing: true, positionSeconds: 0 });
      eventAnswered();
    };
    const closing = () =>
      sentEvents().find((command) => command.eventType === 'CLOSE');

    it('carries the range played since the last report when the block changes', () => {
      open(VIDEO_A);
      play();
      position = 7;

      channel.switchTo(BLOCK_B);

      expect(closing()).toMatchObject({
        videoPositionSeconds: 7,
        watchedFromSeconds: 0,
        watchedToSeconds: 7,
      });
    });

    it('carries the range played when the page is left', () => {
      open(VIDEO_A);
      play();
      position = 12;

      channel.destroy();

      expect(closing()).toMatchObject({
        watchedFromSeconds: 0,
        watchedToSeconds: 12,
      });
    });

    it('carries no range when the video was paused', () => {
      open(VIDEO_A);
      play();
      channel.send({ type: 'PAUSE', playing: false, positionSeconds: 3 });
      eventAnswered();
      position = 9;
      channel.switchTo(BLOCK_B);
      expect(closing()).not.toHaveProperty('watchedFromSeconds');
    });
  });

  it('saves a paused range even when the PLAY receipt has not arrived', () => {
    open(VIDEO_A);
    channel.send({ type: 'PLAY', playing: true, positionSeconds: 0 });
    channel.send({ type: 'PAUSE', positionSeconds: 3 });
    drain();

    expect(types()).toEqual(['OPEN', 'PLAY', 'PAUSE']);
    expect(sentEvents()[2]).toMatchObject({
      watchedFromSeconds: 0,
      watchedToSeconds: 3,
    });
  });

  describe('changing block', () => {
    const failed = () =>
      new ApiError('CORE-INTERNAL_ERROR', undefined, 'Lỗi hệ thống', 500);

    it('keeps one close in flight during rapid Next, Back and route leave', () => {
      open(BLOCK_A);
      channel.switchTo(BLOCK_B);
      channel.switchTo(BLOCK_A);
      channel.switchTo(BLOCK_B);
      vi.advanceTimersByTime(HEARTBEAT_MS * 3);
      expect(types()).toEqual(['OPEN', 'CLOSE']);
      channel.destroy();
      drain();
      expect(types()).toEqual(['OPEN', 'CLOSE']);
      expect(claims()).toHaveLength(1);
      expect(peak).toBe(1);
    });

    it('pauses automatic progress requests until a failed write is retried explicitly', () => {
      open(VIDEO_A);
      channel.send({ type: 'PLAY', playing: true, positionSeconds: 0 });
      events()[1].fail(failed());
      channel.send({ type: 'HEARTBEAT', playing: true, positionSeconds: 10 });
      vi.advanceTimersByTime(HEARTBEAT_MS * 3);
      expect(types()).toEqual(['OPEN', 'PLAY']);
      channel.retry();
      expect(sentEvents()[2]).toEqual(sentEvents()[1]);
      drain();
      expect(types()).toEqual(['OPEN', 'PLAY', 'PLAY', 'HEARTBEAT']);
    });

    it('stops reclaiming after repeated expiration of the same event', () => {
      open(BLOCK_A);
      vi.advanceTimersByTime(HEARTBEAT_MS);
      for (let i = 0; i < 2; i++) {
        events().at(-1)!.fail(expired());
        claimAnswered();
      }
      events().at(-1)!.fail(expired());
      vi.advanceTimersByTime(HEARTBEAT_MS * 3);
      expect(claims()).toHaveLength(3);
      expect(channel.save$()).toBe('failed');
    });

    it('sends what is queued for the old block, then closes it, then claims the new one', () => {
      open(BLOCK_A);
      vi.advanceTimersByTime(HEARTBEAT_MS);
      channel.send({ type: 'COMPLETE', complete: true });

      channel.switchTo(BLOCK_B);
      drain();

      expect(types()).toEqual(['OPEN', 'HEARTBEAT', 'COMPLETE', 'CLOSE']);
      expect(claims()).toHaveLength(2);
      expect(claims()[1].body).toMatchObject({ blockId: 20 });
    });

    it('resends the event it could not save once, then moves on without closing the old block', () => {
      open(BLOCK_A);
      vi.advanceTimersByTime(HEARTBEAT_MS);
      events()[1].fail(failed());
      expect(channel.save$()).toBe('failed');

      channel.switchTo(BLOCK_B);
      expect(types()).toEqual(['OPEN', 'HEARTBEAT', 'HEARTBEAT']);
      events()[2].fail(failed());
      expect(claims()).toHaveLength(2);
      claimAnswered();
      drain();

      // The new block starts clean: nothing of the old one is sent with the new lease.
      expect(types()).toEqual(['OPEN', 'HEARTBEAT', 'HEARTBEAT', 'OPEN']);
    });
  });

  describe('claiming again', () => {
    it('waits for the event in flight, so only one request is open at a time', () => {
      open(BLOCK_A);
      vi.advanceTimersByTime(HEARTBEAT_MS);
      expect(types()).toEqual(['OPEN', 'HEARTBEAT']);

      channel.reclaim();
      expect(claims()).toHaveLength(1);

      eventAnswered();
      expect(claims()).toHaveLength(2);
      claimAnswered();
      drain();

      expect(types()).toEqual(['OPEN', 'HEARTBEAT', 'OPEN']);
      expect(peak).toBe(1);
      expect(channel.phase$()).toBe('ready');
    });
  });
});
