import {
  authV1Endpoints,
  CourseCardSchema,
  EnrollmentDetailSchema,
  LearnerCourseSchema,
  LearnerFacetsSchema,
  learnerEndpoints,
  LearningProgressOverviewSchema,
  LearningReminderSchema,
  PageSchema,
  shellEndpoints,
  type AnyEndpoint,
  type CourseCard,
  type EnrollmentDetail,
} from '@lms/contracts';
import { z } from 'zod';
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
      expect([activity, competency]).toEqual(
        Array(2).fill({ availability: 'unavailable' }),
      );
      expect(assessment).toMatchObject({ availability: 'available' });
    });

    it('serves each learner their own score figures, and none to an account without quizzes', () => {
      expect(summary(login('hocvien')).assessment).toMatchObject({
        availability: 'available',
        bestScorePercent: 90,
        passedQuizCount: 1,
        last: { scorePercent: 66.67, passed: false },
      });
      expect(summary(login('hocvien.tichhop')).assessment).toEqual({
        availability: 'available',
        last: null,
        bestScorePercent: null,
        averageScorePercent: null,
        passedQuizCount: 0,
        quizCount: 2,
      });
      expect(summary(login('giangvien')).assessment).toEqual({
        availability: 'unavailable',
      });
    });

    it('puts the final exam score on the card of a course the learner took it in', () => {
      const token = login('hocvien');
      const scores = Object.fromEntries(
        cards(token, learnerEndpoints.myCourses).map((c) => [
          c.courseId,
          c.bestScorePercent,
        ]),
      );
      expect(scores[2]).toBe(40);
      expect(scores[5]).toBe(90);
      expect(scores[1]).toBeNull();
      expect(
        cards(token, learnerEndpoints.catalog).find((c) => c.courseId === 2)
          ?.bestScorePercent,
      ).toBe(40);
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

    it('ends the CSV with the best score column, empty when the card has none', async () => {
      const token = login('hocvien');
      const rows = cards(token, learnerEndpoints.myCourses);
      const text = await call(
        learnerEndpoints.exportProgress,
        token,
      ).file!.text();
      const lines = text.trimEnd().split('\r\n');
      expect(lines[0].endsWith(',Trạng thái hạn,Điểm cao nhất')).toBe(true);
      rows.forEach((row, index) => {
        const last = lines[index + 1].split('","').pop()!.replace(/"$/, '');
        expect(last).toBe(row.bestScorePercent?.toString() ?? '');
      });
      expect(rows.some((row) => row.bestScorePercent !== null)).toBe(true);
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

  describe('reminders', () => {
    const Reminders = z.array(LearningReminderSchema);
    const list = (token: string) =>
      Reminders.parse(call(learnerEndpoints.reminders, token).body.data);
    const markRead = (token: string, reminderId: number) =>
      call(learnerEndpoints.markReminderRead, token, {
        params: { reminderId: String(reminderId) },
      });
    const navCount = (token: string) =>
      (
        call(shellEndpoints.navCounts, token).body.data as {
          notifications: number;
        }
      ).notifications;

    it('lists the three due reminders of the learner, pending, one of them overdue', () => {
      const items = list(login('hocvien'));
      expect(items).toHaveLength(3);
      expect(items.every((r) => r.status === 'pending')).toBe(true);
      expect(
        items.every(
          (r) => new Date(r.scheduledAt ?? '').getTime() <= Date.now(),
        ),
      ).toBe(true);
      expect(
        items.filter(
          (r) => new Date(r.dueAtSnapshot ?? '').getTime() < Date.now(),
        ),
      ).toHaveLength(1);
    });

    it('lists nothing for a person with none, and never a reminder not yet scheduled', () => {
      expect(list(login('giangvien'))).toEqual([]);
      expect(list(login('hocvien.tichhop'))).toEqual([]);
    });

    it('sets a reminder to sent, so it leaves the list', () => {
      const token = login('hocvien');
      const [first, ...rest] = list(token);
      const reply = markRead(token, first.id);
      const read = LearningReminderSchema.parse(reply.body.data);
      expect(read).toMatchObject({ id: first.id, status: 'sent' });
      expect(read.sentAt).toBeTruthy();
      expect(list(token).map((r) => r.id)).toEqual(rest.map((r) => r.id));
    });

    it("refuses another user's reminder with a 403 and keeps it listed", () => {
      const owner = login('hocvien');
      const [first] = list(owner);
      const reply = markRead(login('hocvien.tichhop'), first.id);
      expect(reply.body.messageCode).toBe('CORE-ACCESS_DENIED');
      expect(list(owner)).toHaveLength(3);
    });

    it('answers not found for an id nobody has', () => {
      expect(markRead(login('hocvien'), 99_999).body.messageCode).toBe(
        'CORE-RESOURCE_NOT_FOUND',
      );
    });

    it('is the number the bell shows on the mock: the due reminders of the caller', () => {
      const token = login('hocvien');
      expect(navCount(token)).toBe(3);
      markRead(token, list(token)[0].id);
      expect(navCount(token)).toBe(2);
      expect(navCount(login('giangvien'))).toBe(0);
    });
  });

  describe('catalogue discovery', () => {
    it('gives every card its field, programme and module names', () => {
      const token = login('hocvien');
      const all = cards(token, learnerEndpoints.catalog);
      const withNames = all.filter((c) => c.programName && c.fieldName);
      expect(withNames.length).toBeGreaterThan(0);
      expect(
        withNames.every((c) => typeof c.fieldId === 'number' && c.fieldId > 0),
      ).toBe(true);
    });

    it('marks a failed final exam on the card without making it a learning status', () => {
      const token = login('hocvien');
      const all = cards(token, learnerEndpoints.myCourses);
      const failed = all.filter((c) => c.failed);
      expect(failed.map((c) => c.courseId)).toEqual([2]);
      expect(failed[0].learningStatus).toBe('in_progress');
      expect(all.some((c) => c.learningStatus === ('failed' as never))).toBe(
        false,
      );
    });

    it.each([
      ['assigned', (c: CourseCard) => c.assigned],
      ['failed', (c: CourseCard) => c.failed],
      ['overdue', (c: CourseCard) => c.overdue],
    ] as const)('filters both lists by `%s`', (flag, pick) => {
      const token = login('hocvien');
      for (const endpoint of [
        learnerEndpoints.myCourses,
        learnerEndpoints.catalog,
      ]) {
        const everything = cards(token, endpoint);
        const yes = cards(token, endpoint, { [flag]: 'true' });
        const no = cards(token, endpoint, { [flag]: 'false' });
        expect(yes.map((c) => c.courseId)).toEqual(
          everything.filter((c) => pick(c)).map((c) => c.courseId),
        );
        expect(no.map((c) => c.courseId)).toEqual(
          everything.filter((c) => !pick(c)).map((c) => c.courseId),
        );
        expect(yes.length).toBeGreaterThan(0);
      }
    });

    it('combines the flags with a learning status', () => {
      const token = login('hocvien');
      const both = cards(token, learnerEndpoints.catalog, {
        assigned: 'true',
        learningStatus: 'in_progress',
      });
      expect(both.length).toBeGreaterThan(0);
      expect(
        both.every((c) => c.assigned && c.learningStatus === 'in_progress'),
      ).toBe(true);
    });

    it('lists the fields, programmes and modules of the visible courses, in order', () => {
      const token = login('hocvien');
      const facets = LearnerFacetsSchema.parse(
        call(learnerEndpoints.facets, token).body.data,
      );
      const visible = cards(token, learnerEndpoints.catalog);
      expect(facets.fields.map((f) => f.id)).toEqual(
        [...new Set(visible.map((c) => c.fieldId))]
          .filter((id): id is number => typeof id === 'number')
          .sort((a, b) => a - b),
      );
      expect(facets.modules.length).toBeGreaterThan(0);
      for (const item of [...facets.programs, ...facets.modules]) {
        expect(facets.fields.some((f) => f.id === item.fieldId)).toBe(true);
      }
    });

    it('answers a visible course with its content, and empty blocks when not enrolled', () => {
      const token = login('hocvien.tichhop');
      const open = cards(token, learnerEndpoints.catalog).find(
        (c) => !c.enrollmentId,
      )!;
      const reply = call(learnerEndpoints.course, token, {
        params: { courseId: String(open.courseId) },
      });
      const result = LearnerCourseSchema.parse(reply.body.data);
      expect(result.card.courseId).toBe(open.courseId);
      const lessons = result.content.chapters.flatMap((c) => c.lessons);
      expect(lessons.length).toBeGreaterThan(0);
      expect(lessons.every((l) => l.blocks.length === 0)).toBe(true);
    });

    it('answers an enrolled course with every block', () => {
      const token = login('hocvien');
      const reply = call(learnerEndpoints.course, token, {
        params: { courseId: '1' },
      });
      const result = LearnerCourseSchema.parse(reply.body.data);
      expect(result.card.enrollmentId).toBeGreaterThan(0);
      expect(
        result.content.chapters
          .flatMap((c) => c.lessons)
          .some((l) => l.blocks.length > 0),
      ).toBe(true);
    });

    it('refuses an unknown course with LEARNING-NOT_FOUND', () => {
      const token = login('hocvien');
      const reply = call(learnerEndpoints.course, token, {
        params: { courseId: '999999' },
      });
      expect(reply.body.messageCode).toBe('LEARNING-NOT_FOUND');
    });

    it('counts the assigned and mandatory courses in the summary like the lists do', () => {
      const token = login('hocvien');
      const counts = LearningProgressOverviewSchema.parse(
        call(learnerEndpoints.progressSummary, token).body.data,
      ).counts;
      const mine = cards(token, learnerEndpoints.myCourses);
      expect(counts.assigned).toBe(mine.filter((c) => c.assigned).length);
      expect(counts.mandatory).toBe(
        mine.filter((c) => c.requirement === 'mandatory').length,
      );
    });
  });
});
