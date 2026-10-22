# Implementation Plan: AI assistant with local RAG ("Trợ lý AI")

Spec: [SPEC.md](../SPEC.md) (capability map, decisions D1–D8) and the seven module specs beside it.
Architecture (Vietnamese): [docs/architecture/ai-assistant-rag.html](../docs/architecture/ai-assistant-rag.html).
Tasks: [todo.md](todo.md). Run `nvm use` (Node 24) before npm/nx commands.

Phase 0 (specs + architecture) is approved and committed. The user asked for Phases 1–5 in one
pass: no stop between phases, one commit per task (or per tightly coupled pair), checks green
before each commit.

## Overview

Every signed-in user uploads `.pdf`/`.md`/`.docx` into one shared knowledge base and asks questions
answered by a local model (Ollama `qwen3:8b`, embeddings `bge-m3`) from retrieved chunks only, with
file/page/line citations. Processing runs in the background (the `knowledge_documents` table is the
queue); an owl in the app shell shows progress.

Two repos, both on branch `feat/ai-assistant-rag`:

- Backend `/Users/nguyenhien/my-projects/corebanking-academy` (Spring Boot 3.5, Java 21, Maven).
- Frontend: this worktree (Angular 22, Nx, zod, signals).

## Dependency graph

```
Phase 0  local environment (pgvector DB, Ollama, .env)            ← unblocks every IT
   │
Phase 1  B1 kb-storage ─ SQL, config, entity, OllamaClient
            │
            B2 kb-ingestion ─ extractors, chunker, upload API, worker
   │
Phase 2  B3 kb-chat ─ chunk search, prompt, service, NDJSON endpoint
   │
Phase 3  F1 kb-contracts ─ schemas, endpoints, ndjson transport, fixtures, FakeBackend
            │
            F2 doc-tracker ─ root store (poll, finish, notice)
            │
            F3 assistant-screen ─ route, store, components
   │
Phase 4  F4 owl-indicator ─ shell component driven by tracker
   │
Phase 5  E2E ─ real upload of 3 files, grounded Q&A, not-found, second role, screenshots
```

## Architecture decisions (from SPEC.md, do not re-litigate)

- Local only (D1); documents table is the queue with `FOR UPDATE SKIP LOCKED` (D2); function
  `AI_ASSISTANT` for every role (D3); owl chews while processing, smiles once on done (D4);
  PDFBox 3 + POI + `RestClient` + Testcontainers only (D5); NDJSON over `fetch` (D6); every
  signed-in user may upload, no delete, 20 MB (D7).
- Citations are built from chunk metadata, never parsed from model text.
- Business rules (status, retrieval, relevance) stay on the server; the app renders results.

## Phases and checkpoints

| Phase | Tasks | Gate before commit |
| ----- | ----- | ------------------ |
| 0 | local environment | `docker ps` pgvector healthy, `ollama list` has both models, SQL loaded |
| 1 | B1, B2 | `mvn clean verify` green; manual upload of three types ends `ready` |
| 2 | B3 | `mvn clean verify` green; manual grounded answer + not-found; time to first token recorded |
| 3 | F1, F2, F3 | `npm run check` green; angular.md §14; visual-design checklist; migration verify step; browser pass at 375/1280 light/dark |
| 4 | F4 | same frontend gates; keyboard + reduced-motion pass |
| 5 | E2E | success criteria 1–5 of SPEC.md with screenshots |

## Risks and mitigations

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| `qwen3:8b` ignores "answer only from context" or the not-found sentence | Wrong answers | Threshold gate before the model; exact-sentence check; tune `min-similarity` with measurements; temperature 0.1 |
| Testcontainers needs Docker | ITs cannot run | Docker Desktop running; verified before Phase 1 |
| `ddl-auto=validate` vs `vector` column | App fails to start | Entity `KnowledgeDocument` only; chunks via `JdbcTemplate` |
| Angular `partialText` streaming support (D6) | No incremental text | Verify in F1 with a spec and in the browser; fall back to a documented change if not available |
| Long LLM calls and DB transactions | Pool starvation | No remote call inside a transaction (claim → process → finish) |
| Shared worktree for frontend while other sessions edit | Commit pollution | Stage only files of the task |

## Parallelization

None: backend phases feed the frontend contracts, and each frontend task builds on the previous one.

## Open questions

None blocking. Tuning values (chunk size, top-k, threshold, poll interval) may change with
measurements; any change updates the spec and the HTML.
