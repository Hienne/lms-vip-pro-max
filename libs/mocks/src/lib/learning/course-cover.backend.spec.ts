import {
  assetEndpoints,
  authV1Endpoints,
  CourseCardSchema,
  courseEndpoints,
  CourseDetailSchema,
  learnerEndpoints,
  UploadSchema,
  type AnyEndpoint,
  type CreateCourseCommand,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

/** SPEC-learning-ui: the learner's card names its cover, and the cover is readable as uploaded. */
describe('course covers on the mock backend', () => {
  let backend: FakeBackend;
  let author: string;
  let learner: string;
  beforeEach(() => {
    backend = new FakeBackend();
    author = login('giangvien');
    learner = login('hocvien');
  });

  const call = (
    endpoint: AnyEndpoint,
    token: string | null,
    request: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token,
      params: request.params ?? {},
      query: request.query ?? {},
      body: request.body,
      headers: request.headers,
    }) as FakeReply;

  function login(username: string): string {
    return (
      call(authV1Endpoints.login, null, {
        body: { username, password: SEED_PASSWORD },
      }).body.data as { accessToken: string }
    ).accessToken;
  }

  const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

  /** Uploads a small PNG as the author and polls it to `ready`. */
  function uploadCover(): number {
    const started = UploadSchema.parse(
      call(assetEndpoints.startUpload, author, {
        body: {
          requestId: '00000000-0000-4000-8000-00000000c0de',
          ownerOrgId: 1,
          originalName: 'bia.png',
          mimeType: 'image/png',
          sizeBytes: bytes.length,
          checksumSha256: 'a'.repeat(64),
        },
      }).body.data,
    );
    const params = { uploadId: started.uploadId };
    call(assetEndpoints.uploadPart, author, {
      params: { ...params, partNumber: '1' },
      body: new Blob([bytes], { type: 'image/png' }),
      headers: { 'X-Part-SHA256': 'b'.repeat(64) },
    });
    call(assetEndpoints.completeUpload, author, { params });
    call(assetEndpoints.uploadStatus, author, { params });
    call(assetEndpoints.uploadStatus, author, { params });
    return started.assetId as number;
  }

  function courseWithCover(coverAssetId: number) {
    const draft: NonNullable<CreateCourseCommand['draft']> = {
      title: 'Khóa có ảnh bìa',
      level: 'basic',
      defaultRequirement: 'optional',
      coverAssetId,
      objectives: [],
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
      ],
    };
    return CourseDetailSchema.parse(
      call(courseEndpoints.createCourse, author, {
        body: { ownerOrgId: 1, code: 'COVER-MOCK', draft },
      }).body.data,
    );
  }

  const publish = (detail: ReturnType<typeof courseWithCover>) =>
    call(courseEndpoints.publish, author, {
      params: {
        courseId: String(detail.course.id),
        revisionId: String(detail.revision.id),
      },
      body: { expectedVersion: detail.revision.rowVersion },
    });

  const content = (assetId: number, token: string) =>
    call(courseEndpoints.getAssetContent, token, {
      params: { assetId: String(assetId) },
    });

  const fileOf = async (reply: FakeReply) =>
    new Uint8Array(await (reply.file as Blob).arrayBuffer());

  it('serves an uploaded image back with its bytes, not the grey placeholder', async () => {
    const assetId = uploadCover();
    const reply = content(assetId, author);
    expect(reply.status).toBe(200);
    expect(await fileOf(reply)).toEqual(bytes);
  });

  it('refuses a learner the cover of a course nobody can see yet, and lets its uploader read it', () => {
    const assetId = uploadCover();
    courseWithCover(assetId);
    const refused = content(assetId, learner);
    expect(refused.status).toBe(403);
    expect(refused.body.messageCode).toBe('CORE-ACCESS_DENIED');
    expect(content(assetId, author).status).toBe(200);
  });

  it('lets a learner read the cover once the course is published, and names it on the card', async () => {
    const assetId = uploadCover();
    const detail = courseWithCover(assetId);
    expect(publish(detail).body.status).toBe('SUCCESS');

    expect(await fileOf(content(assetId, learner))).toEqual(bytes);
    const card = (
      call(learnerEndpoints.catalog, learner, { query: { size: '100' } }).body
        .data as { items: unknown[] }
    ).items
      .map((item) => CourseCardSchema.parse(item))
      .find((c) => c.courseId === detail.course.id);
    expect(card?.coverAssetId).toBe(assetId);
  });

  it('names no cover on the card of a course without one', () => {
    const cards = (
      call(learnerEndpoints.catalog, learner, { query: { size: '100' } }).body
        .data as { items: unknown[] }
    ).items.map((item) => CourseCardSchema.parse(item));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.coverAssetId === null)).toBe(true);
  });
});
