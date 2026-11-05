import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import { XLSX_MIME_TYPE } from '../organization/organization.schema';
import {
  QuizSummaryPageSchema,
  QuizSummaryQuerySchema,
  AssessmentItemStatusV1Schema,
  AssessmentVersionQuerySchema,
  CompetencyV1Schema,
  QuestionSummaryV1Schema,
  QuestionDetailV1Schema,
  QuestionQueryV1Schema,
  QuestionRequestV1Schema,
  QuestionImportCommandSchema,
  QuestionImportQuerySchema,
  QuestionImportResultSchema,
  QuizRequestV1Schema,
  QuizDetailV1Schema,
  QuizPoolRequestV1Schema,
} from './assessment-v1.schema';

/** The backend's quiz authoring endpoints the app calls (/api/v1/quizzes). */
export const assessmentV1Endpoints = {
  /** Authoring options from the shared competency catalogue, not a mock assessment-options API. */
  competencies: defineEndpoint({
    method: 'get',
    path: '/api/v1/competencies',
    query: z.object({ status: AssessmentItemStatusV1Schema.optional() }),
    response: z.array(CompetencyV1Schema),
  }),
  /** Server-paged summaries; answers are fetched only on opening a question detail. */
  questions: defineEndpoint({
    method: 'get',
    path: '/api/v1/questions',
    query: QuestionQueryV1Schema,
    response: PageSchema(QuestionSummaryV1Schema),
  }),
  /** The Excel template of the question import (an `.xlsx` file, no envelope). */
  questionImportTemplate: defineEndpoint({
    method: 'get',
    path: '/api/v1/questions/import-template',
    responseType: 'blob',
    response: z.instanceof(Blob).refine((blob) => blob.type === XLSX_MIME_TYPE),
  }),
  /**
   * Checks (`dryRun=true`) or imports up to 1000 questions into a course's bank from an `.xlsx`
   * file. An invalid file is an `ASSESSMENT-IMPORT_INVALID` refusal and nothing is written.
   */
  importQuestions: defineEndpoint({
    method: 'post',
    path: '/api/v1/questions/import',
    query: QuestionImportQuerySchema,
    body: QuestionImportCommandSchema,
    encoding: 'multipart',
    response: QuestionImportResultSchema,
  }),
  question: defineEndpoint({
    method: 'get',
    path: '/api/v1/questions/{id}',
    params: z.object({ id: z.number().int().positive() }),
    response: QuestionDetailV1Schema,
  }),
  createQuestion: defineEndpoint({
    method: 'post',
    path: '/api/v1/questions',
    body: QuestionRequestV1Schema,
    response: QuestionDetailV1Schema,
  }),
  /** expectedVersion is a query parameter, not part of the JSON body. */
  updateQuestion: defineEndpoint({
    method: 'put',
    path: '/api/v1/questions/{id}',
    params: z.object({ id: z.number().int().positive() }),
    query: AssessmentVersionQuerySchema,
    body: QuestionRequestV1Schema,
    response: QuestionDetailV1Schema,
  }),
  bulkQuestionStatus: defineEndpoint({
    method: 'post',
    path: '/api/v1/questions/bulk-status',
    body: z.object({
      ids: z.array(z.number().int().positive()).min(1).max(100),
      status: AssessmentItemStatusV1Schema,
    }),
    response: z.object({ affected: z.number().int() }),
  }),
  bulkDeleteQuestions: defineEndpoint({
    method: 'post',
    path: '/api/v1/questions/bulk-delete',
    body: z.object({
      ids: z.array(z.number().int().positive()).min(1).max(100),
    }),
    response: z.object({ affected: z.number().int() }),
  }),
  quiz: defineEndpoint({
    method: 'get',
    path: '/api/v1/quizzes/{id}',
    params: z.object({ id: z.number().int().positive() }),
    response: QuizDetailV1Schema,
  }),
  createQuiz: defineEndpoint({
    method: 'post',
    path: '/api/v1/quizzes',
    body: QuizRequestV1Schema,
    response: QuizDetailV1Schema,
  }),
  updateQuiz: defineEndpoint({
    method: 'put',
    path: '/api/v1/quizzes/{id}',
    params: z.object({ id: z.number().int().positive() }),
    query: AssessmentVersionQuerySchema,
    body: QuizRequestV1Schema,
    response: QuizDetailV1Schema,
  }),
  /** Pool replacement is separate from settings and returns the new row version. */
  replacePool: defineEndpoint({
    method: 'put',
    path: '/api/v1/quizzes/{id}/questions',
    params: z.object({ id: z.number().int().positive() }),
    query: AssessmentVersionQuerySchema,
    body: QuizPoolRequestV1Schema,
    response: QuizDetailV1Schema,
  }),
  publishQuiz: defineEndpoint({
    method: 'post',
    path: '/api/v1/quizzes/{id}/publish',
    params: z.object({ id: z.number().int().positive() }),
    body: AssessmentVersionQuerySchema,
    response: QuizDetailV1Schema,
  }),
  closeQuiz: defineEndpoint({
    method: 'post',
    path: '/api/v1/quizzes/{id}/close',
    params: z.object({ id: z.number().int().positive() }),
    body: AssessmentVersionQuerySchema,
    response: QuizDetailV1Schema,
  }),
  /**
   * The quizzes of one course, with how many were graded and passed. The caller must be able to
   * manage the course; the course editor lists them to pick a quiz lesson's quiz.
   */
  courseQuizList: defineEndpoint({
    method: 'get',
    path: '/api/v1/quizzes',
    query: QuizSummaryQuerySchema,
    response: QuizSummaryPageSchema,
  }),
} as const;
