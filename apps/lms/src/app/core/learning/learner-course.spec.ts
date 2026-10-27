import { learnerEndpoints, type CourseCard, type Page } from '@lms/contracts';
import { firstValueFrom, Observable } from 'rxjs';
import type { EndpointClient } from '../http/endpoint-client';
import { findLearnerCourse } from './learner-course';

type Endpoint =
  | typeof learnerEndpoints.myCourses
  | typeof learnerEndpoints.catalog;

const card = (courseId: number): CourseCard => ({
  courseId,
  code: `C${courseId}`,
});

/** A server holding `mine` and `catalog`, read 2 cards per page; records every request. */
function fakeClient(mine: number[], catalog: number[], size = 2) {
  const requests: { endpoint: Endpoint; page: number; size: number }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const call = (
    endpoint: Endpoint,
    input: { query: { page: number; size: number; sort: string } },
  ): Observable<Page<CourseCard>> => {
    const ids = endpoint === learnerEndpoints.myCourses ? mine : catalog;
    const start = input.query.page * size;
    return new Observable((subscriber) => {
      // The request exists once it is subscribed to, as `HttpClient` does.
      requests.push({
        endpoint,
        page: input.query.page,
        size: input.query.size,
      });
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      queueMicrotask(() => {
        inFlight -= 1;
        subscriber.next({
          items: ids.slice(start, start + size).map(card),
          page: input.query.page,
          size,
          totalElements: ids.length,
          totalPages: Math.ceil(ids.length / size),
        });
        subscriber.complete();
      });
    });
  };
  return {
    client: { call } as unknown as EndpointClient,
    requests,
    maxInFlight: () => maxInFlight,
  };
}

describe('findLearnerCourse', () => {
  it('finds a course in my courses first and does not read the catalogue', async () => {
    const { client, requests } = fakeClient([1, 2, 3], [4, 5]);
    expect((await firstValueFrom(findLearnerCourse(client, 2)))?.courseId).toBe(
      2,
    );
    expect(
      requests.every((r) => r.endpoint === learnerEndpoints.myCourses),
    ).toBe(true);
  });

  it('falls back to the catalogue when my courses do not hold it', async () => {
    const { client, requests } = fakeClient([1], [4, 5]);
    expect((await firstValueFrom(findLearnerCourse(client, 5)))?.courseId).toBe(
      5,
    );
    expect(requests.at(-1)?.endpoint).toBe(learnerEndpoints.catalog);
  });

  it('reads 100 per page by id and stops at the page that holds the course', async () => {
    const { client, requests } = fakeClient([1, 2, 3, 4, 5, 6], []);
    await firstValueFrom(findLearnerCourse(client, 3));
    expect(requests.map((r) => r.page)).toEqual([0, 1]);
    expect(requests.every((r) => r.size === 100)).toBe(true);
  });

  it('returns null after the last page of both lists', async () => {
    const { client, requests } = fakeClient([1, 2, 3], [4, 5, 6]);
    expect(await firstValueFrom(findLearnerCourse(client, 99))).toBeNull();
    expect(
      requests.map((r) => [r.endpoint === learnerEndpoints.myCourses, r.page]),
    ).toEqual([
      [true, 0],
      [true, 1],
      [false, 0],
      [false, 1],
    ]);
  });

  it('gives up after 5 pages of each list', async () => {
    const many = Array.from({ length: 40 }, (_, i) => i + 1);
    const { client, requests } = fakeClient(many, many);
    expect(await firstValueFrom(findLearnerCourse(client, 999))).toBeNull();
    expect(
      requests.filter((r) => r.endpoint === learnerEndpoints.myCourses),
    ).toHaveLength(5);
    expect(
      requests.filter((r) => r.endpoint === learnerEndpoints.catalog),
    ).toHaveLength(5);
  });

  it('keeps one request in flight at a time', async () => {
    const { client, maxInFlight } = fakeClient([1, 2, 3, 4], [5, 6, 7, 8]);
    await firstValueFrom(findLearnerCourse(client, 8));
    expect(maxInFlight()).toBe(1);
  });

  it('passes an error of a page to the caller', async () => {
    const client = {
      call: () => new Observable<never>((s) => s.error(new Error('offline'))),
    } as unknown as EndpointClient;
    await expect(firstValueFrom(findLearnerCourse(client, 1))).rejects.toThrow(
      'offline',
    );
  });
});
