# Tasks: AI assistant with local RAG

Spec: [SPEC.md](../SPEC.md) · Plan: [plan.md](plan.md). Backend repo: `corebanking-academy`
(`BE`), frontend: this repo (`FE`). Both on `feat/ai-assistant-rag`. One commit per task.

## Phase 0: local environment

- [x] **T0 Local stack** (BE + machine). Compose image → `pgvector/pgvector:pg16`; `.env` backed up and
      `DB_URL` pointed at the local DB; identity + learning SQL loaded; Ollama serving with both models.
      Verify: `psql` lists `learning_hub.users`; `curl localhost:11434/api/version`.

## Phase 1: backend storage and ingestion

- [x] **T1 kb-storage** (BE). `learning_hub_knowledge.sql`, `AI_ASSISTANT` seed + README, `KnowledgeProperties`,
      `KnowledgeDocument` entity + repository, `DocumentChunkRepository` (JdbcTemplate), `OllamaClient`,
      Testcontainers dependency, `KnowledgeSchemaIT`, `OllamaClientTest`.
      Verify: `mvn clean verify`; SQL loads into the local DB; `/auth/me` lists `AI_ASSISTANT` for every role.
- [x] **T2 kb-ingestion: extraction + chunking** (BE). `TextLine`, `FileTypeDetector`, the three extractors,
      `Chunker`, `TokenEstimator` with their unit tests (PDFBox 3 + POI dependencies).
      Verify: `mvn test`.
- [x] **T3 kb-ingestion: API + worker** (BE). `KnowledgeResponseCode`, views, upload/list/get service and
      controller, `DocumentIngestionWorker`, `DocumentProcessor`, scheduling config, `DocumentIngestionIT`,
      `KnowledgeDocumentControllerTest`, `docs/api/KNOWLEDGE.md`, Postman.
      Verify: `mvn clean verify`; manual upload of a PDF, `.md` and `.docx` ends `ready`; bad file refused.

## Phase 2: backend chat

- [x] **T4 kb-chat** (BE). `DocumentChunkRepository.search`, prompt builder, `KnowledgeChatService`,
      `/chat` and `/chat/stream`, tests, API doc + Postman.
      Verify: `mvn clean verify`; manual grounded answer with citations, not-found sentence, time to first token.

## Phase 3: frontend contracts, tracker, screen

- [x] **T5 kb-contracts** (FE). Schemas, endpoint registry, `ndjson` transport in `EndpointClient`, envelope
      interceptor pass-through, `AI_ASSISTANT` code, fixtures, `FakeBackend`, `LMS_API_TARGET` proxy.
      Verify: `npx nx test contracts mocks lms`.
- [x] **T6 doc-tracker** (FE). `DocumentTrackerStore` + spec.
      Verify: `npx nx test lms`.
- [x] **T7 assistant-screen** (FE). Route + menu group, store, six components, specs, migration registry.
      Verify: `npm run check`; browser pass 375/1280 light/dark; keyboard; each error state; angular.md §14;
      visual-design checklist; migration verify step.

## Phase 4: owl

- [ ] **T8 owl-indicator** (FE). `app-owl` in the shell, SVG poses, bubble, live region, reduced motion, spec.
      Verify: `npm run check`; browser pass (palettes, light/dark, 375/1280); keyboard.

## Phase 5: end-to-end

- [ ] **T9 E2E** (both). Real run as `giangvien` (three uploads, owl, cited answer, not-found), then as `hocvien`;
      screenshots; spec/HTML updates for anything that changed; final report.
