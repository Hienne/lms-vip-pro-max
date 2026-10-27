/**
 * Candidate Java API contracts mapped to assessment_schema.sql.
 * Keep served:'mock' until these DTOs are implemented and verified by the Java service.
 */
import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageQuerySchema, PageSchema } from '../http/page';
import {
  AssessmentQuestionPageDtoSchema,
  AssessmentQuizPageDtoSchema,
  AssessmentStatusSchema,
  AttemptResultDtoSchema,
  AttemptSnapshotDtoSchema,
  QuizDtoSchema,
  QuizIntroDtoSchema,
  QuestionItemStatsDtoSchema,
  QuestionDtoSchema,
  SaveAttemptAnswerCommandDtoSchema,
  SaveAttemptAnswerResultDtoSchema,
  SaveQuestionDtoSchema,
  SaveQuizDtoSchema,
  StartAttemptCommandDtoSchema,
  SubmitAttemptCommandDtoSchema,
  SubmitAttemptResultDtoSchema,
} from './assessment-sql.schema';

const quizParams = z.object({ quizId: z.string().regex(/^\d+$/) });
const questionParams = z.object({ questionId: z.string().regex(/^\d+$/) });
const attemptParams = z.object({ attemptId: z.string().regex(/^\d+$/) });
const attemptQuestionParams = attemptParams.extend({
  attemptQuestionId: z.string().regex(/^\d+$/),
});

export const assessmentSqlEndpoints = {
  /** GET /api/admin/questions — question + question_option admin projection. */
  questions: defineEndpoint({
    method: 'get',
    path: '/api/admin/questions',
    query: PageQuerySchema.extend({
      courseId: z.string().regex(/^\d+$/).optional(),
      lessonId: z.string().regex(/^\d+$/).optional(),
      competencyId: z.string().regex(/^\d+$/).optional(),
      questionType: z.enum(['SINGLE', 'MULTIPLE']).optional(),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
      status: AssessmentStatusSchema.optional(),
      q: z.string().optional(),
    }),
    response: AssessmentQuestionPageDtoSchema,
    served: 'mock',
  }),
  createQuestion: defineEndpoint({
    method: 'post',
    path: '/api/admin/questions',
    body: SaveQuestionDtoSchema,
    response: QuestionDtoSchema,
    served: 'mock',
  }),
  updateQuestion: defineEndpoint({
    method: 'put',
    path: '/api/admin/questions/{questionId}',
    params: questionParams,
    body: SaveQuestionDtoSchema,
    response: QuestionDtoSchema,
    served: 'mock',
  }),
  setQuestionStatus: defineEndpoint({
    method: 'patch',
    path: '/api/admin/questions/{questionId}/status',
    params: questionParams,
    body: z.object({ status: AssessmentStatusSchema }),
    response: z.object({ id: z.string(), status: AssessmentStatusSchema }),
    served: 'mock',
  }),
  quizzes: defineEndpoint({
    method: 'get',
    path: '/api/admin/quizzes',
    query: PageQuerySchema.extend({
      courseId: z.string().regex(/^\d+$/).optional(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
      quizType: z.enum(['PRACTICE', 'FINAL_EXAM']).optional(),
    }),
    response: AssessmentQuizPageDtoSchema,
    served: 'mock',
  }),
  quiz: defineEndpoint({
    method: 'get',
    path: '/api/admin/quizzes/{quizId}',
    params: quizParams,
    response: QuizDtoSchema,
    served: 'mock',
  }),
  createQuiz: defineEndpoint({
    method: 'post',
    path: '/api/admin/quizzes',
    body: SaveQuizDtoSchema,
    response: QuizDtoSchema,
    served: 'mock',
  }),
  updateQuiz: defineEndpoint({
    method: 'put',
    path: '/api/admin/quizzes/{quizId}',
    params: quizParams,
    body: SaveQuizDtoSchema,
    response: QuizDtoSchema,
    served: 'mock',
  }),
  quizIntro: defineEndpoint({
    method: 'get',
    path: '/api/quizzes/{quizId}/summary/me',
    params: quizParams,
    response: QuizIntroDtoSchema,
    served: 'mock',
  }),
  startAttempt: defineEndpoint({
    method: 'post',
    path: '/api/quizzes/{quizId}/attempts',
    params: quizParams,
    body: StartAttemptCommandDtoSchema,
    response: AttemptSnapshotDtoSchema,
    served: 'mock',
  }),
  currentAttempt: defineEndpoint({
    method: 'get',
    path: '/api/quizzes/{quizId}/attempts/current',
    params: quizParams,
    response: AttemptSnapshotDtoSchema.nullable(),
    served: 'mock',
  }),
  saveAnswer: defineEndpoint({
    method: 'put',
    path: '/api/attempts/{attemptId}/answers/{attemptQuestionId}',
    params: attemptQuestionParams,
    body: SaveAttemptAnswerCommandDtoSchema,
    response: SaveAttemptAnswerResultDtoSchema,
    served: 'mock',
  }),
  submitAttempt: defineEndpoint({
    method: 'post',
    path: '/api/attempts/{attemptId}/submit',
    params: attemptParams,
    body: SubmitAttemptCommandDtoSchema,
    response: SubmitAttemptResultDtoSchema,
    served: 'mock',
  }),
  attemptHistory: defineEndpoint({
    method: 'get',
    path: '/api/quizzes/{quizId}/attempts/me',
    params: quizParams,
    query: PageQuerySchema,
    response: PageSchema(AttemptSnapshotDtoSchema.shape.attempt),
    served: 'mock',
  }),
  attemptResult: defineEndpoint({
    method: 'get',
    path: '/api/attempts/{attemptId}/result',
    params: attemptParams,
    response: AttemptResultDtoSchema,
    served: 'mock',
  }),
  questionItemStats: defineEndpoint({
    method: 'get',
    path: '/api/admin/questions/{questionId}/statistics',
    params: questionParams,
    response: PageSchema(QuestionItemStatsDtoSchema),
    served: 'mock',
  }),
} as const;
