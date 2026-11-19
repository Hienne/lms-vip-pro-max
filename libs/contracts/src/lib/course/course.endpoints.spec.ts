import { toUrl } from '../http/endpoint';
import { courseEndpoints } from './course.endpoints';
import {
  capturedCourseCreate,
  capturedCourseFinalExam,
  capturedPublishTargets,
} from './course.captured';
import {
  PublishCourseCommandSchema,
  publishRowOf,
} from './course-publish.schema';
import { EnvelopeSchema } from '../http/envelope';
import {
  CourseCardSchema,
  CreateCourseCommandSchema,
  CourseDetailSchema,
  CourseLessonSchema,
  CourseShareSchema,
  LessonBlockSchema,
  LessonInputSchema,
  SaveDraftCommandSchema,
  ShareCourseCommandSchema,
} from './course.schema';

const stamp = { rowVersion: 0, createTime: '2026-10-20T08:00:00' };

const courseDetail = {
  course: {
    id: 7,
    code: 'CB-101',
    ownerOrgId: 1,
    ownerTeamId: null,
    ownerUserId: '00123',
    publishedRevisionId: null,
    lifecycleStatus: 'active',
    copiedFromCourseId: null,
    ...stamp,
  },
  revision: {
    id: 70,
    courseId: 7,
    revisionNo: 1,
    state: 'draft',
    title: 'Nhập môn Core Banking',
    level: 'basic',
    defaultRequirement: 'mandatory',
    coverColor: '#1F6FEB',
    ...stamp,
  },
  objectives: [
    {
      id: 1,
      revisionId: 70,
      description: 'Hiểu luồng giao dịch',
      sortNo: 0,
      ...stamp,
    },
  ],
  chapters: [
    {
      chapter: {
        id: 11,
        revisionId: 70,
        title: 'Chương 1',
        sortNo: 0,
        ...stamp,
      },
      lessons: [
        {
          lesson: {
            id: 21,
            chapterId: 11,
            title: 'Bài 1',
            lessonType: 'content',
            estimatedDurationSeconds: 600,
            isRequired: true,
            sortNo: 0,
            ...stamp,
          },
          blocks: [
            {
              block: {
                id: 31,
                lessonId: 21,
                blockType: 'video',
                title: 'Video giới thiệu',
                completionMode: 'video_coverage',
                completionThreshold: 90,
                sortNo: 0,
                ...stamp,
              },
              assets: [
                {
                  usage: {
                    id: 41,
                    blockId: 31,
                    assetId: 51,
                    usage: 'primary',
                    ...stamp,
                  },
                  asset: {
                    id: 51,
                    ownerOrgId: 1,
                    originalName: 'intro.mp4',
                    mimeType: 'video/mp4',
                    sizeBytes: 1024,
                    durationSeconds: 120,
                    status: 'ready',
                    ...stamp,
                  },
                },
              ],
              steps: [],
            },
          ],
        },
      ],
    },
  ],
  completionRule: null,
};

