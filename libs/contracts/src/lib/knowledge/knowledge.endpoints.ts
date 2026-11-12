import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  AskCommandSchema,
  ChatAnswerSchema,
  ChatStreamEventSchema,
  DocumentListQuerySchema,
  DocumentTextQuerySchema,
  DocumentTextSchema,
  DuplicateGroupSchema,
  KnowledgeDocumentSchema,
  RenameDocumentCommandSchema,
  ReplaceDocumentCommandSchema,
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
  /**
   * The extracted text of the chunk `around` and `span` neighbours each side, for the source viewer.
   * Not found when the caller cannot search the document (as for a deleted one); the original file
   * has no endpoint.
   */
  documentText: defineEndpoint({
    method: 'get',
    path: '/api/v1/knowledge/documents/{documentId}/text',
    params: z.object({ documentId: z.number().int() }),
    query: DocumentTextQuerySchema,
    response: DocumentTextSchema,
  }),
  /**
   * The caller's documents sharing a file checksum in one scope, newest first. Nothing is deleted by
   * asking; each unwanted copy goes through `deleteDocument`.
   */
  duplicateDocuments: defineEndpoint({
    method: 'get',
    path: '/api/v1/knowledge/documents/duplicates',
    response: z.array(DuplicateGroupSchema),
  }),
  /**
   * Uploads a `.pdf`, `.md` or `.docx` with its scope and an optional title; it answers 201 with
   * the document `queued`, or 200 with the caller's existing document and `duplicate: true` when the
   * same file is already there in that scope (nothing is created).
   */
  uploadDocument: defineEndpoint({
    method: 'post',
    path: '/api/v1/knowledge/documents',
    encoding: 'multipart',
    body: UploadDocumentCommandSchema,
    response: KnowledgeDocumentSchema,
  }),
  /** Renames a document (its title, not its file); the owner, or an admin in scope. */
  renameDocument: defineEndpoint({
    method: 'patch',
    path: '/api/v1/knowledge/documents/{documentId}',
    params: z.object({ documentId: z.number().int() }),
    body: RenameDocumentCommandSchema,
    response: KnowledgeDocumentSchema,
  }),
  /**
   * Queues a new file for a ready document: the id stays and the old version answers until the new one
   * is indexed; a failed one leaves the old version and shows the reason in `replacement`.
   */
  replaceDocument: defineEndpoint({
    method: 'put',
    path: '/api/v1/knowledge/documents/{documentId}/file',
    params: z.object({ documentId: z.number().int() }),
    encoding: 'multipart',
    body: ReplaceDocumentCommandSchema,
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
