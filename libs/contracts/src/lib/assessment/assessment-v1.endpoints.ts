import { defineEndpoint } from '../http/endpoint';
import {
  QuizSummaryPageSchema,
  QuizSummaryQuerySchema,
} from './assessment-v1.schema';

/** The backend's quiz authoring endpoints the app calls (/api/v1/quizzes). */
export const assessmentV1Endpoints = {
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
