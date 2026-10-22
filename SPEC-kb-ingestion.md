# Spec: `kb-ingestion` (backend, Phase 1)

Map: [SPEC.md](SPEC.md). Builds on [SPEC-kb-storage.md](SPEC-kb-storage.md).

## Objective

A signed-in user uploads a `.pdf`, `.md` or `.docx`; the request returns at once with `status: queued`;
a background worker extracts the text with page and line numbers, chunks it, embeds it with `bge-m3` and
stores it; the document ends `ready` or `failed` with a readable Vietnamese message. Clients poll status.

## API (`/api/v1/knowledge`, all `BaseResponse`, every signed-in user)

| Method | Path                      | Request                                   | Success `data`               | Refusals (HTTP 200 `ERROR` unless noted)                                                     |
| ------ | ------------------------- | ----------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| POST   | `/documents`              | multipart `file`                          | `KnowledgeDocumentView`, 201 | `KNOWLEDGE-FILE_TYPE_UNSUPPORTED`, `KNOWLEDGE-FILE_INVALID`, `KNOWLEDGE-FILE_TOO_LARGE`; 401 |
| GET    | `/documents`              | `page`, `size` (≤100), `mine`, `status`\* | `PageResponse<…View>`        | `CORE-VALIDATION_FAILED`; 401                                                                |
| GET    | `/documents/{documentId}` | —                                         | `KnowledgeDocumentView`      | `CORE-RESOURCE_NOT_FOUND`; 401                                                               |

`status` repeats (`?status=queued&status=processing`). `mine=true` keeps the caller's uploads (the owl's
poll). Sorted by `create_time` desc.

```json
{
  "id": 42,
  "fileName": "Quy-trinh-EOD.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 812345,
  "status": "processing",
  "errorMessage": null,
  "pageCount": 12,
  "chunkCount": 0,
  "uploadedBy": { "userId": "000005", "fullName": "Giảng viên Demo" },
  "createdAt": "2026-10-22T08:00:00Z",
  "processedAt": null
}
```

`uploadedBy.fullName` comes from `users` in one batch per page. New `KnowledgeResponseCode`:

| Code                              | Message                                                   | Title                    |
| --------------------------------- | --------------------------------------------------------- | ------------------------ |
| `KNOWLEDGE-FILE_TYPE_UNSUPPORTED` | Chỉ hỗ trợ tệp .pdf, .md hoặc .docx.                      | Loại tệp không hỗ trợ    |
| `KNOWLEDGE-FILE_INVALID`          | Tệp rỗng, bị hỏng hoặc nội dung không khớp với loại tệp.  | Tệp không hợp lệ         |
| `KNOWLEDGE-FILE_TOO_LARGE`        | Tệp vượt quá dung lượng tối đa 20 MB.                     | Tệp quá lớn              |
| `KNOWLEDGE-AI_UNAVAILABLE`        | Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại sau. | Dịch vụ AI chưa sẵn sàng |

(The size in the message is built from `max-file-size`.) The contract goes in `docs/api/KNOWLEDGE.md` and
Swagger annotations, per the backend's API rules.

## Upload checks (synchronous, before anything is queued)

1. Extension, case-insensitive: `.pdf`, `.md`, `.docx`, else `FILE_TYPE_UNSUPPORTED`.
2. Size: 1 byte to `max-file-size`, else `FILE_INVALID` (empty) or `FILE_TOO_LARGE`.
3. Declared MIME must be in the extension's allow-list or be empty / `application/octet-stream`
   (browsers often send nothing for `.md`): PDF `application/pdf`; DOCX
   `application/vnd.openxmlformats-officedocument.wordprocessingml.document`; MD `text/markdown`,
   `text/x-markdown`, `text/plain`. Else `FILE_INVALID`.
4. Magic bytes: PDF starts with `%PDF-`; DOCX starts with `PK\x03\x04` and the zip has
   `word/document.xml`; MD decodes as strict UTF-8 with no NUL byte. Else `FILE_INVALID`.
5. Store the bytes under `storage-dir/<uuid>` outside the transaction, then insert the row (`queued`) and
   an audit record `KNOWLEDGE_DOCUMENT_UPLOADED` in one transaction; on failure delete the file (same
   pattern as `LearningAssetService`). `mime_type` is the detected type.

## Worker (D2)

- `@EnableScheduling` in a `knowledge.config` class. `DocumentIngestionWorker.poll()` runs every
  `poll-interval` while the executor has a free slot (`concurrency`, default 1).
- Before claiming: `ollama.isAvailable()`; when false, skip the cycle (documents stay `queued`).
- Claim, in its own short transaction:

  ```sql
  UPDATE learning_hub.knowledge_documents d
     SET status = 'processing', started_at = now(), attempts = d.attempts + 1
   WHERE d.document_id = (SELECT document_id FROM learning_hub.knowledge_documents
                           WHERE status = 'queued' ORDER BY create_time
                           FOR UPDATE SKIP LOCKED LIMIT 1)
  RETURNING d.document_id
  ```

