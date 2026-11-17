import {
  assessmentV1Endpoints,
  programAssessmentEndpoints,
  type QuizDetailV1,
} from '@lms/contracts';
import { EMPTY, expand, map, reduce, switchMap, type Observable } from 'rxjs';
import type { EndpointClient } from '../../../../../../core/http/endpoint-client';
import { POOL_PAGE_SIZE, type ExamQuestion } from './course-exam.model';

/** The course whose program bank fills the pool; the course path is how its managers may read it. */
export interface ExamPoolSource {
  readonly programId: number;
  readonly courseId?: number;
}

/**
 * Writes the active bank of the program as the exam's pool. The server validates its pool limit.
 * The quiz is read first for the version the write must carry; the
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

export function activeBankQuestions(
  client: EndpointClient,
  source: ExamPoolSource,
): Observable<ExamQuestion[]> {
  const read = (page: number) =>
    client
      .call(programAssessmentEndpoints.questions, {
        query: {
          ...source,
          status: 'ACTIVE',
          page,
          size: POOL_PAGE_SIZE,
          sort: 'id,desc',
        },
      })
      .pipe(
        map((result) => {
          if (result.page !== page)
            throw new Error('Question catalogue returned an unexpected page.');
          return result;
        }),
      );
  return read(0).pipe(
    expand((result) =>
      result.page + 1 < result.totalPages ? read(result.page + 1) : EMPTY,
    ),
    reduce(
      (all, result) => {
        for (const question of result.items)
          all.questions.set(question.id, question);
        return { questions: all.questions, total: result.totalElements };
      },
      { questions: new Map<number, ExamQuestion>(), total: 0 },
    ),
    map(({ questions, total }) => {
      if (questions.size !== total)
        throw new Error(
          'Question catalogue changed during loading; reload to read the complete bank.',
        );
      return [...questions.values()];
    }),
  );
}

function activeQuestionIds(
  client: EndpointClient,
  source: ExamPoolSource,
): Observable<number[]> {
  return activeBankQuestions(client, source).pipe(
    map((items) => items.map((item) => item.id)),
  );
}
