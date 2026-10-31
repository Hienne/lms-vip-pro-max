import { learnerEndpoints, type LearnerCourse } from '@lms/contracts';
import { catchError, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '../http/api-error';
import type { EndpointClient } from '../http/endpoint-client';

/** The code the server answers for a course the caller cannot see, or one that does not exist. */
const NOT_FOUND = 'LEARNING-NOT_FOUND';

/**
 * The learner's course in one call: the card and the content (`GET /me/learning/courses/{id}`).
 * A course the server will not show is `null`, so a page can say "not found"; any other failure
 * stays an error.
 */
export function readLearnerCourse(
  client: EndpointClient,
  courseId: number,
): Observable<LearnerCourse | null> {
  return client
    .call(learnerEndpoints.course, { params: { courseId } })
    .pipe(
      catchError((error: unknown) =>
        error instanceof ApiError && error.messageCode === NOT_FOUND
          ? of(null)
          : throwError(() => error),
      ),
    );
}
