# Spec: `kb-contracts` (frontend, Phase 3)

Map: [SPEC.md](SPEC.md). Mirrors the backend contract in [SPEC-kb-ingestion.md](SPEC-kb-ingestion.md) and
[SPEC-kb-chat.md](SPEC-kb-chat.md). Read `docs/conventions/contracts-and-mocks.md` first.

## Objective

Every knowledge endpoint has one zod schema and one registry entry; every response, stream events
included, is parsed by its schema; the app can stream an answer through `EndpointClient` without a direct
`HttpClient` call; the menu knows `AI_ASSISTANT`.

## Schemas (`libs/contracts/src/lib/knowledge/knowledge.schema.ts`)

```ts
export const DocumentStatusSchema = z.enum(['queued', 'processing', 'ready', 'failed']);

export const KnowledgeDocumentSchema = z.object({
  id: z.number().int(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  status: DocumentStatusSchema,
  errorMessage: z.string().nullable(),
  pageCount: z.number().int().nullable(),
  chunkCount: z.number().int(),
  uploadedBy: z.object({ userId: z.string(), fullName: z.string() }),
  createdAt: z.iso.datetime(),
  processedAt: z.iso.datetime().nullable(),
});
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

export const DocumentListQuerySchema = z.object({
  page: z.number().int().min(0).optional(),
  size: z.number().int().min(1).max(100).optional(),
  mine: z.boolean().optional(),
  status: z.array(DocumentStatusSchema).optional(),
});
export const UploadDocumentCommandSchema = z.object({ file: z.file() });
export const AskCommandSchema = z.object({ question: z.string().trim().min(1).max(300) });

export const CitationSchema = z.object({
  n: z.number().int().positive(),
  documentId: z.number().int(),
  fileName: z.string(),
  page: z.number().int().nullable(),
  lineStart: z.number().int(),
  lineEnd: z.number().int(),
  snippet: z.string(),
});
export const ChatAnswerSchema = z.object({
  answer: z.string(),
  found: z.boolean(),
  citations: z.array(CitationSchema),
});
export const ChatStreamEventSchema = z.discriminatedUnion('type', [z.object({ type: z.literal('retrieved'), count: z.number().int() }), z.object({ type: z.literal('delta'), text: z.string() }), z.object({ type: z.literal('done'), found: z.boolean(), citations: z.array(CitationSchema) }), z.object({ type: z.literal('error'), messageCode: z.string(), message: z.string() })]);
```

No UI copy in contracts: status labels ("Đang chờ", "Đang xử lý", "Sẵn sàng", "Không xử lý được") live
in the app.

## Endpoints (`knowledge.endpoints.ts`; header: mockup `src/api/learner.js` → `ask`)

| Key              | Method + path                                  | Notes                                                                   |
| ---------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `documents`      | `get /api/v1/knowledge/documents`              | `query: DocumentListQuerySchema`, `PageSchema(KnowledgeDocumentSchema)` |
| `document`       | `get /api/v1/knowledge/documents/{documentId}` | `params`                                                                |
| `uploadDocument` | `post /api/v1/knowledge/documents`             | `encoding: 'multipart'`                                                 |
| `ask`            | `post /api/v1/knowledge/chat`                  | mockup key; JSON answer (specs, fallback)                               |
| `askStream`      | `post /api/v1/knowledge/chat/stream`           | `responseType: 'ndjson'`, `response: ChatStreamEventSchema`             |

All are `served: 'backend'` (the backend has them by Phase 3, so nothing is mock-only).

## New transport: `responseType: 'ndjson'` (contracts-and-mocks.md → extension rule)

- `endpoint.ts`: `ResponseKind` gains `'ndjson'`; for it the `response` schema describes **one event**.
- `EndpointClient.stream(endpoint, input): Observable<z.output<Response>>` (only for `ndjson`
  endpoints; `call` rejects them at the type level). It sends the request with
  `observe: 'events', reportProgress: true, responseType: 'text'`, reads `DownloadProgress.partialText`,
  splits on `\n` from the last offset, parses each complete line with `JSON.parse` + the event schema
  (a mismatch is a `ContractError`, as for `call`), and emits each event. The final `HttpResponse` flushes
  a trailing line. Unsubscribing aborts the fetch (the "Dừng" button).
- A refusal before streaming arrives as a JSON envelope (`Content-Type: application/json`):
  `envelopeInterceptor` keeps handling it (it throws `ApiError` for `status: 'ERROR'`); for
  `application/x-ndjson` it passes the response through untouched, like `blob`.
- Specs in `endpoint-client.spec.ts`: lines split across chunks, several lines in one chunk, trailing line
  without `\n`, schema mismatch, envelope refusal, abort on unsubscribe.

## Menu code

`FunctionCodeSchema` (`identity.schema.ts`) gains `'AI_ASSISTANT'` in the same commit as the screen table
change (an unknown code from `/me` would fail the parse). Fixtures of `/me` in `@lms/mocks` grant it to
every seeded role, like the backend seed.

## Fixtures (`libs/mocks/src/lib/knowledge/knowledge.fixtures.ts`)

Three documents of different uploaders and types (`ready` PDF, `processing` DOCX, `failed` MD with its
message), an answer with two citations (one PDF with page, one MD), the not-found answer, and a stream
script (`retrieved`, five `delta`s, `done`). `FakeBackend` answers the five endpoints so
`mockBackend: true` runs offline: an upload is `queued`, then `processing` on the next list call, then
`ready`; `askStream` replays the script, or the not-found script when the question contains "không có".

## Commands

`npx nx test contracts mocks lms` · `npm run check`

## Boundaries

- Always: types from `z.infer`; parse every event.
- Never: a direct `HttpClient` call in a store; `z.any()`; labels in contracts.

## Success criteria

Contract done criteria pass (schemas, endpoints with doc comments, fixtures parse, `npm start` shows the
endpoints answering); the stream specs above pass.
