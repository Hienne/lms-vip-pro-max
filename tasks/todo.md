# Tasks: AI chatbot with tool calls ("Trợ lý nhanh")

Spec: [SPEC.md](../SPEC.md) · Plan: [plan.md](plan.md). Backend repo `corebanking-academy` (`BE`, branch
`feat/ai-chatbot-agent`), frontend this repo (`FE`, branch `claude/ai-chatbot-tool-call-2fcf7a`). One commit per
task; stop at each checkpoint. BE paths are under `src/main/java/vn/com/coreacademy/` (`…/`) and
`src/test/java/vn/com/coreacademy/` (`test/…/`).

## Phase 0: local stack

- [x] **T0 Local stack up** (BE + machine) · XS
  - Do: start Docker Desktop; `docker compose up -d db` in the BE repo (the `core_academy_pg` volume from the RAG
    initiative keeps the data); create `feat/ai-chatbot-agent` from `main`; `mvn spring-boot:run` on :8019; FE with
    `LMS_API_TARGET=http://localhost:8019 npm start`.
  - Accept: DB healthy with `learning_hub` and the knowledge tables; backend health UP; Ollama lists `qwen3:8b` and
    `bge-m3`; signing in as `quantri` in the app works; `/assistant` answers a document question.
  - Verify: `docker ps`; `curl -s localhost:8019/actuator/health`; `ollama list`; browser.
  - Files: none committed (`.env` untouched unless `DB_URL` is wrong, and never committed).

## Phase 1: `agent-runtime` (BE)

- [x] **T1 Ollama tool calling** · S
  - Accept: `chatWithTools` sends `tools`, `stream:true`, `think:false`; streams content deltas; collects
    `tool_calls` split across lines; `error` line → `OllamaException`; refused connection →
    `OllamaUnavailableException`; `chat`/`chatStream` bodies unchanged.
  - Verify: `mvn test -Dtest=OllamaClientTest`.
  - Files: `…/knowledge/ai/OllamaClient.java`, `ChatMessage.java`, `ToolCall.java`, `ToolDefinition.java`,
    `ChatTurn.java`; `test/…/knowledge/ai/OllamaClientTest.java`.
  - Depends on: T0.
- [x] **T2 Prompt, tool definitions and the tool-choice eval** · M · _highest risk, fail fast_
  - Accept: `AgentPrompt` holds the spec's system prompt; the three tool definitions exist as data (no `run`);
    `AgentToolChoiceEval` runs the 20 prompts against the real model and prints tool chosen vs expected and time to
    first token. The `*Eval` name keeps it out of the default run: surefire only includes `*Test` and `*IT`, so
    `pom.xml` does not change.
  - Verify: `mvn test -Dtest=AgentToolChoiceEval`; hit rate ≥ 90% reported. Below that: stop and report (see plan's
    open questions). `mvn clean verify` does not run it.
  - Files: `…/assistant/agent/AgentPrompt.java`, `…/assistant/tool/ToolDefinitions.java`,
    `test/…/assistant/AgentToolChoiceEval.java`.
  - Depends on: T1.
- [x] **T3 Agent loop** · M
  - Accept: plain answer → `delta`… `done`; a read tool's result goes back and the second answer streams; terminal
    `Navigate`/`ActionRequired` → event, `done`, no second model call; unknown tool and bad arguments go back as
    text; step cap → fixed sentence; Ollama down mid-stream → `error`; tools not `availableTo` are not offered; a
    `TurnFinisher` shapes `done`.
  - Verify: `mvn test -Dtest=AgentServiceTest`.
  - Files: `…/assistant/agent/AgentService.java`, `AgentContext.java`, `ToolRegistry.java`;
    `…/assistant/tool/AgentTool.java`, `ToolOutcome.java`, `TurnState.java`, `TurnFinisher.java`,
    `ToolArguments.java`; `…/assistant/dto/AgentStreamEvent.java`; `…/assistant/config/AssistantProperties.java`;
    `…/assistant/exception/AssistantResponseCode.java`; `application.yml`; `test/…/assistant/AgentServiceTest.java`.
    (Many small records; one slice: the loop and the types it needs.)
  - Depends on: T2.
- [x] **T4 Pending actions** · S
  - Accept: confirm runs once under a race; another user's, an expired and a cancelled id are all
    `ACTION_NOT_FOUND`; the 21st action drops the oldest; the scheduled sweep removes expired entries.
  - Verify: `mvn test -Dtest=PendingActionStoreTest`.
  - Files: `…/assistant/action/PendingAction.java`, `PendingActionStore.java`,
    `…/assistant/config/AssistantSchedulingConfig.java`, `test/…/assistant/PendingActionStoreTest.java`.
  - Depends on: T3.
