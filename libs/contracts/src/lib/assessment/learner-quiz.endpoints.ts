// The backend's learner quiz API (ASSESSMENT.md, "Danh sách API"); keys follow the mockup's
// api/learner.js quiz functions (quizIntro, startAttempt, saveAnswer, submitAttempt, attemptResult).
import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  AnswerReceiptSchema,
  AttemptSessionSchema,
  LearnerAttemptHistorySchema,
  LearnerAttemptResultSchema,
  LearnerQuizCardSchema,
  LearnerQuizIntroSchema,
  MyAttemptPageSchema,
  MyAttemptsExportQuerySchema,
  MyAttemptsQuerySchema,
  MyCompetencySchema,
  SaveAnswerBodySchema,
} from './learner-quiz.schema';

const courseParams = z.object({ courseId: z.number().int() });
const quizParams = z.object({ quizId: z.number().int() });
const attemptParams = z.object({ attemptId: z.number().int() });

export const learnerQuizEndpoints = {
  /**
   * The published quizzes of a course the caller is learning, the final exam last, each with the
   * caller's attempts, why it cannot start, and the quiz lesson that holds it.
   */
  courseQuizzes: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/courses/{courseId}/quizzes',
    params: courseParams,
    response: z.array(LearnerQuizCardSchema),
  }),
  /** The screen before a quiz: its settings, the caller's attempts and `canStart` / `blockReason`. */
  quizIntro: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/quizzes/{quizId}',
    params: quizParams,
    response: LearnerQuizIntroSchema,
  }),
  /** Starts an attempt, or returns the one in progress (also from another device). */
  startAttempt: defineEndpoint({
    method: 'post',
    path: '/api/v1/me/quizzes/{quizId}/attempts',
    params: quizParams,
    response: AttemptSessionSchema,
  }),
  /** Every attempt of the caller for one quiz, with the combined summary. */
  quizHistory: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/quizzes/{quizId}/attempts',
    params: quizParams,
    response: LearnerAttemptHistorySchema,
  }),
  /** The caller's attempts across every quiz, newest first by default; filter by quiz and status. */
  myAttempts: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/quiz-attempts',
    query: MyAttemptsQuerySchema,
    response: MyAttemptPageSchema,
  }),
  /** The same rows as `myAttempts` as a UTF-8 CSV, up to 10,000. */
  exportAttempts: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/quiz-attempts/export',
    query: MyAttemptsExportQuerySchema,
    responseType: 'blob',
    response: z.instanceof(Blob),
  }),
  /** Reloads an attempt in progress: the dealt questions and the answers saved so far. */
  attemptSession: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/quiz-attempts/{attemptId}',
    params: attemptParams,
    response: AttemptSessionSchema,
  }),
  /** Saves the choice and/or the review flag of one question; a field left out is kept. */
  saveAnswer: defineEndpoint({
    method: 'patch',
    path: '/api/v1/me/quiz-attempts/{attemptId}/questions/{attemptQuestionId}',
    params: attemptParams.extend({ attemptQuestionId: z.number().int() }),
    body: SaveAnswerBodySchema,
    response: AnswerReceiptSchema,
  }),
  /** Grades the attempt on the server; sending it again returns the same result. */
  submitAttempt: defineEndpoint({
    method: 'post',
    path: '/api/v1/me/quiz-attempts/{attemptId}/submit',
    params: attemptParams,
    response: LearnerAttemptResultSchema,
  }),
  /** A graded attempt: score, pass mark, competencies and, when the policy allows, the review. */
  attemptResult: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/quiz-attempts/{attemptId}/result',
    params: attemptParams,
    response: LearnerAttemptResultSchema,
  }),
  /** The caller's result per competency across every graded attempt, optionally for one course. */
  myCompetency: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/competency',
    query: z.object({ courseId: z.number().int().optional() }),
    response: z.array(MyCompetencySchema),
  }),
} as const;
