import { inject } from '@angular/core';
import { learnerEndpoints } from '@lms/contracts';
import { map } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/**
 * The server's evaluation of the course's completion conditions, read again each time a lesson is
 * completed on this page: a progress result carries the lesson and the enrolment, not the
 * evaluation. Idle until then, so the page reads the enrolment once as before; `summary` stays
 * `undefined` and the store keeps the evaluation the enrolment detail came with. A failed re-read
 * keeps the last evaluation it had. `null` means the server sent none (optional during rollout).
 */
export function courseCompletion(enrollmentId: () => number | undefined) {
  const client = inject(EndpointClient);
  const completed = invalidation();

  const data = serverData(
    (id: number) =>
      client
        .call(learnerEndpoints.enrollment, { params: { enrollmentId: id } })
        .pipe(map((detail) => detail.completion ?? null)),
    {
      params: () => (completed.version() > 0 ? enrollmentId() : undefined),
      reloadOn: completed,
    },
  );

  return {
    summary: data.value,
    /** A lesson of the enrolment just became completed. */
    lessonCompleted: () => completed.bump(),
  };
}
