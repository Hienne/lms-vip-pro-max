import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import { assessmentV1Endpoints as legacy } from './assessment-v1.endpoints';
import {
  QuestionDetailV1Schema,
  QuestionSummaryV1Schema,
  QuestionRequestV1Schema,
  QuestionQueryV1Schema,
  QuestionImportQuerySchema,
} from './assessment-v1.schema';

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
}).extend({ programId, courseId: z.number().int().positive().optional() });
export const ProgramQuestionImportQuerySchema = QuestionImportQuerySchema.omit({
  courseId: true,
}).extend({ programId, courseId: z.number().int().positive().optional() });
export type ProgramQuestionDetail = z.infer<typeof ProgramQuestionDetailSchema>;
export type ProgramQuestionRequest = z.infer<
  typeof ProgramQuestionRequestSchema
>;
export type ProgramQuestionQuery = z.infer<typeof ProgramQuestionQuerySchema>;

/** Program-scoped authoring DTOs on the verified v1 controller; legacy course inputs stay separate. */
export const programAssessmentEndpoints = {
  ...legacy,
  importQuestions: defineEndpoint({
    ...legacy.importQuestions,
    query: ProgramQuestionImportQuerySchema,
  }),
  questions: defineEndpoint({
    ...legacy.questions,
    query: ProgramQuestionQuerySchema,
    response: PageSchema(ProgramQuestionSummarySchema),
  }),
  question: defineEndpoint({
    ...legacy.question,
    response: ProgramQuestionDetailSchema,
  }),
  createQuestion: defineEndpoint({
    ...legacy.createQuestion,
    body: ProgramQuestionRequestSchema,
    response: ProgramQuestionDetailSchema,
  }),
  updateQuestion: defineEndpoint({
    ...legacy.updateQuestion,
    body: ProgramQuestionRequestSchema,
    response: ProgramQuestionDetailSchema,
  }),
  bulkQuestionStatus: defineEndpoint({
    ...legacy.bulkQuestionStatus,
  }),
  bulkDeleteQuestions: defineEndpoint({
    ...legacy.bulkDeleteQuestions,
  }),
} as const;
