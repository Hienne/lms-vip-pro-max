import { z } from 'zod';

// The knowledge base of the "Trợ lý AI" (CORE Academy API, /api/v1/knowledge). Status labels
// ("Đang chờ", "Sẵn sàng", ...) are UI copy and live in the app, not here.

/** `queued` → `processing` → `ready` (searchable) or `failed` (with `errorMessage`). */
export const DocumentStatusSchema = z.enum([
  'queued',
  'processing',
  'ready',
  'failed',
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

/**
 * Who finds a document: `personal` only its uploader, `unit` the uploader's unit and its child
 * units, `global` everyone. Only admins may upload `global`.
 */
export const DocumentScopeSchema = z.enum(['personal', 'unit', 'global']);
export type DocumentScope = z.infer<typeof DocumentScopeSchema>;

export const KnowledgeDocumentSchema = z.object({
  id: z.number().int(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  /** Documents saved before scopes existed are `global`, which is also what an older server implies. */
  scope: DocumentScopeSchema.default('global'),
  /** The unit of a `unit` document; null otherwise. */
  scopeOrgId: z.number().int().nullish(),
  status: DocumentStatusSchema,
  errorMessage: z.string().nullable(),
  pageCount: z.number().int().nullable(),
  chunkCount: z.number().int().nonnegative(),
  uploadedBy: z.object({ userId: z.string(), fullName: z.string() }),
  createdAt: z.iso.datetime(),
  processedAt: z.iso.datetime().nullable(),
});
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

/** `status` repeats the key (`?status=queued&status=processing`); `mine` keeps the caller's own. */
export const DocumentListQuerySchema = z.object({
  page: z.number().int().min(0).optional(),
  size: z.number().int().min(1).max(100).optional(),
  mine: z.boolean().optional(),
  status: z.array(DocumentStatusSchema).optional(),
});
export type DocumentListQuery = z.infer<typeof DocumentListQuerySchema>;

/** `scope` defaults to `unit` on the server when left out. */
export const UploadDocumentCommandSchema = z.object({
  file: z.file(),
  scope: DocumentScopeSchema.optional(),
});
export type UploadDocumentCommand = z.infer<typeof UploadDocumentCommandSchema>;

/** One question; `conversationId` (stream only) names the conversation it continues. */
export const MAX_QUESTION_LENGTH = 300;
export const AskCommandSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  conversationId: z.number().int().positive().nullish(),
});
export type AskCommand = z.infer<typeof AskCommandSchema>;

/** Built by the backend from the chunk's metadata, never read out of the model's text. */
export const CitationSchema = z.object({
  n: z.number().int().positive(),
  documentId: z.number().int(),
  fileName: z.string(),
  /** Null for `.md` and `.docx`, which have no pages. */
  page: z.number().int().nullable(),
  lineStart: z.number().int(),
  lineEnd: z.number().int(),
  snippet: z.string(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const ChatAnswerSchema = z.object({
  answer: z.string(),
  found: z.boolean(),
  citations: z.array(CitationSchema),
});
export type ChatAnswer = z.infer<typeof ChatAnswerSchema>;

/** One line of the NDJSON stream. */
export const ChatStreamEventSchema = z.discriminatedUnion('type', [
  /** The first line of every stream: the conversation this turn is stored in. */
  z.object({
    type: z.literal('conversation'),
    conversationId: z.number().int().positive(),
  }),
  z.object({ type: z.literal('retrieved'), count: z.number().int() }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('done'),
    found: z.boolean(),
    /** The final text: what the deltas added up to, or the fixed sentence when nothing was found. */
    answer: z.string(),
    citations: z.array(CitationSchema),
    /** The stored turn, which the user may rate; absent when the server could not store it. */
    turnId: z.number().int().positive().optional(),
    /** Up to three follow-up questions; absent when the model offered none. */
    suggestions: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('error'),
    messageCode: z.string(),
    message: z.string(),
  }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
