import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';

const id = z.number().int().positive();
const deckParams = z.object({ deckId: id });
const cardParams = deckParams.extend({ cardId: id });
const deckInput = z.object({ name: z.string(), courseId: id.nullable() });
const cardInput = z.object({
  prompt: z.string(),
  answer: z.string(),
  competencyId: id.nullable(),
});
const deck = z.object({
  id,
  name: z.string(),
  courseId: id.nullish(),
  cardCount: z.number(),
});
const card = z.object({
  id,
  prompt: z.string(),
  answer: z.string(),
  competencyId: id.nullish(),
  reviewStatus: z.enum(['AGAIN', 'KNOWN']).nullish(),
  starred: z.boolean(),
});
export type PersonalDeck = z.infer<typeof deck>;
export type PersonalCard = z.infer<typeof card>;

export const personalFlashcardEndpoints = {
  decks: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/flashcard-decks',
    response: z.array(deck),
  }),
  createDeck: defineEndpoint({
    method: 'post',
    path: '/api/v1/me/flashcard-decks',
    body: deckInput,
    response: deck,
  }),
  updateDeck: defineEndpoint({
    method: 'put',
    path: '/api/v1/me/flashcard-decks/{deckId}',
    params: deckParams,
    body: deckInput,
    response: deck,
  }),
  deleteDeck: defineEndpoint({
    method: 'delete',
    path: '/api/v1/me/flashcard-decks/{deckId}',
    params: deckParams,
    response: z.null(),
  }),
  cards: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/flashcard-decks/{deckId}/cards',
    params: deckParams,
    response: z.array(card),
  }),
  createCards: defineEndpoint({
    method: 'post',
    path: '/api/v1/me/flashcard-decks/{deckId}/cards/batch',
    params: deckParams,
    body: z.object({ items: z.array(cardInput).min(1).max(100) }),
    response: z.array(card),
  }),
  createCard: defineEndpoint({
    method: 'post',
    path: '/api/v1/me/flashcard-decks/{deckId}/cards',
    params: deckParams,
    body: cardInput,
    response: card,
  }),
  updateCard: defineEndpoint({
    method: 'put',
    path: '/api/v1/me/flashcard-decks/{deckId}/cards/{cardId}',
    params: cardParams,
    body: cardInput,
    response: card,
  }),
  deleteCard: defineEndpoint({
    method: 'delete',
    path: '/api/v1/me/flashcard-decks/{deckId}/cards/{cardId}',
    params: cardParams,
    response: z.null(),
  }),
  progress: defineEndpoint({
    method: 'patch',
    path: '/api/v1/me/flashcard-decks/{deckId}/cards/{cardId}/progress',
    params: cardParams,
    body: z.object({
      rating: z.enum(['AGAIN', 'KNOWN']).optional(),
      starred: z.boolean().optional(),
    }),
    response: card,
  }),
} as const;
