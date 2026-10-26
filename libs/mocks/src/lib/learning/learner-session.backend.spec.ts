import {
  authV1Endpoints,
  CourseCardSchema,
  EnrollmentDetailSchema,
  learnerEndpoints,
  PageSchema,
  ProgressResultSchema,
  StudySessionSchema,
  type AnyEndpoint,
  type BlockType,
  type EnrollmentDetail,
  type ProgressEventType,
  type ProgressResult,
  type SaveProgressCommand,
  type StudySession,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

const CardPage = PageSchema(CourseCardSchema);

describe('the study session protocol of the mock backend', () => {
  let backend: FakeBackend;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T09:00:00Z'));
    backend = new FakeBackend();
  });
  afterEach(() => vi.useRealTimers());

  const call = (
    endpoint: AnyEndpoint,
    token: string | null,
    request: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token,
      params: request.params ?? {},
      query: request.query ?? {},
      body: request.body,
    }) as FakeReply;

  const login = (username: string): string =>
    (
      call(authV1Endpoints.login, null, {
        body: { username, password: SEED_PASSWORD },
      }).body.data as { accessToken: string }
    ).accessToken;

  const detailOf = (token: string, courseId: number): EnrollmentDetail => {
    const cards = CardPage.parse(
      call(learnerEndpoints.catalog, token, { query: { size: '100' } }).body
        .data,
    ).items;
    const card = cards.find((c) => c.courseId === courseId);
    return EnrollmentDetailSchema.parse(
      call(learnerEndpoints.enrollment, token, {
        params: { enrollmentId: String(card?.enrollmentId) },
      }).body.data,
    );
  };

  const enrolInCourse7 = (token: string): EnrollmentDetail => {
    call(learnerEndpoints.enroll, token, { params: { courseId: '7' } });
    return detailOf(token, 7);
  };

  const blockOf = (detail: EnrollmentDetail, type: BlockType) => {
    const found = detail.content.chapters
      .flatMap((c) => c.lessons)
      .flatMap((l) => l.blocks)
      .find((b) => b.block.blockType === type)!;
    return {
      id: found.block.id,
      assetId: found.assets[0]?.asset.id ?? null,
      asset: found.assets[0]?.asset,
    };
  };

  const claim = (
    token: string,
    detail: EnrollmentDetail,
    blockId: number,
    extra: Record<string, unknown> = {},
  ): FakeReply =>
    call(learnerEndpoints.openSession, token, {
      body: {
        enrollmentId: detail.enrollment.id,
        blockId,
        takeover: false,
        ...extra,
      },
    });

  const sessionOf = (reply: FakeReply): StudySession =>
    StudySessionSchema.parse(reply.body.data);

  const send = (
    token: string,
    detail: EnrollmentDetail,
    blockId: number,
    event: Partial<SaveProgressCommand> &
      Pick<SaveProgressCommand, 'sessionId' | 'sessionFence' | 'eventType'>,
    state: { sequence: number; version: number; assetId: number | null },
  ): FakeReply =>
    call(learnerEndpoints.saveProgress, token, {
      params: {
        enrollmentId: String(detail.enrollment.id),
        blockId: String(blockId),
      },
      body: {
        assetId: state.assetId,
        playing: false,
        expectedVersion: state.version,
        sequence: state.sequence,
        complete: false,
        ...event,
      } satisfies SaveProgressCommand,
    });

  /** A player: claims, then sends events with the sequence and version the server last answered. */
  const player = (
    token: string,
    detail: EnrollmentDetail,
    block: { id: number; assetId: number | null },
  ) => {
    const claimed = sessionOf(claim(token, detail, block.id));
    const state = {
      sequence: claimed.lastAcceptedSequence + 1,
      version: claimed.expectedVersion,
      assetId: block.assetId,
    };
    return {
      session: claimed,
      emit(
        eventType: ProgressEventType,
        extra: Partial<SaveProgressCommand> = {},
      ): { reply: FakeReply; result?: ProgressResult } {
        const reply = send(
          token,
          detail,
          block.id,
          {
            sessionId: claimed.sessionId,
            sessionFence: claimed.sessionFence,
            eventType,
            ...extra,
          },
          state,
        );
        if (reply.body.status !== 'SUCCESS') return { reply };
        const result = ProgressResultSchema.parse(reply.body.data);
        state.sequence = result.session.lastAcceptedSequence + 1;
        state.version = result.block.rowVersion;
        return { reply, result };
      },
    };
  };

  describe('claiming', () => {
    it('grants a session at the block with its resume row and a 60 s lease', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const pdf = blockOf(detail, 'pdf');
      const reply = claim(token, detail, pdf.id);
      expect(reply.status).toBe(200);
      const session = sessionOf(reply);
      expect(session).toMatchObject({
        sessionFence: 1,
        lastAcceptedSequence: 0,
        enrollmentId: detail.enrollment.id,
        blockId: pdf.id,
        assetId: pdf.assetId,
      });
      expect(session.resume?.lastPdfPage).toBe(3);
      expect(Date.parse(session.leaseExpiresAt) - Date.now()).toBe(60_000);
    });

    it('refuses a claim while another device holds the lease, and moves it only on a takeover', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const pdf = blockOf(detail, 'pdf');
      const first = sessionOf(claim(token, detail, pdf.id));
      const refused = claim(token, detail, pdf.id);
      expect(refused.body.messageCode).toBe('LEARNING-SESSION_IN_USE');
      const moved = sessionOf(claim(token, detail, pdf.id, { takeover: true }));
      expect(moved.sessionFence).toBe(first.sessionFence + 1);
      expect(moved.sessionId).not.toBe(first.sessionId);
    });

    it('lets the same tab change block with its previous ids, and returns the same session on a reload', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const pdf = blockOf(detail, 'pdf');
      const process = blockOf(detail, 'process');
      const first = sessionOf(claim(token, detail, pdf.id));
      const same = sessionOf(
        claim(token, detail, pdf.id, {
          previousSessionId: first.sessionId,
          previousFence: first.sessionFence,
        }),
      );
      expect(same.sessionId).toBe(first.sessionId);
      expect(same.sessionFence).toBe(first.sessionFence);
      const next = sessionOf(
        claim(token, detail, process.id, {
          previousSessionId: first.sessionId,
          previousFence: first.sessionFence,
        }),
      );
      expect(next.sessionId).not.toBe(first.sessionId);
      expect(next.sessionFence).toBe(first.sessionFence + 1);
      expect(next.lastAcceptedSequence).toBe(0);
    });

    it('lets a new claim in after the lease ran out, with a higher fence', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const pdf = blockOf(detail, 'pdf');
      const first = sessionOf(claim(token, detail, pdf.id));
      vi.advanceTimersByTime(61_000);
      const second = sessionOf(claim(token, detail, pdf.id));
      expect(second.sessionFence).toBe(first.sessionFence + 1);
    });

    it("refuses another learner's enrollment and a block outside it", () => {
      const detail = detailOf(login('hocvien'), 1);
      const other = login('hocvien.tichhop');
      const pdf = blockOf(detail, 'pdf');
      expect(claim(other, detail, pdf.id).status).toBe(403);
      const token = login('hocvien');
      expect(claim(token, detail, 999999).body.messageCode).toBe(
        'CORE-RESOURCE_NOT_FOUND',
      );
    });
  });

  describe('events', () => {
    it('accepts events in order, advances the version, and re-ACKs the same payload without side effects', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const pdf = blockOf(detail, 'pdf');
      const claimed = sessionOf(claim(token, detail, pdf.id));
      const state = {
        sequence: 1,
        version: claimed.expectedVersion,
        assetId: pdf.assetId,
      };
      const open = {
        sessionId: claimed.sessionId,
        sessionFence: claimed.sessionFence,
        eventType: 'OPEN' as const,
      };
      const first = ProgressResultSchema.parse(
        send(token, detail, pdf.id, open, state).body.data,
      );
      expect(first.session).toMatchObject({
        lastAcceptedSequence: 1,
        leaseState: 'active',
      });
      expect(first.block.rowVersion).toBe(claimed.expectedVersion + 1);
      vi.advanceTimersByTime(30_000);
      const again = ProgressResultSchema.parse(
        send(token, detail, pdf.id, open, state).body.data,
      );
      expect(again.block.rowVersion).toBe(first.block.rowVersion);
      expect(again.session.leaseExpiresAt).toBe(first.session.leaseExpiresAt);
    });

    it('refuses a skipped sequence, the same sequence with another payload and a wrong version', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const pdf = blockOf(detail, 'pdf');
      const p = player(token, detail, pdf);
      p.emit('OPEN');
      const base = {
        sessionId: p.session.sessionId,
        sessionFence: p.session.sessionFence,
        assetId: pdf.assetId,
        playing: false,
        complete: false,
      } as const;
      const stale = (sequence: number, version: number, pdfPage?: number) =>
        send(
          token,
          detail,
          pdf.id,
          { ...base, eventType: 'PDF_PAGE', pdfPage },
          { sequence, version, assetId: pdf.assetId },
        ).body.messageCode;
      expect(stale(3, 1, 4)).toBe('LEARNING-STALE_EVENT');
      expect(stale(1, 0, 4)).toBe('LEARNING-STALE_EVENT');
      expect(stale(2, 0, 4)).toBe('LEARNING-CONFLICT');
    });

    it('refuses an event on a session that was taken over, one after the lease ran out, and one after CLOSE', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const pdf = blockOf(detail, 'pdf');
      const old = player(token, detail, pdf);
      old.emit('OPEN');
      sessionOf(claim(token, detail, pdf.id, { takeover: true }));
      expect(old.emit('HEARTBEAT').reply.body.messageCode).toBe(
        'LEARNING-SESSION_EXPIRED',
      );

      vi.advanceTimersByTime(61_000);
      const lapsed = player(token, detail, pdf);
      lapsed.emit('OPEN');
      vi.advanceTimersByTime(61_000);
      expect(lapsed.emit('HEARTBEAT').reply.body.messageCode).toBe(
        'LEARNING-SESSION_EXPIRED',
      );

      const closing = player(token, detail, pdf);
      closing.emit('OPEN');
      const closed = closing.emit('CLOSE');
      expect(closed.result?.session.leaseState).toBe('released');
      expect(closing.emit('HEARTBEAT').reply.body.messageCode).toBe(
        'LEARNING-SESSION_EXPIRED',
      );
      expect(claim(token, detail, pdf.id).body.status).toBe('SUCCESS');
    });

    it('keeps the lease alive on each accepted event', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const pdf = blockOf(detail, 'pdf');
      const p = player(token, detail, pdf);
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(30_000);
        expect(p.emit('HEARTBEAT').reply.body.status).toBe('SUCCESS');
      }
    });

    it('refuses an event for another asset than the block plays', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const pdf = blockOf(detail, 'pdf');
      const p = player(token, detail, pdf);
      expect(
        p.emit('OPEN', { assetId: (pdf.assetId ?? 0) + 1 }).reply.body
          .messageCode,
      ).toBe('LEARNING-MEDIA_CHANGED');
    });
  });

  describe('scoring (a stand-in for the backend)', () => {
    it('completes a manual block on COMPLETE and moves the lesson and course percentages', () => {
      const token = login('hocvien');
      const detail = enrolInCourse7(token);
      const lessons = detail.content.chapters.flatMap((c) => c.lessons);
      const closing = lessons.at(-1)!.blocks[0];
      expect(closing.block.completionMode).toBe('manual');
      const p = player(token, detail, { id: closing.block.id, assetId: null });
      const open = p.emit('OPEN').result!;
      expect(open.block.status).toBe('in_progress');
      expect(open.enrollment.progressPercent).toBe(0);
      const done = p.emit('COMPLETE', { complete: true }).result!;
      expect(done.block.status).toBe('completed');
      expect(done.block.progressPercent).toBe(100);
      expect(done.lesson.status).toBe('completed');
      expect(done.lesson.progressPercent).toBe(100);
      expect(done.enrollment.progressPercent).toBe(33);
      expect(done.enrollment.lastBlockId).toBe(closing.block.id);
    });

    it('completes an open block when it is opened', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const image = blockOf(detail, 'image');
      const p = player(token, detail, image);
      expect(p.emit('OPEN').result?.block.status).toBe('completed');
    });

    it('completes a pdf_end block on the last page only, and never lowers a finished one', () => {
      const token = login('hocvien');
      const detail = detailOf(token, 1);
      const pdf = blockOf(detail, 'pdf');
      const pages = pdf.asset?.pageCount ?? 0;
      const p = player(token, detail, pdf);
      p.emit('OPEN');
      const mid = p.emit('PDF_PAGE', { pdfPage: 5 }).result!;
      expect(mid.block.lastPdfPage).toBe(5);
      expect(mid.block.status).toBe('in_progress');
      expect(
        p.emit('PDF_PAGE', { pdfPage: pages + 1 }).reply.body.messageCode,
      ).toBe('CORE-VALIDATION_FAILED');
      const last = p.emit('PDF_PAGE', { pdfPage: pages }).result!;
      expect(last.block.status).toBe('completed');
      const back = p.emit('PDF_PAGE', { pdfPage: 2 }).result!;
      expect(back.block.lastPdfPage).toBe(2);
      expect(back.block.status).toBe('completed');
    });

    it('credits a video from the watched ranges within twice the elapsed time, and completes it at the threshold', () => {
      const token = login('hocvien');
      const detail = enrolInCourse7(token);
      const video = blockOf(detail, 'video');
      const p = player(token, detail, video);
      p.emit('OPEN', { videoPositionSeconds: 0 });
      p.emit('PLAY', { videoPositionSeconds: 0, playing: true });
      vi.advanceTimersByTime(10_000);
      const first = p.emit('HEARTBEAT', {
        videoPositionSeconds: 10,
        watchedFromSeconds: 0,
        watchedToSeconds: 10,
        playing: true,
      }).result!;
      expect(first.block.watchedSeconds).toBe(10);
      expect(first.block.status).toBe('in_progress');

      // Eight beats of 60 s of video in 30 s of server time: the 2x ceiling, inside the lease.
      let done = first;
      for (let from = 10; from < 490; from += 60) {
        vi.advanceTimersByTime(30_000);
        done = p.emit('HEARTBEAT', {
          videoPositionSeconds: from + 60,
          watchedFromSeconds: from,
          watchedToSeconds: from + 60,
          playing: true,
        }).result!;
      }
      expect(done.block.watchedSeconds).toBe(490);
      expect(done.block.status).toBe('completed');
    });

    it('gives no credit for a range faster than twice real time, after a pause, or on a seek', () => {
      const token = login('hocvien');
      const detail = enrolInCourse7(token);
      const video = blockOf(detail, 'video');
      const p = player(token, detail, video);
      p.emit('OPEN', { videoPositionSeconds: 0 });
      p.emit('PLAY', { videoPositionSeconds: 0, playing: true });
      vi.advanceTimersByTime(10_000);
      const fast = p.emit('HEARTBEAT', {
        videoPositionSeconds: 500,
        watchedFromSeconds: 0,
        watchedToSeconds: 500,
        playing: true,
      }).result!;
      expect(fast.block.watchedSeconds).toBeLessThanOrEqual(20);

      const paused = p.emit('PAUSE', { videoPositionSeconds: 500 }).result!;
      const after = p.emit('HEARTBEAT', {
        videoPositionSeconds: 600,
        watchedFromSeconds: 500,
        watchedToSeconds: 600,
      }).result!;
      expect(after.block.watchedSeconds).toBe(paused.block.watchedSeconds);

      const seek = p.emit('SEEK', {
        videoPositionSeconds: 600,
        watchedFromSeconds: 0,
        watchedToSeconds: 600,
      }).result!;
      expect(seek.block.watchedSeconds).toBe(paused.block.watchedSeconds);
      expect(seek.block.status).not.toBe('completed');
    });
  });
});
