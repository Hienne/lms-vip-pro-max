import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import { assessmentV1Endpoints as legacy } from './assessment-v1.endpoints';
import {
  QuestionDetailV1Schema,
  QuestionSummaryV1Schema,
  QuestionRequestV1Schema,
  QuestionQueryV1Schema,
} from './assessment-v1.schema';
import { TrainingProgramSchema } from '../training-catalog/training-catalog.schema';

const programId = z.number().int().positive();
export const ProgramQuestionDetailSchema = QuestionDetailV1Schema.omit({
  courseId: true,
  lessonId: true,
}).extend({ programId });
export const ProgramQuestionSummarySchema = QuestionSummaryV1Schema.omit({
  courseId: true,
  lessonId: true,
}).extend({ programId });
export const ProgramQuestionRequestSchema = QuestionRequestV1Schema.omit({
  courseId: true,
  lessonId: true,
}).extend({ programId });
export const ProgramQuestionQuerySchema = QuestionQueryV1Schema.omit({
  courseId: true,
  lessonId: true,
}).extend({ programId });
export type ProgramQuestionDetail = z.infer<typeof ProgramQuestionDetailSchema>;
export type ProgramQuestionRequest = z.infer<
  typeof ProgramQuestionRequestSchema
>;
export type ProgramQuestionQuery = z.infer<typeof ProgramQuestionQuerySchema>;

/**
 * FE integration proposal, NOT implemented by Java. Isolated paths keep mock program banks
 * and quiz pools from being mixed with real course-scoped question IDs or version receipts.
 * Confirm paths, authorization and DTOs with BE before switching any endpoint to backend.
 * Quiz wire shapes stay unchanged: a quiz belongs to a course, its pool to that course's program.
 */
export const programAssessmentEndpoints = {
  ...legacy,
  programs: defineEndpoint({
    method: 'get',
    path: '/api/assessment-program/programs',
    served: 'mock',
    query: z.object({
      q: z.string().optional(),
      page: z.number().int().nonnegative(),
      size: z.number().int().min(1).max(100),
    }),
    response: PageSchema(TrainingProgramSchema),
  }),
  questions: defineEndpoint({
    ...legacy.questions,
    path: '/api/assessment-program/questions',
    served: 'mock',
    query: ProgramQuestionQuerySchema,
    response: PageSchema(ProgramQuestionSummarySchema),
  }),
  question: defineEndpoint({
    ...legacy.question,
    path: '/api/assessment-program/questions/{id}',
    served: 'mock',
    response: ProgramQuestionDetailSchema,
  }),
  createQuestion: defineEndpoint({
    ...legacy.createQuestion,
    path: '/api/assessment-program/questions',
    served: 'mock',
    body: ProgramQuestionRequestSchema,
    response: ProgramQuestionDetailSchema,
  }),
  updateQuestion: defineEndpoint({
    ...legacy.updateQuestion,
    path: '/api/assessment-program/questions/{id}',
    served: 'mock',
    body: ProgramQuestionRequestSchema,
    response: ProgramQuestionDetailSchema,
  }),
  bulkQuestionStatus: defineEndpoint({
    ...legacy.bulkQuestionStatus,
    path: '/api/assessment-program/questions/bulk-status',
    served: 'mock',
  }),
  bulkDeleteQuestions: defineEndpoint({
    ...legacy.bulkDeleteQuestions,
    path: '/api/assessment-program/questions/bulk-delete',
    served: 'mock',
  }),
  courseQuizList: defineEndpoint({
    ...legacy.courseQuizList,
    path: '/api/assessment-program/quizzes',
    served: 'mock',
  }),
  quiz: defineEndpoint({
    ...legacy.quiz,
    path: '/api/assessment-program/quizzes/{id}',
    served: 'mock',
  }),
  createQuiz: defineEndpoint({
    ...legacy.createQuiz,
    path: '/api/assessment-program/quizzes',
    served: 'mock',
  }),
  updateQuiz: defineEndpoint({
    ...legacy.updateQuiz,
    path: '/api/assessment-program/quizzes/{id}',
    served: 'mock',
  }),
  replacePool: defineEndpoint({
    ...legacy.replacePool,
    path: '/api/assessment-program/quizzes/{id}/questions',
    served: 'mock',
  }),
  publishQuiz: defineEndpoint({
    ...legacy.publishQuiz,
    path: '/api/assessment-program/quizzes/{id}/publish',
    served: 'mock',
  }),
  closeQuiz: defineEndpoint({
    ...legacy.closeQuiz,
    path: '/api/assessment-program/quizzes/{id}/close',
    served: 'mock',
  }),
} as const;
