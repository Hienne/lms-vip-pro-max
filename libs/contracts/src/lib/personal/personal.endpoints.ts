/** Proposed FE integration contract, from mockup src/api/learner.js. Not verified with Java. */
import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageQuerySchema, PageSchema } from '../http/page';
import {
  AddNoteCommandSchema,
  BookmarkCommandSchema,
  CertificateSchema,
  SavedItemSchema,
  SavedPageSchema,
} from './personal.schema';
const certificateParams = z.object({ certificateId: z.string() });
export const personalEndpoints = {
  /** List the selected personal saved tab. */
  saved: defineEndpoint({
    method: 'get',
    path: '/api/me/saved',
    query: PageQuerySchema.extend({ type: z.enum(['notes', 'bookmarks']) }),
    response: SavedPageSchema,
    served: 'mock',
  }),
  /** Add a private note at a document or video position. */
  addNote: defineEndpoint({
    method: 'post',
    path: '/api/me/notes',
    body: AddNoteCommandSchema,
    response: SavedItemSchema,
    served: 'mock',
  }),
  /** Delete the caller's note. */
  deleteNote: defineEndpoint({
    method: 'delete',
    path: '/api/me/notes/{noteId}',
    params: z.object({ noteId: z.string() }),
    response: z.object({ deleted: z.literal(true) }),
    served: 'mock',
  }),
  /** Save an anchor idempotently. */
  toggleBookmark: defineEndpoint({
    method: 'put',
    path: '/api/me/bookmarks',
    body: BookmarkCommandSchema,
    response: z.object({ saved: z.literal(true), item: SavedItemSchema }),
    served: 'mock',
  }),
  /** Remove a bookmark. */
  deleteBookmark: defineEndpoint({
    method: 'delete',
    path: '/api/me/bookmarks/{bookmarkId}',
    params: z.object({ bookmarkId: z.string() }),
    response: z.object({ saved: z.literal(false), id: z.string() }),
    served: 'mock',
  }),
  /** List certificates already issued by the server. */
  certificates: defineEndpoint({
    method: 'get',
    path: '/api/me/certificates',
    query: PageQuerySchema,
    response: PageSchema(CertificateSchema),
    served: 'mock',
  }),
  /** Retrieve issued metadata. */
  certificate: defineEndpoint({
    method: 'get',
    path: '/api/me/certificates/{certificateId}',
    params: certificateParams,
    response: CertificateSchema,
    served: 'mock',
  }),
  /** Download the API-issued PDF. Mock response is explicitly a demo document. */
  downloadCertificate: defineEndpoint({
    method: 'get',
    path: '/api/me/certificates/{certificateId}/download',
    params: certificateParams,
    responseType: 'blob',
    response: z.instanceof(Blob),
    served: 'mock',
  }),
} as const;
