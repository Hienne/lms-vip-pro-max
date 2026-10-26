import { toUrl } from '../http/endpoint';
import { courseEndpoints } from './course.endpoints';
import {
  CourseCardSchema,
  CourseDetailSchema,
  SaveDraftCommandSchema,
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
      ['uploadAsset', 'post', '/api/v1/learning-assets'],
      ['getAssetContent', 'get', '/api/v1/learning-assets/{assetId}/content'],
    ]);
    expect(
      toUrl(courseEndpoints.saveDraft, { courseId: 7, revisionId: 70 }),
    ).toBe('/api/v1/courses/7/revisions/70');
  });

  it('uploads as multipart and downloads as a blob', () => {
    expect(courseEndpoints.uploadAsset.encoding).toBe('multipart');
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
});
