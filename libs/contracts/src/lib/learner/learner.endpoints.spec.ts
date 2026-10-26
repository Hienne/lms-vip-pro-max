import { toUrl } from '../http/endpoint';
import { learnerEndpoints } from './learner.endpoints';
import {
  EnrollmentDetailSchema,
  SaveProgressCommandSchema,
} from './learner.schema';

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
      ['enroll', 'post', '/api/v1/courses/{courseId}/enrollments'],
      ['enrollment', 'get', '/api/v1/me/learning/enrollments/{enrollmentId}'],
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
    expect(
      SaveProgressCommandSchema.parse({
        expectedVersion: 0,
        sequence: 7,
        watchedFromSeconds: 30,
        watchedToSeconds: 45,
      }).sequence,
    ).toBe(7);
    expect(
      SaveProgressCommandSchema.safeParse({ expectedVersion: 0, pdfPage: 0 })
        .success,
    ).toBe(false);
  });
});
