import {
  CourseContentSchema,
  courseContentEndpoints,
  courseJobEndpoints,
  CourseJobInputsSchema,
  type CourseContent,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { CourseJobMock } from './course-job.mock';

const inputs = CourseJobInputsSchema.parse({
  targetLearners: 'Giao dịch viên mới',
  level: 'BEGINNER',
  chapters: 3,
  programmeId: 5,
  competencyId: 9,
});

const request = (
  params: Record<string, string> = {},
  body: unknown = null,
): FakeRequest => ({ body, params, query: {} }) as unknown as FakeRequest;

const data = (reply: FakeReply | undefined) =>
  (reply?.body as { data: unknown; errors?: { code: string }[] }).data;
const errorCode = (reply: FakeReply | undefined) => JSON.stringify(reply?.body);

describe('CourseJobMock review flow', () => {
  let mock: CourseJobMock;
  let jobId: string;

  const call = (
    endpoint: Parameters<CourseJobMock['handle']>[0],
    extra: Record<string, string> = {},
    body: unknown = null,
  ) => mock.handle(endpoint, request({ jobId, ...extra }, body), 'a');
  const content = (): CourseContent =>
    CourseContentSchema.parse(data(call(courseContentEndpoints.content)));
  /** Looks at the job until `done` holds, as the screen's polling does. */
  const until = (done: (c: CourseContent) => boolean): CourseContent => {
    for (let i = 0; i < 12; i += 1) {
      const current = content();
      if (done(current)) return current;
    }
    throw new Error('did not settle');
  };

  beforeEach(() => {
    mock = new CourseJobMock();
    jobId = String(mock.queue('a', inputs, 'quy-trinh.md').jobId);
  });

  it('proposes an outline that waits for the author and can be edited until approved', () => {
    const waiting = until((c) => c.status === 'waiting_approval');
    expect(waiting.outline?.chapters).toHaveLength(2);
    expect(waiting.outlineLocked).toBe(false);

    const edited = { ...waiting.outline!, title: 'Tiêu đề mới' };
    const saved = CourseContentSchema.parse(
      data(call(courseContentEndpoints.updateOutline, {}, edited)),
    );
    expect(saved.outline?.title).toBe('Tiêu đề mới');

    call(courseContentEndpoints.approveOutline);
    expect(
      errorCode(call(courseContentEndpoints.updateOutline, {}, edited)),
    ).toContain('OUTLINE_LOCKED');
  });

  it('writes the lessons after approval and writes the failed ones again on retry', () => {
    until((c) => c.status === 'waiting_approval');
    call(courseContentEndpoints.approveOutline);

    const failed = until((c) => c.status === 'failed');
    expect(failed.lessons.filter((l) => l.status === 'failed')).toHaveLength(1);
    expect(
      failed.lessons.find((l) => l.status === 'failed')?.error,
    ).toBeTruthy();

    call(courseContentEndpoints.retry);
    const ready = until((c) => c.status === 'waiting_approval');
    expect(ready.lessons.every((l) => l.status === 'done')).toBe(true);
  });

  it('keeps a question decision and rewrites only the lesson asked for', () => {
    until((c) => c.status === 'waiting_approval');
    call(courseContentEndpoints.approveOutline);
    call(courseContentEndpoints.retry);
    until((c) => c.status === 'failed');
    call(courseContentEndpoints.retry);
    until((c) => c.status === 'waiting_approval');

    const decided = CourseContentSchema.parse(
      data(
        call(
          courseContentEndpoints.decideQuestion,
          { key: 'c1l1', index: '0' },
          { decision: 'accepted' },
        ),
      ),
    );
    expect(decided.questions[0].questions?.[0].decision).toBe('added');

    const again = CourseContentSchema.parse(
      data(call(courseContentEndpoints.regenerateLesson, { key: 'c1l2' })),
    );
    expect(again.lessons.find((l) => l.key === 'c1l2')?.status).toBe('pending');
    expect(again.lessons.find((l) => l.key === 'c1l1')?.status).toBe('done');
    expect(again.questions[0].questions?.[0].decision).toBe('added');
  });

  it('refuses a stranger and an unknown job', () => {
    expect(
      errorCode(
        mock.handle(
          courseContentEndpoints.content,
          request({ jobId }),
          'someone-else',
        ),
      ),
    ).toContain('CORE-RESOURCE_NOT_FOUND');
    expect(courseJobEndpoints.get).toBeDefined();
  });
});
