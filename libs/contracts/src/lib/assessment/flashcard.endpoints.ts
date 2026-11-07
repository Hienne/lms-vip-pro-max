import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';

const id = z.number().int().positive();
const course = z.object({ courseId: id });
const card = course.extend({ cardId: id });
const version = z.number().int().nonnegative();
const rating = z.enum(['AGAIN', 'KNOWN']);
const publication = z.enum(['DRAFT', 'PUBLISHED', 'WITHDRAWN']);
const managed = z.array(
  z.object({
    id,
    questionId: id,
    status: publication,
    prompt: z.string(),
    current: z.boolean(),
  }),
);
const studyCard = z.object({
  id,
  questionVersion: version,
  competencyId: id,
  competencyName: z.string(),
  prompt: z.string(),
  reviewStatus: rating.nullish(),
  starred: z.boolean(),
});
export type StudyFlashcard = z.infer<typeof studyCard>;
export type FlashcardRating = z.infer<typeof rating>;
export type FlashcardPublication = z.infer<typeof publication>;

export const flashcardEndpoints = {
  list: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/courses/{courseId}/flashcards',
    params: course,
    response: z.array(studyCard),
  }),
  reveal: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/courses/{courseId}/flashcards/{cardId}/answer',
    params: card,
    query: z.object({ questionVersion: version }),
    response: z.object({
      options: z.array(z.string()),
      explanation: z.string().nullish(),
    }),
  }),
  progress: defineEndpoint({
    method: 'patch',
    path: '/api/v1/me/courses/{courseId}/flashcards/{cardId}/progress',
    params: card,
    body: z.object({
      questionVersion: version,
      rating: rating.optional(),
      starred: z.boolean().optional(),
    }),
    response: z.boolean(),
  }),
  managed: defineEndpoint({
    method: 'get',
    path: '/api/v1/courses/{courseId}/flashcards',
    params: course,
    response: managed,
  }),
  publish: defineEndpoint({
    method: 'put',
    path: '/api/v1/courses/{courseId}/flashcards/{questionId}',
    params: course.extend({ questionId: id }),
    body: z.object({
      status: publication,
      questionVersion: version.optional(),
    }),
    response: managed,
  }),
} as const;