- [ ] **T5 Endpoints and API doc** · M
  - Accept: `/stream` returns NDJSON lines in order with `X-Accel-Buffering: no`; bad roles, empty list, last
    `assistant`, 501 characters → JSON `CORE-VALIDATION_FAILED`; probe false → `ASSISTANT-AI_UNAVAILABLE` envelope;
    401 without token; confirm and cancel envelopes; `docs/api/ASSISTANT.md` and Postman requests added.
  - Verify: `mvn clean verify`; `curl -N` with a test-profile stub tool shows `tool` before `delta`s.
  - Files: `…/assistant/controller/AgentController.java`, `AgentActionController.java`,
    `…/assistant/dto/AgentRequest.java`, `AgentMessage.java`, `PendingActionView.java`, `ActionResultView.java`,
    `test/…/assistant/AgentControllerTest.java`, `docs/api/ASSISTANT.md`, `docs/postman/…`.
  - Depends on: T3, T4.

### Checkpoint: Phase 1

- [ ] `mvn clean verify` green (Docker running)
- [ ] Eval hit rate and time to first token reported
- [ ] Stop for approval

## Phase 2: `agent-tools` (BE)

- [ ] **T6 Share chunk formatting and citation selection** · S
  - Accept: `ChatPromptBuilder.formatChunk` and `CitationSelector.select` extracted; `/knowledge/chat` output
    unchanged.
  - Verify: `mvn test -Dtest='KnowledgeChat*Test'` green unchanged.
  - Files: `…/knowledge/service/ChatPromptBuilder.java`, `CitationSelector.java`, `KnowledgeChatService.java`.
  - Depends on: Phase 1.
- [ ] **T7 `search_documents`** · S
  - Accept: numbering continues across calls in a turn and repeats keep their number; finisher rules (nothing
    retrieved → fixed sentence whatever the model wrote; not-found → no citations; marked chunks only, none marked →
    all); over-long query is a `Result`; AI unavailable → stream `error`.
  - Verify: `mvn test -Dtest=SearchDocumentsToolTest`; manual: "CIF là gì?" through `/stream` cites the right file.
  - Files: `…/assistant/tool/SearchDocumentsTool.java`, `RetrievedChunks.java`,
    `test/…/assistant/SearchDocumentsToolTest.java`.
  - Depends on: T6.
- [ ] **T8 `open_screen`** · S
  - Accept: enum and description list only the user's static routes; another role's code and an invented code →
    refusal `Result`, no `navigate`; no openable screen → not offered.
  - Verify: `mvn test -Dtest=OpenScreenToolTest`; manual: `quantri` → `navigate /admin/users`, `hocvien` refused.
  - Files: `…/assistant/tool/OpenScreenTool.java`, `test/…/assistant/OpenScreenToolTest.java`.
  - Depends on: Phase 1.
- [ ] **T9 `update_profile`** · M
  - Accept: SSO and must-change-password users not offered; validation failures are `Result`s; unchanged fields
    dropped; preview has labels and old values; `execute` updates only the changed fields through
    `SelfProfileService` and returns `/me`; changed since proposal → `ACTION_STALE`; IT: foreign confirm
    `ACTION_NOT_FOUND`, owner confirm changes the row and audit once, second confirm `ACTION_NOT_FOUND`;
    `ASSISTANT.md` tools section and Postman (navigation turn, profile turn, confirm, cancel).
  - Verify: `mvn clean verify`; manual: profile unchanged until confirm.
  - Files: `…/assistant/tool/UpdateProfileTool.java`, `ProfileChange.java`,
    `test/…/assistant/UpdateProfileToolTest.java`, `test/…/assistant/AgentProfileFlowIT.java`,
    `docs/api/ASSISTANT.md`, `docs/postman/…`.
  - Depends on: Phase 1.

### Checkpoint: Phase 2

- [ ] `mvn clean verify` green
- [ ] `agent-tools` manual success criteria pass on the local backend
- [ ] Eval re-run with the real tools; result reported
- [ ] Stop for approval

## Phase 3: `agent-contracts` → `chat-widget` (FE)

- [ ] **T10 Agent schemas and endpoints** · S
  - Accept: every event type parses; `navigate` without `/` fails; an unknown `tool` event parses; an unknown
    pending-action tool fails; last message `assistant` fails; exported from `@lms/contracts`.
  - Verify: `npx nx test contracts`.
  - Files: `libs/contracts/src/lib/assistant-agent/agent.schema.ts`, `agent.endpoints.ts`, `agent.schema.spec.ts`,
    `libs/contracts/src/index.ts`.
  - Depends on: Phase 2 (contract as built).
- [ ] **T11 Mock backend for the agent** · M
  - Accept: each scripted row yields its events in order and every line parses; confirm changes `/auth/me`;
    confirm twice, by another user, or after cancel → `assistantActionNotFound`; the agent requests of the backend's
    Postman collection (added in T5 and T9) are copied into `postman-requests.ts` and the replay parses them.
  - Verify: `npx nx test mocks`.
  - Files: `libs/mocks/src/lib/backend-responses.ts`, `libs/mocks/src/lib/assistant-agent/agent.fixtures.ts`,
    `libs/mocks/src/lib/backend/fake-backend.ts`, `fake-backend.spec.ts`, `postman-requests.ts`,
    `libs/mocks/src/fixtures.spec.ts`. (Six files, most of them small edits.)
  - Depends on: T10.
