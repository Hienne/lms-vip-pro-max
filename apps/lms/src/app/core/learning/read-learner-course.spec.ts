import { learnerEndpoints } from '@lms/contracts';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ApiError } from '../http/api-error';
import type { EndpointClient } from '../http/endpoint-client';
import { readLearnerCourse } from './read-learner-course';

const clientAnswering = (answer: unknown) => {
  const call = vi.fn(() => answer);
  return { client: { call } as unknown as EndpointClient, call };
};

describe('readLearnerCourse', () => {
  it('reads the course once through the course endpoint', async () => {
    const course = { card: { courseId: 8 }, content: {} };
    const { client, call } = clientAnswering(of(course));

    await expect(firstValueFrom(readLearnerCourse(client, 8))).resolves.toBe(
      course,
    );
    expect(call).toHaveBeenCalledExactlyOnceWith(learnerEndpoints.course, {
      params: { courseId: 8 },
    });
  });

  it('turns the not found refusal into null, so a page can say so', async () => {
    const { client } = clientAnswering(
      throwError(
        () => new ApiError('LEARNING-NOT_FOUND', 'Không tìm thấy', undefined),
      ),
    );

    await expect(
      firstValueFrom(readLearnerCourse(client, 99)),
    ).resolves.toBeNull();
  });

  it('lets any other failure through', async () => {
    const { client } = clientAnswering(
      throwError(() => new ApiError('CORE-INTERNAL_ERROR', undefined, 'Lỗi')),
    );

    await expect(
      firstValueFrom(readLearnerCourse(client, 1)),
    ).rejects.toMatchObject({ messageCode: 'CORE-INTERNAL_ERROR' });
  });
});
