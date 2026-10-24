# Capability map: AI chatbot with tool calls ("Trợ lý nhanh")

Status: **built and verified on the local backend 2026-10-24; plan in [tasks/plan.md](tasks/plan.md). Deviations and known gaps are in the "Implementation notes (as built)" of each module spec.**

Replaces the map of the AI assistant RAG initiative (shipped in PR #40; that map is in git history). Its module
specs (`SPEC-kb-*.md`, `SPEC-doc-tracker.md`, `SPEC-assistant-screen.md`, `SPEC-owl-indicator.md`) stay beside
this file as the reference for the shipped modules this initiative builds on.

## Objective

A small chatbot docked in the bottom-right corner of every app page, separate from the "Trợ lý AI" screen
(`/assistant`). The user opens and closes it from the owl. In it they can:

1. ask about the uploaded documents, answered from the shared knowledge base with the same citations as
   `/assistant`;
2. ask it to **open a screen** ("mở trang quản lý người dùng"), limited to the screens the user's role grants;
3. ask it to **update their own profile** ("đổi email của tôi thành …"), which runs only after the user
   confirms the change in the chat.

The model is `qwen3:8b` on the local Ollama, called with tools. The backend (`corebanking-academy`) runs
locally. Creating and assigning courses are the next tools, after this map ships (see Out of scope); the
tool registry is designed so adding them touches only `agent-tools` and the action card.

## Modules

| Module id         | Repo                  | Responsibility                                                                                                                                         | Depends on                                       |
| ----------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `agent-runtime`   | `corebanking-academy` | Ollama tool calling (`tools`, `tool_calls`), the agent loop with a step cap, NDJSON stream, the tool registry, pending actions with confirm and cancel | `kb-storage` (shipped: `OllamaClient`, settings) |
| `agent-tools`     | `corebanking-academy` | The three tools: `search_documents` (reuses `kb-chat` retrieval and citations), `open_screen`, `update_profile`                                        | `agent-runtime`, `kb-chat`, identity             |
| `agent-contracts` | this repo             | zod schemas for the request, stream events and actions; endpoint registry; fixtures; mock API handlers                                                 | `agent-runtime`, `agent-tools`                   |
| `chat-widget`     | this repo             | App-level store (conversation in `sessionStorage`, streaming, pending action) and the floating chat panel with the action card and source badges       | `agent-contracts`                                |
| `owl-launcher`    | this repo             | The owl becomes the widget's launcher: a click opens and closes the panel, while it keeps showing document processing                                  | `chat-widget`, `owl-indicator` (shipped)         |

Module specs: [SPEC-agent-runtime.md](SPEC-agent-runtime.md) · [SPEC-agent-tools.md](SPEC-agent-tools.md) ·
[SPEC-agent-contracts.md](SPEC-agent-contracts.md) · [SPEC-chat-widget.md](SPEC-chat-widget.md) ·
[SPEC-owl-launcher.md](SPEC-owl-launcher.md).

Dependency direction is one way: backend runtime → backend tools → FE contracts → widget → owl. The
contract between the backend and the app (request, stream events, action shape) is specified in
`SPEC-agent-runtime.md`, with each tool's arguments and result in `SPEC-agent-tools.md`.

Build order (one phase at a time, each ends with its checks, a commit and a stop for approval):

| Phase | Modules                                        |
| ----- | ---------------------------------------------- |
| 0     | this map, then the five module specs           |
| 1     | `agent-runtime`                                |
| 2     | `agent-tools`                                  |
| 3     | `agent-contracts` → `chat-widget`              |
| 4     | `owl-launcher`                                 |
| 5     | end-to-end run on the local backend and Ollama |

## Decisions (from the 2026-10-24 questions)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **The backend runs the agent loop.** Read-only tools (`search_documents`, `open_screen`) run as soon as the model calls them. A tool that changes data (`update_profile`) does not run: the backend stores it as a pending action and streams an `action_required` event; the app shows a confirmation card, and only `POST …/actions/{id}/confirm` runs it, as the signed-in user, through the existing service (`SelfProfileService.update`). |
| C2  | **First tools:** document search, open a screen, update own profile (full name, email, position). Course creation and assignment are out of this map.                                                                                                                                                                                                                                                                                           |
| C3  | **The owl is the launcher.** One anchor in the corner: the owl keeps its processing states and opens or closes the chat panel on click. The owl's current click (go to `/assistant`) moves to a link inside the panel.                                                                                                                                                                                                                          |
| C4  | **Conversation lives in the browser, per tab** (`sessionStorage`): it survives navigation and reload, and is cleared on sign-out or when the tab closes. Each request sends the last 10 turns. No new table.                                                                                                                                                                                                                                    |

## Assumptions (correct any of these before approval)

1. **Local run.** Postgres from the backend's `compose.yaml` (`pgvector/pgvector:pg16`, needs Docker Desktop
   running — it is not running now), backend on `localhost:8019`, app with
   `LMS_API_TARGET=http://localhost:8019 npm start`. Ollama 0.40.9 is installed with `qwen3:8b` and `bge-m3`.