describe('course endpoints', () => {
  it('declare the backend paths and methods', () => {
    expect(
      Object.entries(courseEndpoints).map(([key, e]) => [
        key,
        e.method,
        e.path,
      ]),
    ).toEqual([
      ['instructorCourses', 'get', '/api/v1/instructor/courses'],
      ['createCourse', 'post', '/api/v1/courses'],
      ['getCourse', 'get', '/api/v1/courses/{courseId}'],
      ['openDraft', 'post', '/api/v1/courses/{courseId}/draft'],
      ['saveDraft', 'put', '/api/v1/courses/{courseId}/revisions/{revisionId}'],
      [
        'publish',
        'post',
        '/api/v1/courses/{courseId}/revisions/{revisionId}/publish',
      ],
      ['changeState', 'patch', '/api/v1/courses/{courseId}/state'],
      ['copyCourse', 'post', '/api/v1/courses/{courseId}/copy'],
      ['shares', 'get', '/api/v1/courses/{courseId}/shares'],
      ['share', 'put', '/api/v1/courses/{courseId}/shares'],
      ['getAssetContent', 'get', '/api/v1/learning-assets/{assetId}/content'],
    ]);
    expect(
      toUrl(courseEndpoints.saveDraft, { courseId: 7, revisionId: 70 }),
    ).toBe('/api/v1/courses/7/revisions/70');
  });

  it('downloads a file as a blob', () => {
    expect(courseEndpoints.getAssetContent.responseType).toBe('blob');
  });

  it('parses a content tree as the backend sends it', () => {
    const detail = CourseDetailSchema.parse(courseDetail);
    expect(detail.chapters[0].lessons[0].blocks[0].assets[0].asset.id).toBe(51);
    expect(detail.revision.rowVersion).toBe(0);
  });

  it('parses a learner card with the server results', () => {
    const card = CourseCardSchema.parse({
      courseId: 7,
      revisionId: 71,
      code: 'CB-101',
      title: 'Nhập môn Core Banking',
      level: 'basic',
      requirement: 'mandatory',
      learningStatus: 'in_progress',
      progressPercent: 40,
      dueAt: '2026-11-01T17:00:00',
      assigned: true,
      overdue: false,
    });
    expect(card.progressPercent).toBe(40);
  });

  it('parses the learner card fields of the backend, as the local backend sends them', () => {
    const card = CourseCardSchema.parse({
      courseId: 1,
      revisionId: 1,
      code: 'FE-DEMO-C1',
      title: 'Tổng quan hệ thống Core Banking',
      level: 'basic',
      requirement: 'mandatory',
      lessonCount: 4,
      enrollmentId: 3,
      learningStatus: 'in_progress',
      progressPercent: 50,
      dueAt: '2026-10-28T16:18:06.151850Z',
      assigned: true,
      overdue: false,
      cycleNo: 1,
      startedAt: '2026-10-20T16:18:06.151850Z',
      lastAccessAt: '2026-10-22T16:18:06.151850Z',
      completedAt: null,
      lastLessonId: 2,
      lastBlockId: 4,
      completedRequiredLessonCount: 2,
      requiredLessonCount: 4,
      deadlineStatus: 'on_time_active',
      mediaAssetId: null,
      lastPdfPage: null,
      lastVideoPositionSeconds: null,
    });
    expect(card.requiredLessonCount).toBe(4);
    expect(card.deadlineStatus).toBe('on_time_active');
    expect(
      CourseCardSchema.safeParse({
        courseId: 1,
        code: 'X',
        deadlineStatus: 'someday',
      }).success,
    ).toBe(false);
  });

  it('checks a draft body against the backend rules', () => {
    const draft = {
      expectedVersion: 0,
      defaultRequirement: 'optional',
      objectives: ['Hiểu luồng giao dịch'],
      chapters: [
        {
          title: 'Chương 1',
          lessons: [
            {
              title: 'Bài 1',
              lessonType: 'content',
              estimatedDurationSeconds: 600,
              blocks: [
                {
                  blockType: 'text',
                  title: 'Giới thiệu',
                  body: '# Xin chào',
                  bodyFormat: 'markdown',
                  completionMode: 'open',
                  assets: [],
                  steps: [],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(SaveDraftCommandSchema.parse(draft)).toEqual(draft);
    expect(
      SaveDraftCommandSchema.safeParse({ ...draft, coverColor: 'blue' })
        .success,
    ).toBe(false);
    expect(
      SaveDraftCommandSchema.safeParse({ ...draft, level: 'expert' }).success,
    ).toBe(false);
  });

  describe('shares', () => {
    const row = {
      id: 5,
      courseId: 7,
      orgId: 2,
      includeDescendants: false,
      canAssign: true,
      canSelfEnroll: false,
      status: 'active',
      rowVersion: 0,
    };

    it('knows the two states a share has', () => {
      expect(CourseShareSchema.parse(row).status).toBe('active');
      expect(
        CourseShareSchema.parse({ ...row, status: 'revoked' }).status,
      ).toBe('revoked');
      expect(
        CourseShareSchema.safeParse({ ...row, status: 'pending' }).success,
      ).toBe(false);
    });

    it('is sent whole: the backend has no defaults for the rights', () => {
      const command = {
        orgId: 2,
        includeDescendants: true,
        canAssign: true,
        canSelfEnroll: false,
        active: true,
      };
      expect(ShareCourseCommandSchema.parse(command)).toEqual(command);
      expect(
        ShareCourseCommandSchema.safeParse({ orgId: 2, active: false }).success,
      ).toBe(false);
    });
  });
});

describe('quiz lessons', () => {
  const lesson = {
    id: 22,
    chapterId: 11,
    title: 'Bài kiểm tra cuối khóa',
    lessonType: 'quiz',
    sortNo: 1,
    ...stamp,
  };

  it('reads the quiz a lesson opens, and null for a content lesson', () => {
    expect(CourseLessonSchema.parse({ ...lesson, quizId: 5 }).quizId).toBe(5);
    expect(
      CourseLessonSchema.parse({
        ...lesson,
        lessonType: 'content',
        quizId: null,
      }).quizId,
    ).toBeNull();
  });

  it('sends the quiz of a quiz lesson in the draft, and refuses a quiz id that is not a number', () => {
    const input = {
      title: 'Bài kiểm tra',
      lessonType: 'quiz',
      estimatedDurationSeconds: 600,
      blocks: [],
    };
    expect(LessonInputSchema.safeParse({ ...input, quizId: 5 }).success).toBe(
      true,
    );
    expect(
      LessonInputSchema.safeParse({ ...input, quizId: null }).success,
    ).toBe(true);
    expect(LessonInputSchema.safeParse({ ...input, quizId: 'x' }).success).toBe(
      false,
    );
  });
});

describe('video chapters and transcript', () => {
  const block = {
    id: 9,
    lessonId: 3,
    blockType: 'video',
    title: 'Video',
    completionMode: 'video_coverage',
    sortNo: 0,
    ...stamp,
  };

  it('default to empty lists when the backend sends none', () => {
    const parsed = LessonBlockSchema.parse(block);
    expect(parsed.videoChapters).toEqual([]);
    expect(parsed.transcript).toEqual([]);
  });

  it('read decimal seconds as numbers', () => {
    const parsed = LessonBlockSchema.parse({
      ...block,
      videoChapters: [{ startSeconds: 12.5, title: 'Mở đầu' }],
      transcript: [{ startSeconds: 0.25, text: 'Xin chào' }],
    });
    expect(parsed.videoChapters[0].startSeconds).toBe(12.5);
    expect(parsed.transcript[0].text).toBe('Xin chào');
  });

  it('read an untimed transcript line with a null time', () => {
    const parsed = LessonBlockSchema.parse({
      ...block,
      transcript: [
        { startSeconds: null, text: 'Xin chào' },
        { startSeconds: null, text: 'Hẹn gặp lại' },
      ],
    });
    expect(parsed.transcript.map((line) => line.startSeconds)).toEqual([
      null,
      null,
    ]);
  });

  it('save an untimed transcript but still need a time on every chapter', () => {
    const input = {
      blockType: 'video',
      title: 'Video',
      completionMode: 'video_coverage',
      assets: [],
      steps: [],
    };
    const lesson = (video: unknown) => ({
      title: 'Bài',
      lessonType: 'content',
      estimatedDurationSeconds: 60,
      blocks: [video],
    });
    expect(
      LessonInputSchema.safeParse(
        lesson({ ...input, transcript: [{ startSeconds: null, text: 'B' }] }),
      ).success,
    ).toBe(true);
    expect(
      LessonInputSchema.safeParse(
        lesson({
          ...input,
          videoChapters: [{ startSeconds: null, title: 'A' }],
        }),
      ).success,
    ).toBe(false);
  });

  it('are optional in a saved block and checked against the backend limits', () => {
    const input = {
      blockType: 'video',
      title: 'Video',
      completionMode: 'video_coverage',
      assets: [],
      steps: [],
    };
    const lesson = (blocks: unknown[]) => ({
      title: 'Bài',
      lessonType: 'content',
      estimatedDurationSeconds: 60,
      blocks,
    });
    expect(LessonInputSchema.safeParse(lesson([input])).success).toBe(true);
    expect(
      LessonInputSchema.safeParse(
        lesson([
          {
            ...input,
            videoChapters: [{ startSeconds: 0, title: 'A' }],
            transcript: [{ startSeconds: 1.5, text: 'B' }],
          },
        ]),
      ).success,
    ).toBe(true);
    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      startSeconds: i,
      title: 'A',
    }));
    expect(
      LessonInputSchema.safeParse(
        lesson([{ ...input, videoChapters: tooMany }]),
      ).success,
    ).toBe(false);
  });
});

describe('a create with a draft captured from the local backend', () => {
  it('accepts the command that was sent', () => {
    const command = CreateCourseCommandSchema.parse(
      capturedCourseCreate.command,
    );
    expect(command.draft?.chapters).toHaveLength(2);
    expect(command.draft?.rewardPoints).toBe(20);
  });

  it('still accepts a create without a draft', () => {
    const { draft: _draft, ...bare } = capturedCourseCreate.command;
    expect(CreateCourseCommandSchema.safeParse(bare).success).toBe(true);
  });

  it('parses the detail the server answered with, tree included', () => {
    const detail = CourseDetailSchema.parse(capturedCourseCreate.response);
    expect(detail.revision.rowVersion).toBe(1);
    expect(detail.chapters.map((c) => c.chapter.title)).toEqual([
      'Chương 1',
      'Chương 2',
    ]);
    expect(detail.objectives).toHaveLength(2);
    expect(detail.completionRule?.rewardPoints).toBe(20);
  });
});

describe('a course with a final exam captured from the local backend', () => {
  it('parses the detail with its final quiz', () => {
    const detail = CourseDetailSchema.parse(capturedCourseFinalExam);
    expect(detail.finalQuizId).toBe(6);
    expect(detail.revision.state).toBe('published');
  });

  it('reads a detail without the field as having no final exam', () => {
    const { finalQuizId: _finalQuizId, ...old } = capturedCourseFinalExam;
    expect(CourseDetailSchema.parse(old).finalQuizId).toBeNull();
    expect(
      CourseDetailSchema.parse({ ...old, finalQuizId: null }).finalQuizId,
    ).toBeNull();
  });

  it('accepts a save that names the final quiz, and a save that leaves it out', () => {
    const save = {
      expectedVersion: 3,
      defaultRequirement: 'optional',
      objectives: [],
      chapters: [],
    };
    expect(
      SaveDraftCommandSchema.parse({ ...save, finalQuizId: 6 }).finalQuizId,
    ).toBe(6);
    expect(SaveDraftCommandSchema.parse(save).finalQuizId).toBeUndefined();
    expect(
      SaveDraftCommandSchema.safeParse({ ...save, finalQuizId: 0 }).success,
    ).toBe(false);
  });
});

describe('a publish with assignments and shares', () => {
  it('accepts the version alone, as before', () => {
    expect(
      PublishCourseCommandSchema.safeParse({ expectedVersion: 3 }).success,
    ).toBe(true);
  });

  it('accepts the body that was sent to the local backend', () => {
    const command = PublishCourseCommandSchema.parse(
      capturedPublishTargets.command,
    );
    expect(command.assignments).toHaveLength(2);
    expect(command.assignments?.[1].dueAt).toBeUndefined();
    expect(command.shareOrgIds).toEqual([1]);
  });

  it('refuses more than 20 rows, more than 50 shares and a reminder over 365 days', () => {
    const row = capturedPublishTargets.command.assignments[0];
    const publish = (extra: object) =>
      PublishCourseCommandSchema.safeParse({ expectedVersion: 0, ...extra })
        .success;
    expect(publish({ assignments: Array(20).fill(row) })).toBe(true);
    expect(publish({ assignments: Array(21).fill(row) })).toBe(false);
    expect(publish({ shareOrgIds: Array(51).fill(1) })).toBe(false);
    expect(
      publish({ assignments: [{ ...row, reminderDaysBefore: 366 }] }),
    ).toBe(false);
  });

  it('reads each observed refusal with the row it names', () => {
    const rows = [
      capturedPublishTargets.emptyTargetRefusal,
      capturedPublishTargets.shareRefusal,
      capturedPublishTargets.dueBeforeStartRefusal,
    ].map((body) => {
      const envelope = EnvelopeSchema.parse(body);
      return publishRowOf(envelope.errors?.[0].field ?? '');
    });
    expect(rows).toEqual([
      { kind: 'assignments', index: 1 },
      { kind: 'shareOrgIds', index: 0 },
      { kind: 'assignments', index: 0 },
    ]);
  });

  it('knows no row for another field', () => {
    expect(publishRowOf('assignments[0].target')).toEqual({
      kind: 'assignments',
      index: 0,
    });
    expect(publishRowOf('expectedVersion')).toBeUndefined();
  });
});
