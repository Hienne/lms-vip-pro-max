import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  ConversationDetailSchema,
  ConversationListQuerySchema,
  ConversationSummarySchema,
  RenameConversationCommandSchema,
} from './conversation.schema';

const conversationParams = z.object({ conversationId: z.number().int() });

/** The caller's own conversations; another user's id answers like one that does not exist. */
export const conversationEndpoints = {
  /** Newest activity first; `q` narrows by title. */
  list: defineEndpoint({
    method: 'get',
    path: '/api/v1/assistant/conversations',
    query: ConversationListQuerySchema,
    response: PageSchema(ConversationSummarySchema),
  }),
  /** One conversation with every turn, citations and card states as stored. */
  detail: defineEndpoint({
    method: 'get',
    path: '/api/v1/assistant/conversations/{conversationId}',
    params: conversationParams,
    response: ConversationDetailSchema,
  }),
  rename: defineEndpoint({
    method: 'patch',
    path: '/api/v1/assistant/conversations/{conversationId}',
    params: conversationParams,
    body: RenameConversationCommandSchema,
    response: ConversationSummarySchema,
  }),
  /** Hard delete of one conversation and its turns. */
  remove: defineEndpoint({
    method: 'delete',
    path: '/api/v1/assistant/conversations/{conversationId}',
    params: conversationParams,
    response: z.null(),
  }),
  /** Hard delete of every conversation of the caller. */
  removeAll: defineEndpoint({
    method: 'delete',
    path: '/api/v1/assistant/conversations',
    response: z.null(),
  }),
} as const;
