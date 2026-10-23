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

export const KnowledgeDocumentSchema = z.object({
  id: z.number().int(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
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

export const UploadDocumentCommandSchema = z.object({ file: z.file() });
export type UploadDocumentCommand = z.infer<typeof UploadDocumentCommandSchema>;

/** One question; the backend answers each on its own and keeps no conversation. */
export const MAX_QUESTION_LENGTH = 300;
export const AskCommandSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
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
  z.object({ type: z.literal('retrieved'), count: z.number().int() }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('done'),
    found: z.boolean(),
    citations: z.array(CitationSchema),
  }),
  z.object({
    type: z.literal('error'),
    messageCode: z.string(),
    message: z.string(),
  }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
