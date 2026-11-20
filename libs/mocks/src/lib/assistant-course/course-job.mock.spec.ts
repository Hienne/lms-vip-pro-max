import {
  courseJobEndpoints,
  CourseJobInputsSchema,
  CourseJobSchema,
} from '@lms/contracts';
import type { FakeRequest } from '../backend/fake-backend';
import { CourseJobMock } from './course-job.mock';

const inputs = CourseJobInputsSchema.parse({
  targetLearners: 'Giao dịch viên mới',
  level: 'BEGINNER',
  chapters: 3,
  durationMinutes: null,
  programmeId: 5,
  competencyId: 9,
  ownerOrgId: null,
});

const request = (
  body: unknown = null,
  params: Record<string, string> = {},
): FakeRequest => ({ body, params, query: {} }) as unknown as FakeRequest;

const form = () => {
  const data = new FormData();
  data.set('file', new File(['x'], 'quy-trinh.md'));
  data.set('inputs', JSON.stringify(inputs));
  return data;
};

describe('CourseJobMock', () => {
  it('refuses to start a job with 410 like the backend, and queues nothing', () => {
    const mock = new CourseJobMock();

    const reply = mock.handle(courseJobEndpoints.start, request(form()), 'a');

    expect(reply?.status).toBe(410);
    expect(reply?.body).toMatchObject({
      status: 'ERROR',
      messageCode: 'ASSISTANT-COURSE_JOBS_RETIRED',
      message:
        'Tạo khóa học bằng AI theo cách cũ đã ngừng. Hãy dùng Soạn cùng trợ lý.',
      data: null,
    });
    const listed = mock.handle(courseJobEndpoints.list, request(), 'a');
    expect((listed?.body as { data: unknown[] }).data).toHaveLength(0);
  });

  it('moves a job started before a step per look and parks it for approval', () => {
    const mock = new CourseJobMock();

    const job = mock.queue('a', inputs, 'quy-trinh.md');
    expect(job.status).toBe('queued');

    const progress = [1, 2, 3].map(() => {
      const reply = mock.handle(
        courseJobEndpoints.get,
        request(null, { jobId: String(job.jobId) }),
        'a',
      );
      return CourseJobSchema.parse((reply?.body as { data: unknown }).data);
    });
    expect(progress.map((item) => item.progress)).toEqual([10, 20, 30]);
    expect(progress[2].status).toBe('waiting_approval');
  });

  it('lists the course of each job and stops a running job once', () => {
    const mock = new CourseJobMock();
    const job = mock.queue('a', inputs, 'quy-trinh.md');

    const listed = mock.handle(courseJobEndpoints.list, request(), 'a');
    const rows = (listed?.body as { data: { courseId: number }[] }).data;
    expect(rows[0].courseId).toBe(job.courseId);

    const params = { jobId: String(job.jobId) };
    const stopped = mock.handle(
      courseJobEndpoints.stop,
      request(null, params),
      'a',
    );
    expect(
      CourseJobSchema.parse((stopped?.body as { data: unknown }).data).status,
    ).toBe('stopped');

    const again = mock.handle(
      courseJobEndpoints.stop,
      request(null, params),
      'a',
    );
    expect(JSON.stringify(again?.body)).toContain('JOB_FINISHED');
  });

  it('lists only the jobs of the caller', () => {
    const mock = new CourseJobMock();
    for (let n = 0; n < 3; n += 1) mock.queue('a', inputs, 'quy-trinh.md');

    const mine = mock.handle(courseJobEndpoints.list, request(), 'a');
    const theirs = mock.handle(courseJobEndpoints.list, request(), 'b');

    expect((mine?.body as { data: unknown[] }).data).toHaveLength(3);
    expect((theirs?.body as { data: unknown[] }).data).toHaveLength(0);
  });
});
