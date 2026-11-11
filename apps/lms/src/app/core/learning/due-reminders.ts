import { learnerEndpoints, type LearningReminder } from '@lms/contracts';
import { catchError, of, throwError, type Observable } from 'rxjs';
import { toAppError } from '../errors/app-error';
import type { EndpointClient } from '../http/endpoint-client';

/**
 * The caller's due reminders. Only a learner has any: a 403 (a role without the learner scope) is
 * an empty list, not an error; any other failure stays one.
 */
export function dueReminders(
  client: EndpointClient,
  inbox = false,
): Observable<LearningReminder[]> {
  return client
    .call(inbox ? learnerEndpoints.reminderInbox : learnerEndpoints.reminders)
    .pipe(
      catchError((error: unknown) =>
        toAppError(error).kind === 'forbidden'
          ? of([] as LearningReminder[])
          : throwError(() => error),
      ),
    );
}
