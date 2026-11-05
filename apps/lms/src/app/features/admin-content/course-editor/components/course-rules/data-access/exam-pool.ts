import {
  assessmentV1Endpoints,
  programAssessmentEndpoints,
  type QuizDetailV1,
} from '@lms/contracts';
import { EMPTY, expand, map, reduce, switchMap, type Observable } from 'rxjs';
import type { EndpointClient } from '../../../../../../core/http/endpoint-client';
import { POOL_PAGE_SIZE, POOL_PAGES } from './course-exam.model';

/** The course whose program bank fills the pool; the course path is how its managers may read it. */
export interface ExamPoolSource {
  readonly programId: number;
  readonly courseId: number;
}

/**
 * Writes the whole active bank of the program as the exam's pool (the newest questions first, at
 * most {@link POOL_LIMIT}). The quiz is read first for the version the write must carry; the
 * quiz that comes back carries the version after it, for the call that follows.
 */
export function syncExamPool(
  client: EndpointClient,
  quizId: number,
  source: ExamPoolSource,
): Observable<QuizDetailV1> {
  return client
    .call(assessmentV1Endpoints.quiz, { params: { id: quizId } })
    .pipe(
      switchMap((quiz) =>
        activeQuestionIds(client, source).pipe(
          switchMap((ids) =>
            client.call(assessmentV1Endpoints.replacePool, {
              params: { id: quizId },
              query: { expectedVersion: quiz.quiz.rowVersion },
              body: {
                items: ids.map((questionId, sortNo) => ({
                  questionId,
                  sortNo,
                  points: null,
                })),
              },
            }),
          ),
        ),
      ),
    );
}

function activeQuestionIds(
  client: EndpointClient,
  source: ExamPoolSource,
): Observable<number[]> {
  const read = (page: number) =>
    client.call(programAssessmentEndpoints.questions, {
      query: {
        ...source,
        status: 'ACTIVE',
        page,
        size: POOL_PAGE_SIZE,
        sort: 'id,desc',
      },
    });
  return read(0).pipe(
    expand((result) =>
      result.page + 1 < result.totalPages && result.page + 1 < POOL_PAGES
        ? read(result.page + 1)
        : EMPTY,
    ),
    map((result) => result.items.map((item) => item.id)),
    reduce((all, ids) => [...all, ...ids], [] as number[]),
  );
}
