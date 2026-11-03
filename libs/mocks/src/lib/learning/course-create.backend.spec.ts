import {
  assessmentV1Endpoints,
  authV1Endpoints,
  courseEndpoints,
  CourseDetailSchema,
  type AnyEndpoint,
  type CreateCourseCommand,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

describe('creating a course on the mock backend', () => {
  let backend: FakeBackend;
  let token: string;
  beforeEach(() => {
    backend = new FakeBackend();
    token = (
      call(authV1Endpoints.login, {
        body: { username: 'giangvien', password: SEED_PASSWORD },
      }).body.data as { accessToken: string }
    ).accessToken;
  });

  const call = (
    endpoint: AnyEndpoint,
    request: {
      params?: Record<string, string>;
      body?: unknown;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token: endpoint === authV1Endpoints.login ? null : token,
      params: request.params ?? {},
      query: {},
      body: request.body,
    }) as FakeReply;

  const create = (command: CreateCourseCommand) =>
    call(courseEndpoints.createCourse, { body: command });

  const draft: NonNullable<CreateCourseCommand['draft']> = {
    title: 'Khóa có nháp',
    summary: 'Tóm tắt',
    level: 'basic',
    defaultRequirement: 'optional',
    objectives: ['Mục tiêu 1', 'Mục tiêu 2'],
    rewardPoints: 25,
    chapters: [
      {
        title: 'Chương 1',
        lessons: [
          {
            title: 'Bài 1',
            lessonType: 'content',
            estimatedDurationSeconds: 600,
            isRequired: true,
            blocks: [],
          },
        ],
      },
      { title: 'Chương 2', lessons: [] },
    ],
  };

  it('creates an empty draft when no draft is sent', () => {
    const detail = CourseDetailSchema.parse(
      create({ ownerOrgId: 1, code: 'WIZ-MOCK-0', title: 'Trống' }).body.data,
    );
    expect(detail.revision.title).toBe('Trống');
    expect(detail.chapters).toEqual([]);
    expect(detail.revision.rowVersion).toBe(0);
  });

  it('stores the whole tree of a draft as a save does', () => {
    const created = CourseDetailSchema.parse(
      create({ ownerOrgId: 1, code: 'WIZ-MOCK-1', draft }).body.data,
    );
    expect(created.revision.title).toBe('Khóa có nháp');
    expect(created.revision.level).toBe('basic');
    expect(created.revision.defaultRequirement).toBe('optional');
    expect(created.revision.rowVersion).toBe(1);
    expect(created.objectives.map((o) => o.description)).toEqual([
      'Mục tiêu 1',
      'Mục tiêu 2',
    ]);
    expect(created.completionRule?.rewardPoints).toBe(25);
    expect(created.chapters.map((c) => c.chapter.title)).toEqual([
      'Chương 1',
      'Chương 2',
    ]);
    expect(created.chapters[0].lessons[0].lesson.title).toBe('Bài 1');

    const read = CourseDetailSchema.parse(
      call(courseEndpoints.getCourse, {
        params: { courseId: String(created.course.id) },
      }).body.data,
    );
    expect(read.chapters).toHaveLength(2);
  });

  it('lets the draft title win over the command title, and falls back to it', () => {
    const wins = CourseDetailSchema.parse(
      create({ ownerOrgId: 1, code: 'WIZ-MOCK-2', title: 'Ngoài', draft }).body
        .data,
    );
    expect(wins.revision.title).toBe('Khóa có nháp');
    const { title: _title, ...untitled } = draft;
    const falls = CourseDetailSchema.parse(
      create({
        ownerOrgId: 1,
        code: 'WIZ-MOCK-3',
        title: 'Ngoài',
        draft: untitled,
      }).body.data,
    );
    expect(falls.revision.title).toBe('Ngoài');
  });

  it('refuses a code already in use with LEARNING-DUPLICATE', () => {
    create({ ownerOrgId: 1, code: 'WIZ-MOCK-4' });
    const again = create({ ownerOrgId: 1, code: 'wiz-mock-4', draft });
    expect(again.body.messageCode).toBe('LEARNING-DUPLICATE');
  });
  describe('the final exam', () => {
    const versionOf = (quizId: number) =>
      (
        call(assessmentV1Endpoints.quiz, {
          params: { id: String(quizId) },
        }).body.data as { quiz: { rowVersion: number } }
      ).quiz.rowVersion;

    const publishOf = (courseId: number, revisionId: number, version: number) =>
      call(courseEndpoints.publish, {
        params: {
          courseId: String(courseId),
          revisionId: String(revisionId),
        },
        body: { expectedVersion: version },
      });

    const created = (code: string, finalQuizId?: number) =>
      CourseDetailSchema.parse(
        create({
          ownerOrgId: 1,
          code,
          draft: { ...draft, ...(finalQuizId ? { finalQuizId } : {}) },
        }).body.data,
      );

    it('stores the final quiz on create and returns null without one', () => {
      expect(created('WIZ-FE-0').finalQuizId).toBeNull();
      expect(created('WIZ-FE-1', 2).finalQuizId).toBe(2);
    });

    it('replaces the final quiz on a save, and an omitted one clears it', () => {
      const first = created('WIZ-FE-2', 2);
      const save = (version: number, finalQuizId?: number) =>
        CourseDetailSchema.parse(
          call(courseEndpoints.saveDraft, {
            params: {
              courseId: String(first.course.id),
              revisionId: String(first.revision.id),
            },
            body: {
              ...draft,
              expectedVersion: version,
              ...(finalQuizId ? { finalQuizId } : {}),
            },
          }).body.data,
        );
      const changed = save(first.revision.rowVersion, 3);
      expect(changed.finalQuizId).toBe(3);
      expect(save(changed.revision.rowVersion).finalQuizId).toBeNull();
    });

    it('publishes with a published final quiz and keeps it in the detail', () => {
      const draftDetail = created('WIZ-FE-3', 2);
      const reply = publishOf(
        draftDetail.course.id,
        draftDetail.revision.id,
        draftDetail.revision.rowVersion,
      );
      expect(reply.body.messageCode).not.toBe(
        'LEARNING-FINAL_EXAM_UNPUBLISHED',
      );
      expect(CourseDetailSchema.parse(reply.body.data).finalQuizId).toBe(2);
    });

    it('refuses to publish while the final quiz is closed or missing', () => {
      const missing = created('WIZ-FE-4', 9999);
      expect(
        publishOf(
          missing.course.id,
          missing.revision.id,
          missing.revision.rowVersion,
        ).body.messageCode,
      ).toBe('LEARNING-FINAL_EXAM_UNPUBLISHED');

      call(assessmentV1Endpoints.closeQuiz, {
        params: { id: '3' },
        body: { expectedVersion: versionOf(3) },
      });
      const closed = created('WIZ-FE-5', 3);
      expect(
        publishOf(
          closed.course.id,
          closed.revision.id,
          closed.revision.rowVersion,
        ).body.messageCode,
      ).toBe('LEARNING-FINAL_EXAM_UNPUBLISHED');
    });

    it('carries the final quiz into the next draft of a published course', () => {
      const first = created('WIZ-FE-6', 2);
      publishOf(first.course.id, first.revision.id, first.revision.rowVersion);
      const next = CourseDetailSchema.parse(
        call(courseEndpoints.openDraft, {
          params: { courseId: String(first.course.id) },
        }).body.data,
      );
      expect(next.revision.state).toBe('draft');
      expect(next.finalQuizId).toBe(2);
    });
  });
});