- Process outside any transaction: extract → chunk → embed (batches of 16).
- Finish in one transaction: insert all chunks, set `ready`, `chunk_count`, `page_count`, `processed_at`.
- Outcomes:

  | Cause                                        | Result                                                                                                   |
  | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
  | `OllamaUnavailableException`, attempts < max | back to `queued` (retried on a later cycle)                                                              |
  | `OllamaUnavailableException`, attempts = max | `failed`: "Không kết nối được dịch vụ AI sau 3 lần thử. Vui lòng tải lại tệp sau."                       |
  | PDF unreadable or encrypted                  | `failed`: "Không đọc được nội dung PDF. Tệp có thể bị hỏng hoặc được đặt mật khẩu."                      |
  | PDF without a text layer                     | `failed`: "PDF không có lớp văn bản (có thể là bản scan). Hệ thống chưa hỗ trợ nhận dạng chữ."           |
  | No text at all                               | `failed`: "Tài liệu không có nội dung văn bản."                                                          |
  | Any other exception                          | `failed`: "Không xử lý được tài liệu. Vui lòng thử lại hoặc liên hệ quản trị." (logged with document id) |

- At startup (`ApplicationReadyEvent`) rows in `processing` go back to `queued`.
- The worker never reads the security context: it acts on a row. Its log lines carry the document id
  (guideline: jobs get no implicit user).

## Extraction (`knowledge.extraction`) → `List<TextLine(Integer page, int line, String text)>`

| Type | Library                                                                    | Page         | Line                                                                                                                                                                      |
| ---- | -------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF  | PDFBox 3 `PDFTextStripper`, one page at a time (`setSortByPosition(true)`) | 1-based page | 1-based within the page, every output line counted (blank ones too)                                                                                                       |
| MD   | none (strict UTF-8)                                                        | `null`       | the file's line, 1-based, blank lines counted; `\r\n` and `\n` both end a line                                                                                            |
| DOCX | POI `XWPFDocument`, body elements in order                                 | `null`       | each paragraph is one line (soft breaks become spaces); each table row is one line, cells joined with `\|`; empty paragraphs counted; headers, footers, footnotes skipped |

A PDF whose pages yield fewer than 20 non-space characters in total has no text layer.

## Chunking (`knowledge.chunking.Chunker`)

- Token estimate: `ceil(chars / 3)` (conservative for Vietnamese with the XLM-R tokenizer of bge-m3).
- Walk the lines, skipping blank ones for content but keeping their numbers; close the chunk as soon as it
  reaches `target-tokens` (600), before a line that would push it past `max-tokens` (800), and at a PDF
  page break (a chunk never spans pages, so it has one `page`).
- Overlap: the next chunk starts with the last whole lines of the previous one that fit in
  `overlap-tokens` (80), on the same page only.
- A single line longer than `max-tokens` is split on whitespace into several chunks with the same
  `line_start = line_end`.
- Each chunk keeps `line_start` / `line_end` of its first and last non-blank line.

The architecture HTML §7 runs this algorithm on a worked example (scaled-down limits so it fits on screen)
and shows each chunk's page and line range.

## Project structure

```text
knowledge/
├── controller/  KnowledgeDocumentController
├── service/     KnowledgeDocumentService (upload, list, get), DocumentIngestionWorker, DocumentProcessor
├── extraction/  TextLine, FileTypeDetector, PdfTextExtractor, MarkdownTextExtractor, DocxTextExtractor,
│                ExtractionException (carries the Vietnamese message)
├── chunking/    Chunker, Chunk, TokenEstimator
├── dto/         KnowledgeViews (records), KnowledgeRequests
├── exception/   KnowledgeResponseCode
└── config/      KnowledgeSchedulingConfig (scheduling + bounded ThreadPoolTaskExecutor)
pom.xml: org.apache.pdfbox:pdfbox 3.x, org.apache.poi:poi-ooxml 5.x,
         test: org.springframework.boot:spring-boot-testcontainers, org.testcontainers:postgresql, junit-jupiter
docs/api/KNOWLEDGE.md, docs/postman (requests for the three endpoints)
```

## Code style

```java
public record TextLine(Integer page, int line, String text) {
}

// Step 1: reject wrong type or size before writing to disk; never trust the browser's MIME type.
FileTypeDetector.Detected detected = detector.detect(file);
```

New code comments are English (the user's instruction outranks the backend's Vietnamese habit); existing
comments stay as they are. Messages to users are Vietnamese.

## Testing (requested explicitly by the user, so new test files are allowed)

- `MarkdownTextExtractorTest`, `PdfTextExtractorTest`, `DocxTextExtractorTest`: build the input inside the
  test (PDFBox writes a 2-page PDF, POI writes a DOCX with paragraphs and a table) and assert page and line
  numbers line by line; scan-like PDF (an image only) → the no-text-layer message.
- `FileTypeDetectorTest`: each extension, a PDF renamed `.docx`, a zip that is not DOCX, binary `.md`,
  empty file, oversize, wrong declared MIME.
- `ChunkerTest`: boundaries on lines, 600/800 limits, overlap, page breaks, one very long line.
- `DocumentIngestionIT` (Testcontainers, `OllamaClient` as `@MockitoBean` returning fixed vectors):
  `queued → processing → ready` with chunks stored; extraction failure → `failed` + message; Ollama down →
  back to `queued`, `attempts` grows, `failed` after 3; stale `processing` re-queued at startup; two
  workers never claim the same row.
- `KnowledgeDocumentControllerTest` (MockMvc): 201 envelope, each refusal code, 401 without token, `mine`
  and `status` filters.

## Boundaries

- Always: the request never waits on the model; one transaction for "chunks + ready".
- Ask first: retries beyond `max-attempts`, a re-process endpoint, OCR.
- Never: keep a document readable by search before it is `ready`; log document text.

## Success criteria

`mvn clean verify` green with the tests above; manual: uploading the three types locally ends `ready`
with sensible `chunk_count`, and a bad file is refused at once with the right code.
