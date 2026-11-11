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

const form = (patch: Record<string, unknown> = {}) => {
  const data = new FormData();
  data.set('file', new File(['x'], 'quy-trinh.md'));
  data.set('inputs', JSON.stringify({ ...inputs, ...patch }));
  return data;
};

describe('CourseJobMock', () => {
  it('queues a job, moves it a step per look and parks it for approval', () => {
    const mock = new CourseJobMock();

    const started = mock.handle(courseJobEndpoints.start, request(form()), 'a');
    const job = CourseJobSchema.parse(
      (started?.body as { data: unknown }).data,
    );
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

  it('refuses a start without chapters or a duration', () => {
    const mock = new CourseJobMock();

    const reply = mock.handle(
      courseJobEndpoints.start,
      request(form({ chapters: null })),
      'a',
    );

    expect(JSON.stringify(reply?.body)).toContain('CORE-VALIDATION_FAILED');
  });

  it('lists only the jobs of the caller and stops at three a day', () => {
    const mock = new CourseJobMock();
    for (let n = 0; n < 3; n += 1) {
      mock.handle(courseJobEndpoints.start, request(form()), 'a');
    }

    const fourth = mock.handle(courseJobEndpoints.start, request(form()), 'a');
    const mine = mock.handle(courseJobEndpoints.list, request(), 'a');
    const theirs = mock.handle(courseJobEndpoints.list, request(), 'b');

    expect(JSON.stringify(fourth?.body)).toContain(
      'ASSISTANT-JOB_RATE_LIMITED',
    );
    expect((mine?.body as { data: unknown[] }).data).toHaveLength(3);
    expect((theirs?.body as { data: unknown[] }).data).toHaveLength(0);
  });
});
