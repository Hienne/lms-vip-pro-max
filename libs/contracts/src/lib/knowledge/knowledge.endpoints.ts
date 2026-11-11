import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  AskCommandSchema,
  ChatAnswerSchema,
  ChatStreamEventSchema,
  DocumentListQuerySchema,
  KnowledgeDocumentSchema,
  UploadDocumentCommandSchema,
} from './knowledge.schema';
import { z } from 'zod';

/**
 * The shared knowledge base and its chat. `ask` is the mockup's key (`src/api/learner.js`); the
 * rest are new with the backend's `/api/v1/knowledge`.
 */
export const knowledgeEndpoints = {
  /** The documents the caller may read, newest first; `mine` and `status` narrow the list. */
  documents: defineEndpoint({
    method: 'get',
    path: '/api/v1/knowledge/documents',
    query: DocumentListQuerySchema,
    response: PageSchema(KnowledgeDocumentSchema),
  }),
  /** One document, as the list shows it. */
  document: defineEndpoint({
    method: 'get',
    path: '/api/v1/knowledge/documents/{documentId}',
    params: z.object({ documentId: z.number().int() }),
    response: KnowledgeDocumentSchema,
  }),
  /** Uploads a `.pdf`, `.md` or `.docx` with its scope; it answers 201 with the document `queued`. */
  uploadDocument: defineEndpoint({
    method: 'post',
    path: '/api/v1/knowledge/documents',
    encoding: 'multipart',
    body: UploadDocumentCommandSchema,
    response: KnowledgeDocumentSchema,
  }),
  /**
   * Removes a document with its file and chunks. The owner may; an admin may remove a global
   * document or a unit document in their scope. 403 otherwise, not found when it cannot be read.
   */
  deleteDocument: defineEndpoint({
    method: 'delete',
    path: '/api/v1/knowledge/documents/{documentId}',
    params: z.object({ documentId: z.number().int() }),
    response: z.null(),
  }),
  /** One complete answer with its citations (the stream's non-incremental twin). */
  ask: defineEndpoint({
    method: 'post',
    path: '/api/v1/knowledge/chat',
    body: AskCommandSchema,
    response: ChatAnswerSchema,
  }),
  /** The answer as NDJSON events: `retrieved`, `delta`s, then `done` (or `error`). */
  askStream: defineEndpoint({
    method: 'post',
    path: '/api/v1/knowledge/chat/stream',
    body: AskCommandSchema,
    responseType: 'ndjson',
    response: ChatStreamEventSchema,
  }),
} as const;
