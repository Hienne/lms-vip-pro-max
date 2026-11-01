import { toUrl } from '../http/endpoint';
import { learnerEndpoints } from './learner.endpoints';
import { capturedLearner as captured } from './learner.captured';
import {
  EnrollmentDetailSchema,
  LearnerCourseSchema,
  LearnerFacetsSchema,
  LearningProgressOverviewSchema,
  MyCoursesQuerySchema,
  OpenSessionCommandSchema,
  ProgressExportQuerySchema,
  ProgressResultSchema,
  SaveProgressCommandSchema,
  StudySessionSchema,
} from './learner.schema';

const SESSION_ID = '550e8400-e29b-41d4-a716-446655440001';

const stamp = { rowVersion: 0, createTime: '2026-10-20T08:00:00' };

/** A received revision with no chapters yet; the authoring spec parses a full tree. */
const content = {
  course: {
    id: 7,
    code: 'CB-101',
    ownerOrgId: 1,
    lifecycleStatus: 'active',
    ...stamp,
  },
  revision: {
    id: 70,
    courseId: 7,
    revisionNo: 1,
    state: 'published',
    ...stamp,
  },
  objectives: [],
  chapters: [],
};

describe('learner endpoints', () => {
  it('declare the backend paths and methods', () => {
    expect(
      Object.entries(learnerEndpoints).map(([key, e]) => [
        key,
        e.method,
        e.path,
      ]),
    ).toEqual([
      ['catalog', 'get', '/api/v1/me/learning/catalog'],
      ['myCourses', 'get', '/api/v1/me/learning/courses'],
      ['course', 'get', '/api/v1/me/learning/courses/{courseId}'],
      ['facets', 'get', '/api/v1/me/learning/facets'],
      ['progressSummary', 'get', '/api/v1/me/learning/progress/summary'],
      ['exportProgress', 'get', '/api/v1/me/learning/progress/export'],
      ['enroll', 'post', '/api/v1/courses/{courseId}/enrollments'],
      ['enrollment', 'get', '/api/v1/me/learning/enrollments/{enrollmentId}'],
      ['openSession', 'post', '/api/v1/me/learning/sessions'],
      [
        'saveProgress',
        'put',
        '/api/v1/me/learning/enrollments/{enrollmentId}/blocks/{blockId}/progress',
      ],
      ['reminders', 'get', '/api/v1/me/learning/reminders'],
      [
        'markReminderRead',
        'post',
        '/api/v1/me/learning/reminders/{reminderId}/read',
      ],
    ]);
    expect(
      toUrl(learnerEndpoints.saveProgress, { enrollmentId: 2, blockId: 31 }),
    ).toBe('/api/v1/me/learning/enrollments/2/blocks/31/progress');
  });

  it('parses an enrolment with its content and progress', () => {
    const detail = EnrollmentDetailSchema.parse({
      enrollment: {
        id: 2,
        courseId: 7,
        revisionId: 70,
        userId: '00123',
        status: 'in_progress',
        progressPercent: 25,
        lastBlockId: 31,
        ...stamp,
      },
      content,
      lessons: [
        {
          id: 3,
          enrollmentId: 2,
          lessonId: 21,
          status: 'in_progress',
          ...stamp,
        },
      ],
      blocks: [
        {
          id: 4,
          enrollmentId: 2,
          blockId: 31,
          status: 'in_progress',
          lastVideoPositionSeconds: 30,
          lastEventSequence: 6,
          mediaAssetId: 12,
          watchedSeconds: 45.5,
          ...stamp,
        },
      ],
    });
    expect(detail.blocks[0].lastEventSequence).toBe(6);
    expect(detail.blocks[0].mediaAssetId).toBe(12);
    expect(detail.blocks[0].watchedSeconds).toBe(45.5);
  });

  it('checks a progress event against the backend rules', () => {
    const event = {
      sessionId: SESSION_ID,
      sessionFence: 1,
      eventType: 'HEARTBEAT',
      assetId: 501,
      playing: true,
      expectedVersion: 0,
      sequence: 7,
      complete: false,
      videoPositionSeconds: 45,
      watchedFromSeconds: 30,
      watchedToSeconds: 45,
    };
    expect(SaveProgressCommandSchema.parse(event).sequence).toBe(7);
    expect(
      SaveProgressCommandSchema.safeParse({ ...event, pdfPage: 0 }).success,
    ).toBe(false);
    // The session fields are required: an event without a claim is refused by the backend.
    const { sessionId: _sessionId, ...withoutSession } = event;
    expect(SaveProgressCommandSchema.safeParse(withoutSession).success).toBe(
      false,
    );
    const { sequence: _sequence, ...withoutSequence } = event;
    expect(SaveProgressCommandSchema.safeParse(withoutSequence).success).toBe(
      false,
    );
    expect(
      SaveProgressCommandSchema.safeParse({ ...event, eventType: 'RESUME' })
        .success,
    ).toBe(false);
  });

  it('claims a session for a block, with the previous pair only when the tab holds one', () => {
    expect(
      OpenSessionCommandSchema.parse({
        enrollmentId: 2,
        blockId: 31,
        takeover: false,
      }),
    ).toEqual({ enrollmentId: 2, blockId: 31, takeover: false });
    expect(
      OpenSessionCommandSchema.parse({
        enrollmentId: 2,
        blockId: 31,
        previousSessionId: SESSION_ID,
        previousFence: 3,
        takeover: true,
      }).previousFence,
    ).toBe(3);
    expect(
      OpenSessionCommandSchema.safeParse({ enrollmentId: 2, blockId: 31 })
        .success,
    ).toBe(false);
  });

  it('parses the study session the backend grants and the receipt of a progress result', () => {
    const session = StudySessionSchema.parse({
      sessionId: SESSION_ID,
      sessionFence: 1,
      leaseExpiresAt: '2026-10-26T16:24:04.063803Z',
      lastAcceptedSequence: 0,
      enrollmentId: 3,
      blockId: 1,
      assetId: null,
      expectedVersion: 0,
      resume: null,
    });
    expect(session.sessionFence).toBe(1);
    const stamped = { rowVersion: 1, createTime: '2026-10-20T08:00:00' };
    const result = ProgressResultSchema.parse({
      block: {
        id: 4,
        enrollmentId: 3,
        blockId: 1,
        status: 'in_progress',
        ...stamped,
      },
      lesson: {
        id: 3,
        enrollmentId: 3,
        lessonId: 21,
        status: 'in_progress',
        ...stamped,
      },
      enrollment: {
        id: 3,
        courseId: 7,
        revisionId: 70,
        userId: '00123',
        status: 'in_progress',
        ...stamped,
      },
      session: {
        sessionId: SESSION_ID,
        sessionFence: 1,
        lastAcceptedSequence: 2,
        leaseState: 'active',
        leaseExpiresAt: '2026-10-26T16:25:04.063803Z',
      },
    });
    expect(result.session.lastAcceptedSequence).toBe(2);
  });
  describe('progress overview and export', () => {
    const overview = {
      serverTime: '2026-10-26T10:00:00Z',
      timeZone: 'Asia/Ho_Chi_Minh',
      counts: {
        total: 5,
        completed: 1,
        inProgress: 2,
        notStarted: 1,
        overdue: 1,
        assigned: 4,
        mandatory: 3,
      },
      activity: { availability: 'unavailable' },
      assessment: { availability: 'unavailable' },
      competency: { availability: 'unavailable' },
    };

    it('parses the summary the backend sends', () => {
      expect(LearningProgressOverviewSchema.parse(overview).counts).toEqual(
        overview.counts,
      );
    });

    it('refuses a summary without the assigned and mandatory counts', () => {
      const { assigned: _assigned, ...counts } = overview.counts;
      expect(
        LearningProgressOverviewSchema.safeParse({ ...overview, counts })
          .success,
      ).toBe(false);
    });

    it('refuses a summary without counts', () => {
      const { counts: _counts, ...without } = overview;
      expect(LearningProgressOverviewSchema.safeParse(without).success).toBe(
        false,
      );
    });

    it('takes the assigned, failed and overdue flags on both lists', () => {
      const flags = { assigned: true, failed: false, overdue: true };
      expect(MyCoursesQuerySchema.parse(flags)).toEqual(flags);
      expect(learnerEndpoints.catalog.query?.safeParse(flags).success).toBe(
        true,
      );
      expect(MyCoursesQuerySchema.safeParse({ failed: 'true' }).success).toBe(
        false,
      );
      expect(
        learnerEndpoints.catalog.query?.safeParse({ learningStatus: 'failed' })
          .success,
      ).toBe(false);
      expect(ProgressExportQuerySchema.parse(flags)).toEqual(flags);
    });

    it('takes a typed status and the overdue flag on the table query', () => {
      expect(
        MyCoursesQuerySchema.parse({
          learningStatus: 'in_progress',
          overdue: true,
        }),
      ).toEqual({ learningStatus: 'in_progress', overdue: true });
      expect(
        MyCoursesQuerySchema.safeParse({ learningStatus: 'overdue' }).success,
      ).toBe(false);
    });

    it('exports the table query without paging', () => {
      const query = ProgressExportQuerySchema.parse({
        q: 'core',
        sort: 'dueAt,asc',
        page: 3,
        size: 20,
      });
      expect(query).toEqual({ q: 'core', sort: 'dueAt,asc' });
    });

    it('declares the export as a file', () => {
      expect(learnerEndpoints.exportProgress.responseType).toBe('blob');
    });
  });

  describe('catalogue discovery', () => {
    const responses = {
      catalog: captured.catalog,
      course: captured.courseEnrolled,
      facets: captured.facets,
      progressSummary: captured.progressSummary,
    } as const;

    it.each(Object.entries(responses))(
      'parses the response captured from the backend for %s',
      (key, data) => {
        const endpoint = learnerEndpoints[key as keyof typeof responses];
        expect(endpoint.response.safeParse(data).success).toBe(true);
      },
    );

    it('reads the names and the failed flag the card carries', () => {
      const [failed, other] = learnerEndpoints.catalog.response.parse(
        captured.catalog,
      ).items;
      expect(failed).toMatchObject({
        failed: true,
        fieldName: 'Nghiệp vụ Core Banking',
        programName: 'Nền tảng nghiệp vụ Core Banking',
        moduleName: 'Tổng quan',
      });
      expect(other.failed).toBe(false);
    });

    it('lists the facets with the field of each programme and module', () => {
      const facets = LearnerFacetsSchema.parse(captured.facets);
      expect(facets.fields.map((f) => f.name)).toContain(
        'Vận hành và quy trình',
      );
      expect(facets.programs.every((p) => typeof p.fieldId === 'number')).toBe(
        true,
      );
      expect(facets.modules.every((m) => typeof m.fieldId === 'number')).toBe(
        true,
      );
      expect(
        LearnerFacetsSchema.safeParse({ ...facets, modules: undefined })
          .success,
      ).toBe(false);
      expect(
        LearnerFacetsSchema.safeParse({
          ...facets,
          programs: [{ id: 1, code: 'P', name: 'Chương trình' }],
        }).success,
      ).toBe(false);
    });

    it('keeps the outline of a course the caller has not enrolled in, without blocks', () => {
      const visible = LearnerCourseSchema.parse(captured.courseVisible);
      const lessons = visible.content.chapters.flatMap((c) => c.lessons);
      expect(visible.card.enrollmentId).toBeNull();
      expect(lessons.length).toBeGreaterThan(0);
      expect(lessons.every((l) => l.blocks.length === 0)).toBe(true);
      expect(visible.card.moduleName).toBeNull();
    });

    it('refuses a course without its card or its content', () => {
      const { card: _card, ...withoutCard } = captured.courseEnrolled;
      expect(LearnerCourseSchema.safeParse(withoutCard).success).toBe(false);
      const { content: _content, ...withoutContent } = captured.courseEnrolled;
      expect(LearnerCourseSchema.safeParse(withoutContent).success).toBe(false);
    });

    it('builds the course url from the id', () => {
      expect(toUrl(learnerEndpoints.course, { courseId: 8 })).toBe(
        '/api/v1/me/learning/courses/8',
      );
    });
  });
});
