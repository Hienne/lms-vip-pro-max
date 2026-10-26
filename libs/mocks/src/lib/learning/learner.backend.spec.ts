import {
  authV1Endpoints,
  CourseCardSchema,
  EnrollmentDetailSchema,
  learnerEndpoints,
  LearningProgressOverviewSchema,
  PageSchema,
  type AnyEndpoint,
  type CourseCard,
  type EnrollmentDetail,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

const CardPage = PageSchema(CourseCardSchema);

describe('the learner reads of the mock backend', () => {
  let backend: FakeBackend;
  beforeEach(() => (backend = new FakeBackend()));

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

  const cards = (
    token: string,
    endpoint: AnyEndpoint,
    query: Record<string, string> = {},
  ): CourseCard[] =>
    CardPage.parse(
      call(endpoint, token, { query: { size: '100', ...query } }).body.data,
    ).items;

  const detail = (token: string, enrollmentId: number): FakeReply =>
    call(learnerEndpoints.enrollment, token, {
      params: { enrollmentId: String(enrollmentId) },
    });

  it('gives the assigned course the backend card fields', () => {
    const token = login('hocvien');
    const card = cards(token, learnerEndpoints.myCourses).find(
      (c) => c.courseId === 1,
    );
    expect(card).toMatchObject({
      learningStatus: 'in_progress',
      assigned: true,
      cycleNo: 1,
      deadlineStatus: 'on_time_active',
    });
    expect(card?.enrollmentId).toBeGreaterThan(0);
    expect(card?.requiredLessonCount).toBe(card?.lessonCount);
    expect(card?.completedRequiredLessonCount).toBeGreaterThan(0);
    expect(card?.lastLessonId).toBeGreaterThan(0);
    expect(card?.lastBlockId).toBeGreaterThan(0);
    expect(card?.startedAt).toBeTruthy();
  });

  it('lists an optional published course the learner has not joined, in the catalogue only', () => {
    const token = login('hocvien');
    const open = cards(token, learnerEndpoints.catalog).find(
      (c) => c.requirement === 'optional' && !c.enrollmentId,
    );
    expect(open).toBeTruthy();
    expect(open?.deadlineStatus).toBe('no_deadline');
    expect(
      cards(token, learnerEndpoints.myCourses).some(
        (c) => c.courseId === open?.courseId,
      ),
    ).toBe(false);
  });

  it('answers the enrollment of the caller with content and a progress row for every lesson and block', () => {
    const token = login('hocvien');
    const card = cards(token, learnerEndpoints.myCourses).find(
      (c) => c.courseId === 1,
    )!;
    const reply = detail(token, card.enrollmentId!);
    expect(reply.status).toBe(200);
    const result: EnrollmentDetail = EnrollmentDetailSchema.parse(
      reply.body.data,
    );
    const lessons = result.content.chapters.flatMap((c) => c.lessons);
    const blocks = lessons.flatMap((l) => l.blocks);
    expect(result.enrollment.id).toBe(card.enrollmentId);
    expect(result.lessons.map((l) => l.lessonId).sort()).toEqual(
      lessons.map((l) => l.lesson.id).sort(),
    );
    expect(result.blocks.map((b) => b.blockId).sort()).toEqual(
      blocks.map((b) => b.block.id).sort(),
    );
    expect(result.enrollment.lastBlockId).toBe(card.lastBlockId);
    expect(result.enrollment.progressPercent).toBe(card.progressPercent);
  });

  it('gives the assigned course every block type, every completion mode and a quiz lesson', () => {
    const token = login('hocvien');
    const card = cards(token, learnerEndpoints.myCourses).find(
      (c) => c.courseId === 1,
    )!;
    const { content } = EnrollmentDetailSchema.parse(
      detail(token, card.enrollmentId!).body.data,
    );
    const lessons = content.chapters.flatMap((c) => c.lessons);
    const blocks = lessons.flatMap((l) => l.blocks.map((b) => b.block));
    expect(new Set(blocks.map((b) => b.blockType))).toEqual(
      new Set(['video', 'pdf', 'text', 'process', 'image', 'attachment']),
    );
    expect(new Set(blocks.map((b) => b.completionMode))).toEqual(
      new Set(['video_coverage', 'pdf_end', 'manual', 'open']),
    );
    expect(lessons.some((l) => l.lesson.lessonType === 'quiz')).toBe(true);
    const assets = lessons.flatMap((l) => l.blocks.flatMap((b) => b.assets));
    expect(assets.some((a) => a.asset.pageCount)).toBe(true);
    expect(assets.some((a) => a.asset.durationSeconds)).toBe(true);
  });

  it("refuses another learner's enrollment with 403 and an unknown one as not found", () => {
    const owner = login('hocvien');
    const card = cards(owner, learnerEndpoints.myCourses).find(
      (c) => c.courseId === 1,
    )!;
    const other = login('hocvien.tichhop');
    const refused = detail(other, card.enrollmentId!);
    expect(refused.status).toBe(403);
    expect(refused.body.messageCode).toBe('CORE-ACCESS_DENIED');
    expect(detail(owner, 987654).body.messageCode).toBe(
      'CORE-RESOURCE_NOT_FOUND',
    );
  });

  it('enrols in the optional course: the card gains an enrollment and the detail opens with nothing done', () => {
    const token = login('hocvien');
    const open = cards(token, learnerEndpoints.catalog).find(
      (c) => c.requirement === 'optional' && !c.enrollmentId,
    )!;
    const enrolled = call(learnerEndpoints.enroll, token, {
      params: { courseId: String(open.courseId) },
    });
    expect(enrolled.status).toBe(200);
    const after = cards(token, learnerEndpoints.catalog).find(
      (c) => c.courseId === open.courseId,
    )!;
    expect(after.enrollmentId).toBeGreaterThan(0);
    expect(after.learningStatus).toBe('not_started');
    const result = EnrollmentDetailSchema.parse(
      detail(token, after.enrollmentId!).body.data,
    );
    expect(result.enrollment.courseId).toBe(open.courseId);
    expect(result.blocks.every((b) => b.status === 'not_started')).toBe(true);
    expect(
      cards(token, learnerEndpoints.myCourses).some(
        (c) => c.courseId === open.courseId,
      ),
    ).toBe(true);
  });
  describe('the progress page', () => {
    const summary = (token: string) =>
      LearningProgressOverviewSchema.parse(
        call(learnerEndpoints.progressSummary, token).body.data,
      );

    it('counts the caller own cycles, whatever a table filter says', () => {
      const token = login('hocvien');
      const mine = cards(token, learnerEndpoints.myCourses);
      const { counts, activity, assessment, competency } = summary(token);
      expect(counts.total).toBe(mine.length);
      expect(counts.completed).toBe(
        mine.filter((c) => c.learningStatus === 'completed').length,
      );
      expect(counts.inProgress).toBe(
        mine.filter((c) => c.learningStatus === 'in_progress').length,
      );
      expect(counts.notStarted).toBe(
        mine.filter(
          (c) => (c.learningStatus ?? 'not_started') === 'not_started',
        ).length,
      );
      expect(counts.overdue).toBe(mine.filter((c) => c.overdue).length);
      expect(counts.overdue).toBeGreaterThan(0);
      expect([activity, assessment, competency]).toEqual(
        Array(3).fill({ availability: 'unavailable' }),
      );
    });

    it('lists only the overdue courses for `overdue=true`', () => {
      const token = login('hocvien');
      const overdue = cards(token, learnerEndpoints.myCourses, {
        overdue: 'true',
      });
      expect(overdue.length).toBeGreaterThan(0);
      expect(overdue.every((c) => c.overdue)).toBe(true);
    });

    it('filters by a learning status', () => {
      const token = login('hocvien');
      const done = cards(token, learnerEndpoints.myCourses, {
        learningStatus: 'completed',
      });
      expect(done.every((c) => c.learningStatus === 'completed')).toBe(true);
    });

    it.each([
      'startedAt',
      'lastAccessAt',
      'completedAt',
      'progressPercent',
      'id',
    ])('sorts by %s in both directions', (field) => {
      const token = login('hocvien');
      const up = cards(token, learnerEndpoints.myCourses, {
        sort: `${field},asc`,
      }).map((c) => c.courseId);
      const down = cards(token, learnerEndpoints.myCourses, {
        sort: `${field},desc`,
      }).map((c) => c.courseId);
      expect(new Set(up)).toEqual(new Set(down));
      expect(up.length).toBeGreaterThan(1);
    });

    it('exports the filtered rows as a UTF-8 CSV with a BOM and the backend header', async () => {
      const token = login('hocvien');
      const rows = cards(token, learnerEndpoints.myCourses, {
        learningStatus: 'in_progress',
      });
      const reply = call(learnerEndpoints.exportProgress, token, {
        query: { learningStatus: 'in_progress' },
      });
      expect(reply.file?.type).toBe('text/csv');
      // `Blob.text()` drops a BOM while decoding, so the bytes are read.
      const bytes = new Uint8Array(await reply.file!.arrayBuffer());
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
      const text = await reply.file!.text();
      expect(text.startsWith('Mã khóa,Tên khóa,Lần học,')).toBe(true);
      const lines = text.trimEnd().split('\r\n');
      expect(lines.length).toBe(rows.length + 1);
      expect(lines[1]).toContain(`"${rows[0].code}"`);
      expect(lines[1]).toContain(`"${rows[0].title}"`);
    });

    it('does not page the export', async () => {
      const token = login('hocvien');
      const all = cards(token, learnerEndpoints.myCourses).length;
      const reply = call(learnerEndpoints.exportProgress, token, {
        query: { page: '0', size: '1' },
      });
      expect((await reply.file!.text()).trimEnd().split('\r\n').length).toBe(
        all + 1,
      );
    });

    it('refuses an export over the row limit with LEARNING-EXPORT_TOO_LARGE', () => {
      const token = login('hocvien');
      backend.limitProgressExport(1);
      const reply = call(learnerEndpoints.exportProgress, token);
      expect(reply.file).toBeUndefined();
      expect(reply.body.messageCode).toBe('LEARNING-EXPORT_TOO_LARGE');
    });
  });
});