- [ ] **T12 Move shared answer parts to `shared/assistant/`** · S
  - Accept: `source-badge`, `answer-parts`, `citation-label` (and specs) live in `apps/lms/src/app/shared/assistant/`;
    `/assistant` imports them from there; no behaviour change.
  - Verify: `npx nx test lms` green before and after; `npx nx lint lms`.
  - Files: the three moved units and their specs, the assistant components that import them.
  - Depends on: None (own commit).
- [ ] **T13 Session storage for the conversation** · S
  - Accept: `SESSION_STORAGE` token mirrors `LOCAL_STORAGE`; `agent-chat.storage` uses key
    `lms.agent-chat.v1.<userId>`, caps at 30 turns, discards data failing its zod check, works in memory when storage
    is blocked.
  - Verify: `npx nx test lms -- agent-chat.storage`.
  - Files: `apps/lms/src/app/core/storage/session-storage.ts`, `core/assistant/agent-chat.storage.ts`,
    `agent-chat.storage.spec.ts`, `agent-chat.model.ts`.
  - Depends on: T10.
- [ ] **T14 `AgentChatStore`** · M
  - Accept: history = last 10 finished turns with card results, errored/stopped left out; events move the reply as
    in the spec; `navigate` outside the user's nav does not navigate; confirm applies `Me`; not-found → `expired`,
    stale → `failed`; expired `expiresAt` makes no request; stop keeps text; offline refuses; persistence restores a
    streaming turn as `stopped`; sign-out clears; `available$` false without `AI_ASSISTANT`.
  - Verify: `npx nx test lms -- agent-chat.store`.
  - Files: `apps/lms/src/app/core/assistant/agent-chat.store.ts`, `agent-chat.store.spec.ts`.
  - Depends on: T11, T13.
- [ ] **T15 Chat panel, message, composer** · M
  - Accept: the shell renders the panel while open, not on `/assistant`, not without `AI_ASSISTANT`; `role="dialog"`
    non-modal, Escape closes; header (title, "Mở Trợ lý AI", clear, close); empty line; tool status lines; `[n]`
    badges; composer Enter / Shift+Enter, 500 limit, stop, offline.
  - Verify: `npx nx test lms -- chat-widget agent-message agent-composer`; browser on the mock backend (opened from
    the store in the dev console until T17).
  - Files: `apps/lms/src/app/layout/chat-widget/chat-widget.ts|html|scss|spec.ts`,
    `components/agent-message/*`, `components/agent-composer/*`, `layout/shell/app-shell.html`.
  - Depends on: T12, T14.
- [ ] **T16 Action card** · S
  - Accept: `dl` of changes with "(trống)" for null; "Xác nhận" / "Huỷ" by state; result line after; `expired` and
    `failed` messages in the danger text token; one card confirming at a time.
  - Verify: `npx nx test lms -- action-card`; browser: the mock's profile row end to end.
  - Files: `apps/lms/src/app/layout/chat-widget/components/action-card/*`, `chat-widget.html`.
  - Depends on: T15.

### Checkpoint: Phase 3

- [ ] `npm run check` green
- [ ] angular.md §14 and the visual-design checklist pass
- [ ] Browser on the mock backend: 375 and 1280, light and dark, keyboard only
- [ ] Stop for approval

## Phase 4: `owl-launcher` (FE)

- [ ] **T17 The owl opens and closes the panel** · S
  - Accept: click toggles when available, navigates to `/assistant` when not; `aria-expanded`, `aria-controls`,
    labels with the processing count; bubble hidden while open; click no longer dismisses the notice; existing owl
    state specs unchanged; the dev-toolbar offset moves owl and panel together.
  - Verify: `npx nx test lms -- owl app-shell`; `npm run check`; browser: Tab to the owl, Enter, Escape.
  - Files: `apps/lms/src/app/layout/owl/owl.ts|html|scss|spec.ts`, `layout/shell/app-shell.scss`,
    `app-shell.spec.ts`.
  - Depends on: T16.

### Checkpoint: Phase 4

- [ ] Frontend gates as in Phase 3, plus the owl's processing states unchanged
- [ ] Stop for approval

## Phase 5: end to end

- [ ] **T18 End-to-end run on the local backend** · S
  - Accept: SPEC.md success criteria 1–5 with screenshots (owl toggle and persistence; grounded answer and not-found;
    `quantri` navigates, `hocvien` refused; profile card confirm, cancel and expiry; all checks green); time to first
    token recorded.
  - Verify: browser with `LMS_API_TARGET=http://localhost:8019`, `mockBackend: false`; `mvn clean verify`;
    `npm run check`.
  - Files: none, or fixes found by the run (each its own commit).
  - Depends on: Phase 4.
- [ ] **T19 As-built notes** · XS
  - Accept: each module spec has an "Implementation notes (as built)" section for any deviation; `SPEC.md` status
    updated; `docs/api/ASSISTANT.md` final.
  - Verify: `npx prettier --check "*.md" tasks/*.md`.
  - Files: `SPEC*.md`, BE `docs/api/ASSISTANT.md`.
  - Depends on: T18.

### Checkpoint: Complete

- [ ] Every success criterion in SPEC.md met and reported with how it was verified
- [ ] Ready for review and pull requests (one per repo)
