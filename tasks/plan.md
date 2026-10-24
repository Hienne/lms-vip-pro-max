# Implementation Plan: AI chatbot with tool calls ("Trợ lý nhanh")

Spec: [SPEC.md](../SPEC.md) (capability map, decisions C1–C4, assumptions 1–9) and the five module specs
beside it, all approved 2026-10-24. Tasks: [todo.md](todo.md). Run `nvm use` (Node 24) before npm/nx commands.

Replaces the plan of the AI assistant RAG initiative (every task done; that plan is in git history).

Execution: one phase at a time. Each task is one commit with its checks green; each phase ends at its
checkpoint and stops for approval before the next.

## Overview

A small chat panel above the owl in the bottom-right corner of every app page. It answers document questions
from the shared knowledge base (with the `/assistant` citations), opens one of the user's own screens, and
proposes changes to the user's own profile that run only after "Xác nhận". The backend runs the agent loop
against the local Ollama (`qwen3:8b` with tools); the app streams it, renders it and confirms actions.

Two repos:

- Backend `/Users/nguyenhien/my-projects/corebanking-academy` (Spring Boot, Java 21, Maven), new branch
  `feat/ai-chatbot-agent` from `main`.
- Frontend: this worktree, branch `claude/ai-chatbot-tool-call-2fcf7a`.

## Dependency graph

```
Phase 0  local stack (Docker, pgvector DB, backend :8019, Ollama, FE proxy)      ← unblocks every IT and manual check
   │
Phase 1  T1 OllamaClient.chatWithTools
            │
            T2 prompt + tool definitions + AgentToolChoiceEval  ── gate: ≥ 90% tool choice
            │
            T3 agent loop (AgentService, types, registry, context)
            ├── T4 PendingActionStore
            └── T5 controllers (stream, confirm, cancel) + API doc   (needs T3, T4)
   │
Phase 2  T6 extract CitationSelector / formatChunk from kb-chat (no behaviour change)
            │
            T7 search_documents ── T8 open_screen ── T9 update_profile (+ execute, IT)
   │
Phase 3  T10 agent schemas + endpoints
            │
            T11 mock refusals, fixtures, FakeBackend handlers
            │
            T12 move source badge / answer-parts / citation-label to shared/   (independent of T10–T11)
            │
            T13 SESSION_STORAGE + agent-chat.storage
            │
            T14 AgentChatStore
            │
            T15 panel, message, composer, shell rendering ── T16 action card
   │
Phase 4  T17 owl launcher
   │
Phase 5  T18 end-to-end on the local backend ── T19 as-built docs
```

## Architecture decisions (from the specs, do not re-litigate)

- The backend runs the loop (C1); read tools run at once, `update_profile` becomes a pending action that only
  `POST …/actions/{id}/confirm` runs, on the request thread, as the user, through `SelfProfileService`.
- `open_screen` and `update_profile` are terminal: their event, then `done` with a fixed sentence, no second
  model call. At most 4 model calls per turn.
- Tools read identity only from `AgentContext`, built on the request thread before the stream starts.
- History is text only (`user`/`assistant`); tool calls and results never come from the client.
- Pending actions live in memory (TTL 10 min, owner-bound, one `ACTION_NOT_FOUND` for missing, expired or
  foreign ids). No new table, no new dependency (no Spring AI, no cache library).
- Citations keep the `kb-chat` rules: from chunk metadata, selected by `[n]`, fixed not-found sentence; nothing
  retrieved in the turn forces the not-found answer.
- Conversation in `sessionStorage` per user (C4); the owl is the launcher (C3); the widget is hidden on
  `/assistant`.
- Business rules stay on the server; the app checks a `navigate` path against the user's nav only as a guard.

## Phases and checkpoints

| Phase | Tasks   | Gate before moving on                                                                                                                                      |
| ----- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | T0      | `docker ps` pgvector healthy; `curl :8019/actuator/health` UP; `ollama list` has `qwen3:8b`, `bge-m3`; sign-in as `quantri` works through the FE proxy     |
| 1     | T1–T5   | `mvn clean verify` green; eval hit rate ≥ 90% reported with time to first token; `curl -N` on `/stream` shows `tool` before `delta`s                       |
| 2     | T6–T9   | `mvn clean verify` green; `agent-tools` manual criteria (hocvien refused, quantri navigates, profile unchanged until confirm); eval re-run with real tools |
| 3     | T10–T16 | `npm run check` green; angular.md §14; visual-design checklist; browser pass on the mock backend at 375 and 1280, light and dark, keyboard only            |
| 4     | T17     | same frontend gates; owl states unchanged; Tab → Enter opens, Escape closes with focus back on the owl                                                     |
| 5     | T18–T19 | SPEC.md success criteria 1–5 on the local backend with screenshots; specs updated with as-built notes                                                      |

## Risks and mitigations

| Risk                                                                                | Impact                                | Mitigation                                                                                                                        |
| ----------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `qwen3:8b` with `think:false` picks the wrong tool or answers documents from memory | Wrong answers, missed actions         | T2 measures it before any runtime code depends on it; tune the prompt and tool descriptions; a gate at 90%                        |
| Ollama streams `tool_calls` differently than documented (split, or with content)    | Lost tool calls                       | T1 tests both shapes from recorded Ollama 0.40.9 output; T2 runs against the real server                                          |
| The model invents arguments (an enum value it was not given, a malformed email)     | A wrong screen or a bad profile value | Server-side validation in every tool; refusals go back to the model as text; data changes need a click                            |
| Security context missing on the stream thread                                       | A tool acts as nobody or fails        | `AgentContext` captured on the request thread; `execute` runs only on the confirm request                                         |
| Slow first token on this Mac (an 8B model, up to 4 calls)                           | The widget feels stuck                | `tool` events drive a status line at once; terminal tools skip the follow-up call; time to first token recorded in Phases 1 and 5 |
| Moving the source badge breaks `/assistant`                                         | Regression in a shipped screen        | T12 is its own commit with the assistant specs green before and after                                                             |
| Docker Desktop not running                                                          | No DB, no Testcontainers              | T0 starts it and checks before Phase 1                                                                                            |
| Another session committing in the shared stash or worktree                          | Commit pollution                      | Stage only the task's files; no bare `git stash`                                                                                  |

## Parallelization

The build order is sequential by approval. One opening exists if wanted: the app-side contract is fixed by
the specs and driven by the mock backend, so Phase 3 (T10–T16) could run in parallel with Phase 2 in another
session. It is not planned that way; say so to change it.

## Open questions

None blocking. If T2 measures below 90%, Phase 1 stops with the results and options (prompt changes, tool
description changes, or `think:true` for the routing call) before T3.
