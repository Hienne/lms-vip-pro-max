# Capability map: AI assistant with local RAG ("Trợ lý AI")

Status: **map approved 2026-10-22; module specs in Phase 0 review.** Replaces the shipped custom-theme
spec (still in git history, PR #34).

The visual architecture of this initiative, in Vietnamese, is
[`docs/architecture/ai-assistant-rag.html`](docs/architecture/ai-assistant-rag.html). When the HTML and a
spec disagree, the spec wins and the HTML is fixed.

## Objective

Every signed-in user, in any role, can upload `.pdf`, `.md` and `.docx` documents into **one shared
knowledge base** and ask questions about them. Answers come from a local model (Ollama on this machine),
use only the uploaded documents, and cite file, page and line range. Processing is slow, so it runs in the
background while the user keeps working; a small owl in the corner of the app shows its progress.

This is a proof of concept that runs entirely on one machine.

## Modules

| Module id          | Repo                  | Responsibility                                                                                            | Depends on                    | Spec                                                 |
| ------------------ | --------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| `kb-storage`       | `corebanking-academy` | SQL (`vector`, `documents`, `document_chunks`), `AI_ASSISTANT` function, entity, settings, Ollama client  | —                             | [SPEC-kb-storage.md](SPEC-kb-storage.md)             |
| `kb-ingestion`     | `corebanking-academy` | Upload checks, DB-backed job queue and worker, extraction with page/line, chunking, embedding, status API | `kb-storage`                  | [SPEC-kb-ingestion.md](SPEC-kb-ingestion.md)         |
| `kb-chat`          | `corebanking-academy` | Question embedding, top-k vector search, grounded prompt to `qwen3:8b`, answer + citations, NDJSON stream | `kb-storage`                  | [SPEC-kb-chat.md](SPEC-kb-chat.md)                   |
| `kb-contracts`     | this repo             | zod schemas, endpoint registry, fixtures, `EndpointClient` stream transport, menu code `AI_ASSISTANT`     | `kb-ingestion`, `kb-chat`     | [SPEC-kb-contracts.md](SPEC-kb-contracts.md)         |
| `doc-tracker`      | this repo             | App-level store that polls the signed-in user's pending uploads and reports each finish                   | `kb-contracts`                | [SPEC-doc-tracker.md](SPEC-doc-tracker.md)           |
| `assistant-screen` | this repo             | `/assistant` route: upload, shared document list, chat with expandable citations                          | `kb-contracts`, `doc-tracker` | [SPEC-assistant-screen.md](SPEC-assistant-screen.md) |
| `owl-indicator`    | this repo             | Owl fixed bottom-right in the app shell, driven by `doc-tracker`                                          | `doc-tracker`                 | [SPEC-owl-indicator.md](SPEC-owl-indicator.md)       |

Build order (one phase at a time, each ends with checks, a commit and a stop for approval):

| Phase | Modules                                                 |
| ----- | ------------------------------------------------------- |
| 0     | this map, the seven module specs, the architecture HTML |
| 1     | `kb-storage` → `kb-ingestion`                           |
| 2     | `kb-chat`                                               |
| 3     | `kb-contracts` → `doc-tracker` → `assistant-screen`     |
| 4     | `owl-indicator`                                         |
| 5     | end-to-end verification                                 |

## Decisions (approved 2026-10-22)

| #   | Decision                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Local only.** Postgres in Docker from `pgvector/pgvector:pg16` (the backend's `compose.yaml` image changes from `postgres:16-alpine`), loaded with the identity, learning and new knowledge SQL. Backend on `localhost:8019`. The FE dev proxy target becomes configurable (`LMS_API_TARGET`, default unchanged). |
| D2  | **The `documents` table is the queue.** A `@Scheduled` poller claims `queued` rows with `FOR UPDATE SKIP LOCKED` and runs them on a bounded executor (1 worker by default). Rows left in `processing` at startup are re-queued. No broker, no new infrastructure.                                                   |
| D3  | **New function `AI_ASSISTANT`** (route `/assistant`) added to the identity seed and granted to every role. `/assistant` moves from the FE `open` screens to a menu group.                                                                                                                                           |
| D4  | **Owl motion:** idle is still, processing chews in a loop (a state indicator, like a spinner), done smiles once. No idle blink.                                                                                                                                                                                     |
| D5  | **Backend libraries:** Apache PDFBox 3 (PDF), Apache POI `poi-ooxml` (DOCX), Spring `RestClient` for Ollama (no Spring AI), Testcontainers (`postgresql` module, image `pgvector/pgvector:pg16`) for persistence tests. Versions come from the Spring Boot BOM where it manages them.                               |
| D6  | **Streaming:** NDJSON over `fetch` (`application/x-ndjson`), not browser SSE. Angular's `FetchBackend` (22.2) emits `DownloadProgress.partialText` for `responseType: 'text'` with `reportProgress`, which `EndpointClient` reads line by line.                                                                     |
| D7  | Every signed-in user may upload. Deleting documents is out of scope. One size limit: 20 MB per file.                                                                                                                                                                                                                |
| D8  | This file is the map; each module has `SPEC-<module>.md` beside it.                                                                                                                                                                                                                                                 |

## Assumptions

- PDF line numbers restart at 1 on each page, in the order PDFBox extracts the text.
- DOCX has no pages: `page` is null and each paragraph or table row is one line (shown as "đoạn").
- Markdown lines are the file's own lines, 1-based.
- A PDF with no text layer (a scan) fails with a readable message; OCR is out of scope.
- The owl follows only the signed-in user's own uploads; the document list shows everyone's.
- Tokens are estimated from characters (no bge-m3 tokenizer in Java).
- `qwen3:8b` is called with `think: false`; installed tags verified on disk: `qwen3:8b`, `bge-m3:latest`.
- Chat is single-turn: each question is answered on its own; the conversation lives in the browser only.
- Backend branch `feat/ai-assistant-rag` from `main`; this repo's branch `feat/ai-assistant-rag`.

## Out of scope

OCR; deleting, renaming or re-processing documents; per-user or per-unit document visibility; multi-turn
memory; the mockup's lesson-tab assistant, "Tóm tắt bài này" and "Tạo 3 câu ôn tập"; cloud models;
production deployment; rate limiting.

## Boundaries (whole initiative)

- **Always:** one phase at a time, ending with its checks, a commit and a stop; this repo follows
  `AGENTS.md` and its docs; the backend follows its `AGENTS.md` and `DEVELOPMENT_GUIDELINES.md`; UI copy and
  the architecture HTML in Vietnamese, code, comments and commits in English; Ollama URL and model names
  from configuration.
- **Ask first:** a cloud model; a separate vector database or message broker; any dependency beyond D5;
  changing the shared remote database or the remote backend; a change to the approved design (update the
  HTML and say so).
- **Never:** commit to `main`; commit `.env` or secrets; run SQL against `103.121.90.119`; let the model
  answer from outside the retrieved chunks; take a source from model text (its `[n]` markers only
  select among the retrieved chunks, see `SPEC-kb-chat.md`).

## Success criteria (Phase 5)

1. Signed in as `giangvien` / `Demo@123`, upload one PDF, one `.md` and one `.docx`: the owl chews while
   the user browses other pages, then smiles with "Đã xử lý xong tài liệu <tên tệp>".
2. A question answered in one document returns the right answer citing that file and the right line range
   (and page for the PDF).
3. A question not covered returns "Không tìm thấy thông tin này trong tài liệu." with no citations.
4. Signed in with another role (`hocvien`), the same documents are listed and searchable.
5. FE: `npm run check` green, angular.md §14, visual-design checklist and the migration verify step pass.
   BE: `mvn clean verify` green (Docker running for Testcontainers).

## Open questions

None blocking. Tuning values (chunk size, `topK`, similarity threshold, poll interval) are set in the
module specs and may change in Phase 1–2 with measurements; any change updates the spec and the HTML.