2. **Who sees it.** Every signed-in user with the `AI_ASSISTANT` function (all four roles today). No new function
   code. The widget is hidden on `/assistant` (that screen is the full version) and on the sign-in and
   change-password pages.
3. **New endpoints** under `/api/v1/assistant/agent`: `POST /stream` (NDJSON, same transport as
   `kb-chat`), `POST /actions/{actionId}/confirm`, `POST /actions/{actionId}/cancel`. Pending actions are held
   in memory, bound to the user who caused them, and expire after 10 minutes; a restart drops them (the card
   then says the request expired).
4. **History is text only.** The request carries `user` and `assistant` text turns; the backend ignores any other
   role, so a client cannot inject tool results. Each tool's result is computed on the server in the same turn.
5. **`open_screen`** takes a function code from the user's own granted functions (the server builds the list
   from the user's grants, the same source as `/auth/me` `nav`); the stream sends a `navigate` event with the
   route and the app navigates. Unmigrated screens open their placeholder, as from the sidebar.
6. **`update_profile`** accepts only `fullName`, `email`, `positionName`, validated with the same rules as
   `PATCH /auth/me`. The card shows each field as "cũ → mới". SSO accounts get a refusal before any card. The
   card is confirm or cancel only (no inline editing); to change a value the user says so in the chat. After
   confirm, the app applies the refreshed `/me` to the session, as the profile page does.
7. **Document answers** keep the `kb-chat` rules: only retrieved chunks, citations from chunk metadata selected by
   `[n]` markers, the fixed not-found sentence; an answer with no usable `[n]` has no sources (the one difference from
   `kb-chat`, approved 2026-10-24). The widget reuses the source badge and popover from
   `/assistant`.
8. **Agent loop limits:** at most 4 model calls per user turn, `think: false`, temperature 0.1, `num_ctx 8192`;
   an unknown tool, bad arguments or the cap ends the turn with a readable Vietnamese message.
9. **Branches:** backend `feat/ai-chatbot-agent` from `main`; this repo continues on
   `claude/ai-chatbot-tool-call-2fcf7a`.

## Out of scope

Creating, publishing or assigning courses (next map); any other data-changing tool; server-side conversation
history; editing an action's values in the card; voice; uploading documents from the widget; cloud models;
production deployment; rate limiting.

## Boundaries (whole initiative)

- **Always:** one phase at a time, ending with its checks, a commit and a stop; this repo follows `AGENTS.md`
  and its docs; the backend follows its `AGENTS.md` and `DEVELOPMENT_GUIDELINES.md`; every data change goes
  through a confirmed action and the existing service with the user's own permissions; tool arguments are
  validated on the server, never trusted from the model; UI copy in Vietnamese, code, comments and commits in
  English.
- **Ask first:** a new tool, and above all any tool that changes data; a new dependency (Spring AI, LangChain4j,
  a cache library); a new table; changing `kb-chat` behaviour or the `/assistant` screen beyond reusing its
  parts; touching the shared remote database or backend.
- **Never:** run a data-changing tool without the user's confirmation; act with more rights than the signed-in
  user; take a citation's source from model text; log question, answer or profile values; send anything to a
  model other than the local Ollama; commit to `main` or commit secrets.

## Success criteria (Phase 5, on the local backend)

1. On any page, a click on the owl opens the panel and another closes it; the owl still chews while an upload
   processes. The conversation is still there after moving to another page and after a reload.
2. "CIF là gì?" (with a document that covers it) answers with source badges pointing at the right file and lines;
   an out-of-document question answers the fixed not-found sentence with no sources.
3. Signed in as `quantri`, "mở trang quản lý người dùng" navigates to `/admin/users`; signed in as `hocvien`, the
   same request is refused in words and nothing navigates.
4. "Đổi chức danh của tôi thành Chuyên viên" shows a card with the old and new value; nothing changes until
   "Xác nhận"; after it the profile page and header show the new value; "Huỷ" leaves the profile unchanged; a card
   confirmed after 10 minutes reports it expired.
5. FE: `npm run check` green, angular.md §14, the visual-design checklist and the migration verify step pass.
   BE: `mvn clean verify` green (Docker running for Testcontainers).

## Open questions

1. Is `qwen3:8b` reliable enough at choosing tools in Vietnamese? Phase 1 measures it on a fixed set of ~20
   prompts (documents, navigation, profile, chit-chat) and reports the hit rate; below 90% we revisit the
   prompt or the tool descriptions before Phase 2.
