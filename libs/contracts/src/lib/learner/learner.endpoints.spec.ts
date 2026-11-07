import { CourseCardSchema } from '../course/course.schema';
import { toUrl } from '../http/endpoint';
import { learnerEndpoints } from './learner.endpoints';
import { capturedLearner as captured } from './learner.captured';
import { capturedLessonPlayer } from './lesson-player.captured';
import {
  EnrollmentDetailSchema,
  LeaderboardViewSchema,
  LeaderboardQuerySchema,
  LearnerCourseSchema,
  AssessmentOverviewSchema,
  LearnerFacetsSchema,
  LearningDashboardSchema,
  LearningProgressOverviewSchema,
  MyCoursesQuerySchema,
  MyPointsSchema,
  MyLevelSchema,
  MyStreakSchema,
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
      ['dashboard', 'get', '/api/v1/me/learning/dashboard'],
      ['dashboardPrograms', 'get', '/api/v1/me/learning/dashboard/programs'],
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
      ['myPoints', 'get', '/api/v1/me/learning/points'],
      ['myLevel', 'get', '/api/v1/me/learning/level'],
      ['adjustXp', 'post', '/api/v1/admin/learning/xp-adjustments'],
      ['myStreak', 'get', '/api/v1/me/learning/streak'],
      ['leaderboard', 'get', '/api/v1/me/learning/leaderboard'],
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
    const completion = {
      completedRequiredLessons: 2,
      requiredLessons: 2,
      lessonsSatisfied: true,
      finalQuizId: 9,
      finalExamStatus: 'NOT_PASSED',
      allSatisfied: false,
    };
    expect(
      EnrollmentDetailSchema.parse({ ...detail, completion }).completion,
    ).toEqual(completion);
    expect(
      EnrollmentDetailSchema.safeParse({
        ...detail,
        completion: { ...completion, finalExamStatus: 'UNKNOWN' },
      }).success,
    ).toBe(false);
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

    describe('the score figures', () => {
      const available = {
        availability: 'available',
        last: {
          quizId: 1,
          quizTitle: 'Luyện tập',
          courseId: 1,
          attemptId: 7,
          scorePercent: 0,
          passed: false,
          submittedAt: '2026-10-31T15:58:57.380107Z',
        },
        bestScorePercent: 100,
        averageScorePercent: 42.26,
        passedQuizCount: 1,
        quizCount: 5,
      };
      const parse = (assessment: unknown) =>
        LearningProgressOverviewSchema.safeParse({ ...overview, assessment });

      it('parses an available overview', () => {
        const parsed = parse(available);
        expect(parsed.success).toBe(true);
        expect(parsed.data?.assessment).toEqual(available);
      });

      it('parses an available overview before any graded attempt', () => {
        const none = {
          availability: 'available',
          last: null,
          bestScorePercent: null,
          averageScorePercent: null,
          passedQuizCount: 0,
          quizCount: 2,
        };
        expect(AssessmentOverviewSchema.safeParse(none).success).toBe(true);
        expect(parse(none).success).toBe(true);
      });

      it('parses an unavailable assessment as it is', () => {
        expect(parse({ availability: 'unavailable' }).data?.assessment).toEqual(
          { availability: 'unavailable' },
        );
      });

      it('refuses an available assessment without its figures', () => {
        expect(parse({ availability: 'available' }).success).toBe(false);
        const { quizCount: _count, ...withoutCount } = available;
        expect(parse(withoutCount).success).toBe(false);
        expect(parse({ ...available, last: { quizId: 1 } }).success).toBe(
          false,
        );
      });

      it('reads the figures of the summary captured for hocvien', () => {
        const parsed = LearningProgressOverviewSchema.parse(
          captured.progressSummary,
        );
        expect(AssessmentOverviewSchema.parse(parsed.assessment)).toMatchObject(
          {
            bestScorePercent: 100,
            averageScorePercent: 42.26,
            passedQuizCount: 1,
            quizCount: 5,
            last: { quizId: 1, scorePercent: 0, passed: false },
          },
        );
      });
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
      myCourses: captured.courses,
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

    it('carries the best final exam score on the card, null without one', () => {
      const cards = learnerEndpoints.myCourses.response.parse(
        captured.courses,
      ).items;
      const score = (id: number) =>
        cards.find((card) => card.courseId === id)?.bestScorePercent;
      expect(score(1)).toBe(12.5);
      expect(score(8)).toBe(100);
      expect(score(2)).toBeNull();
      expect(
        cards.filter((card) => card.bestScorePercent !== null),
      ).toHaveLength(2);
    });

    it('parses a card that carries no score field, as the instructor list sends', () => {
      const [card] = learnerEndpoints.catalog.response.parse(
        captured.catalog,
      ).items;
      const { bestScorePercent: _score, ...without } = card;
      expect(CourseCardSchema.safeParse(without).success).toBe(true);
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

  describe('level', () => {
    it('parses the response captured from the backend', () => {
      const level = MyLevelSchema.parse(captured.level);
      expect(level).toEqual({
        level: 2,
        name: 'Giao dịch viên',
        xp: 200,
        xpToNext: 400,
        progressPercent: 0,
      });
    });

    it('accepts the top level with no next level and refuses a progress above 100', () => {
      expect(
        MyLevelSchema.safeParse({
          level: 6,
          name: 'Chuyên gia Core Banking',
          xp: 7000,
          xpToNext: null,
          progressPercent: null,
        }).success,
      ).toBe(true);
      expect(
        MyLevelSchema.safeParse({ ...captured.level, progressPercent: 101 })
          .success,
      ).toBe(false);
    });
  });

  describe('streak', () => {
    it('parses the response captured from the backend', () => {
      expect(
        learnerEndpoints.myStreak.response.safeParse(captured.streak).success,
      ).toBe(true);
    });

    it('keeps a rest day with activity and refuses a negative count or a bad date', () => {
      const streak = MyStreakSchema.parse(captured.streak);
      expect(streak.days.at(-1)).toEqual({
        date: '2026-11-07',
        lessons: 1,
        quizzes: 0,
        restDay: true,
      });
      const day = captured.streak.days[0];
      expect(
        MyStreakSchema.safeParse({
          ...captured.streak,
          days: [{ ...day, lessons: -1 }],
        }).success,
      ).toBe(false);
      expect(
        MyStreakSchema.safeParse({
          ...captured.streak,
          days: [{ ...day, date: '12/10' }],
        }).success,
      ).toBe(false);
    });
  });

  describe('points and leaderboard', () => {
    const responses = {
      myPoints: captured.points,
      leaderboard: captured.leaderboard,
    } as const;

    it.each(Object.entries(responses))(
      'parses the response captured from the backend for %s',
      (key, data) => {
        const endpoint = learnerEndpoints[key as keyof typeof responses];
        expect(endpoint.response.safeParse(data).success).toBe(true);
      },
    );

    it('parses the team scope and a caller outside the top ten', () => {
      expect(
        LeaderboardViewSchema.parse(captured.leaderboardTeam).top,
      ).toHaveLength(1);
      const outside = LeaderboardViewSchema.parse(
        captured.leaderboardOutsideTop,
      );
      expect(outside.top).toHaveLength(10);
      expect(outside.top.some((row) => row.me)).toBe(false);
      expect(outside.me).toMatchObject({ me: true, rank: 13 });
      expect(outside.above.map((row) => row.rank)).toEqual([11, 12]);
      expect(outside.gapToAbove).toBe(70);
    });

    it('keeps the ties and the caller as the server sent them', () => {
      const board = LeaderboardViewSchema.parse(captured.leaderboard);
      expect(board.top.map((row) => row.rank)).toEqual([1, 2, 3]);
      expect(board.top.filter((row) => row.me)).toEqual([board.me]);
      expect(board.above).toEqual([]);
      expect(board.gapToAbove).toBeNull();
    });

    it('has no paging and no count of learners', () => {
      const board = LeaderboardViewSchema.parse(captured.leaderboard);
      expect(Object.keys(board).sort()).toEqual([
        'above',
        'from',
        'gapToAbove',
        'me',
        'offset',
        'period',
        'to',
        'top',
      ]);
    });

    it('splits the total into its four parts', () => {
      const points = MyPointsSchema.parse(captured.points);
      const {
        lessons,
        quizzes,
        firstTryBonus,
        courses,
        community,
        adjustments,
      } = points.parts;
      expect(points.total).toBe(
        lessons + quizzes + firstTryBonus + courses + community + adjustments,
      );
      expect(points.streakDays).toBe(2);
    });

    it('accepts a caller with no rank, a row with no team and an all-time period', () => {
      const board = captured.leaderboardTeam;
      const [row] = board.top;
      expect(
        LeaderboardViewSchema.safeParse({
          ...board,
          period: 'all',
          from: null,
          to: null,
          top: [{ ...row, teamName: null }],
          me: { ...board.me, rank: null, teamName: null },
        }).success,
      ).toBe(true);
    });

    it('refuses a row without a rank, an unknown period and a part left out', () => {
      const board = captured.leaderboard;
      const { rank: _rank, ...unranked } = board.top[0];
      expect(
        LeaderboardViewSchema.safeParse({ ...board, top: [unranked] }).success,
      ).toBe(false);
      expect(
        LeaderboardViewSchema.safeParse({ ...board, period: 'year' }).success,
      ).toBe(false);
      expect(
        MyPointsSchema.safeParse({ ...captured.points, total: -1 }).success,
      ).toBe(false);
      const { courses: _courses, ...parts } = captured.points.parts;
      expect(
        MyPointsSchema.safeParse({ ...captured.points, parts }).success,
      ).toBe(false);
    });

    it('accepts the scopes and periods and refuses others or an offset out of range', () => {
      for (const scope of ['team', 'org', 'all']) {
        expect(LeaderboardQuerySchema.safeParse({ scope }).success).toBe(true);
      }
      for (const period of ['week', 'month', 'all']) {
        expect(LeaderboardQuerySchema.safeParse({ period }).success).toBe(true);
      }
      expect(LeaderboardQuerySchema.safeParse({ scope: 'x' }).success).toBe(
        false,
      );
      expect(LeaderboardQuerySchema.safeParse({ period: 'year' }).success).toBe(
        false,
      );
      expect(LeaderboardQuerySchema.safeParse({ offset: -1 }).success).toBe(
        false,
      );
      expect(LeaderboardQuerySchema.safeParse({ offset: 521 }).success).toBe(
        false,
      );
    });
  });

  describe('dashboard', () => {
    it('parses the dashboard and the programmes captured from the backend', () => {
      expect(
        learnerEndpoints.dashboard.response.safeParse(captured.dashboard)
          .success,
      ).toBe(true);
      expect(
        learnerEndpoints.dashboardPrograms.response.safeParse(
          captured.dashboardPrograms,
        ).success,
      ).toBe(true);
    });

    it('keeps the percents as the server sent them, decimals included', () => {
      const { learning } = LearningDashboardSchema.parse(captured.dashboard);
      expect(learning.counts).toMatchObject({
        completed: 2,
        enrollments: 7,
        averageProgress: 44.43,
        completionRate: 28.57,
      });
      expect(learning.deadlines.map((row) => row.progressPercent)).toContain(
        60.996,
      );
      const { items } = learnerEndpoints.dashboardPrograms.response.parse(
        captured.dashboardPrograms,
      );
      expect(items[0]).toMatchObject({
        id: '1',
        courses: 3,
        completed: 1,
        averageProgress: 50,
        completionRate: 33.33,
      });
    });

    it('reads a page that is not the first and an empty one', () => {
      const second = learnerEndpoints.dashboardPrograms.response.parse(
        captured.dashboardProgramsPage2,
      );
      expect(second).toMatchObject({ page: 1, size: 2, totalPages: 2 });
      expect(
        learnerEndpoints.dashboardPrograms.response.parse({
          items: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        }).items,
      ).toEqual([]);
    });

    it('accepts a dashboard with nothing to resume and no deadlines', () => {
      const { learning, ...rest } = captured.dashboard;
      const empty = LearningDashboardSchema.parse({
        ...rest,
        learning: { ...learning, nextAction: null, deadlines: [] },
      });
      expect(empty.learning.nextAction).toBeNull();
    });

    it('refuses a dashboard without its counts and a page size over 100', () => {
      const { counts: _counts, ...learning } = captured.dashboard.learning;
      expect(
        LearningDashboardSchema.safeParse({
          ...captured.dashboard,
          learning,
        }).success,
      ).toBe(false);
      const { query } = learnerEndpoints.dashboardPrograms;
      expect(query?.safeParse({ page: 0, size: 100 }).success).toBe(true);
      expect(query?.safeParse({ size: 101 }).success).toBe(false);
    });
  });
});

describe('the learner course captured with video chapters and transcript', () => {
  it('gives the demo video its lists on the read the lesson page uses', () => {
    const course = LearnerCourseSchema.parse(
      capturedLessonPlayer.learnerCourse,
    );
    const video = course.content.chapters
      .flatMap((chapter) => chapter.lessons)
      .flatMap((lesson) => lesson.blocks)
      .find((entry) => entry.block.id === 33)!.block;
    expect(video.videoChapters.map((c) => c.title)).toEqual([
      'Giới thiệu',
      'Khái niệm chính',
      'Tổng kết',
    ]);
    expect(video.transcript).toHaveLength(6);
  });
});

describe('the enrolment detail captured with video chapters and transcript', () => {
  const detail = EnrollmentDetailSchema.parse(
    capturedLessonPlayer.enrollmentDetail,
  );
  const blocks = detail.content.chapters
    .flatMap((chapter) => chapter.lessons)
    .flatMap((lesson) => lesson.blocks)
    .map((entry) => entry.block);

  it('gives the demo video its chapters and transcript', () => {
    const video = blocks.find((block) => block.id === 33);
    expect(video?.videoChapters).toEqual([
      { startSeconds: 0, title: 'Giới thiệu' },
      { startSeconds: 10, title: 'Khái niệm chính' },
      { startSeconds: 20, title: 'Tổng kết' },
    ]);
    expect(video?.transcript).toHaveLength(6);
    expect(video?.transcript[1].startSeconds).toBeGreaterThan(0);
  });

  it('gives a block that is not a video two empty lists', () => {
    const pdf = blocks.find((block) => block.id === 32);
    expect(pdf?.videoChapters).toEqual([]);
    expect(pdf?.transcript).toEqual([]);
  });
});
