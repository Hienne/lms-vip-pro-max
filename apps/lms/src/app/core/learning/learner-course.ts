import { learnerEndpoints, type CourseCard } from '@lms/contracts';
import { Observable, of, switchMap } from 'rxjs';
import type { EndpointClient } from '../http/endpoint-client';

const PAGE_SIZE = 100;
const MAX_PAGES = 5;

type CardList =
  | typeof learnerEndpoints.myCourses
  | typeof learnerEndpoints.catalog;

/** Reads one list a page at a time and stops as soon as a page holds the course. */
function search(
  client: EndpointClient,
  list: CardList,
  courseId: number,
): Observable<CourseCard | null> {
  // Recursion through `switchMap`, not `expand`: `expand` asks for the next page before the
  // caller can stop at the page that holds the course.
  const page = (index: number): Observable<CourseCard | null> =>
    client
      .call(list, { query: { page: index, size: PAGE_SIZE, sort: 'id,asc' } })
      .pipe(
        switchMap((result) => {
          const found = result.items.find((c) => c.courseId === courseId);
          if (found) return of(found);
          return index + 1 < Math.min(result.totalPages, MAX_PAGES)
            ? page(index + 1)
            : of(null);
        }),
      );
  return page(0);
}

/**
 * The learner's card for one course, from `myCourses` and then `catalog`: the backend has no
 * learner endpoint for a single course (`GET /courses/{id}` is the author's). It reads at most
 * 5 pages of 100 of each list, so a course beyond that is reported as absent. Replace it with one
 * call when the backend adds the endpoint (SPEC-lesson-player, open question 1).
 */
export function findLearnerCourse(
  client: EndpointClient,
  courseId: number,
): Observable<CourseCard | null> {
  return search(client, learnerEndpoints.myCourses, courseId).pipe(
    switchMap((card) =>
      card ? of(card) : search(client, learnerEndpoints.catalog, courseId),
    ),
  );
}
