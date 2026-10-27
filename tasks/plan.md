# Implementation Plan: learner and lesson APIs ("Học viên & bài học")

Spec: [SPEC.md](../SPEC.md) (capability map, decisions L1–L4) and the six module specs beside it, approved
2026-10-26. Tasks: [todo.md](todo.md). Run `nvm use` (Node 24) before npm/nx commands.

Replaces the plan of the AI chatbot initiative (shipped in PR #42; that plan is in git history).

The spec approval is read as accepting each module spec's recommended answer to its open questions:
one active block at a time (LP1), `pdfjs-dist` for PDFs (LP2) and `@noble/hashes` for upload hashing. The two
dependencies are still installed only in their own tasks (T11, T24), so either can be refused there without
touching the rest.

Execution: one task per commit with its checks green; each phase ends at its checkpoint and stops for approval
before the next. Frontend only (this worktree, branch `claude/fe-be-missing-apis-c5a9bd`); the backend
`corebanking-academy` (`main`, `eef62e5`) is run locally and never changed.

## Overview

Wire the 18 backend endpoints the app does not use yet, through six modules: the course page and lesson player,
the progress page with CSV export, the notifications page with the bell count, the learner home, the chunked upload
and asset library in the course editor, and course sharing in the course list.

## Dependency graph

```
Phase 0  T0 local stack (Docker, DB with learning SQL, backend :8019, S3, ffmpeg, FE proxy)   ← every manual check
   │
Phase 1  T1 learner fixtures + enrollment read ─┐
         T2 study-session contract + mock protocol ─┤   (T2 needs T1's fixtures)
         T3 findLearnerCourse (core/learning) ────┤
                                                   └─ T4 course page
         T5 study-protocol.ts (pure) ── T6 study-session storage
                     └──────────────┬──────────────┘
                                    T7 LessonStore (claim, events queue, refusals)       (needs T2, T3, T5, T6)
         T8 app-markdown + text/process blocks   (independent of T7)
                                    T9 lesson page (focus bar, outline, block list, alerts)   (needs T7, T8)
                                    ├─ T10 video block
                                    ├─ T11 pdfjs-dist + PDF block
                                    └─ T12 image + attachment blocks
                                    T13 local-backend pass, migration entries
   │
Phase 2  T14 JSON refusal on blob endpoints ── T15 progress contracts + mock ── T16 progress page
   │
Phase 3  T17 reminder contract + mock ── T18 notifications page ── T19 bell count
   │
Phase 4  T20 promote shared learning pieces ── T21 learn page                (needs Phases 1–3)
   │
Phase 5  T22 binary transport ── T23 asset contracts + mock ── T24 sha256 worker ── T25 chunkedUpload
            ── T26 editor upload integration ── T27 library drawer           (independent of Phases 1–4)
   │
Phase 6  T28 share contract + mock ── T29 shares drawer                       (independent of Phases 1–5)
   │
Phase 7  T30 end-to-end pass and as-built notes
```

Phases 5 and 6 touch only the admin course screens and their own contracts, so they could run in a separate
session in parallel with Phases 2–4. The default is sequential; parallel only if you ask for it.

## Architecture decisions (from the specs, do not re-litigate)

- The server owns progress, completion, coverage, counts and permissions; the app sends events and renders results.
- One study session per account on one block: the player shows one active block, claims on entry and on each block
  change, takes over only on a click, sends one progress request at a time through a serial queue (not
  `serverMutation`, which cancels in flight), and resends the same payload after a lost response.
- Media loads by URL with the backend's HttpOnly cookie; no token in a URL. Attachments download as blobs.
- `findLearnerCourse` (paging `myCourses` then `catalog`) stands in for a learner course endpoint the backend lacks.
- New transports go through `defineEndpoint` + `EndpointClient` only: JSON refusals on `blob` endpoints (T14) and
  `binary` bodies with declared headers (T22).
- Each module owns its contracts, fixtures and mock handlers; the learner session mock lives in its own file
  beside `learning.backend.ts` (already 1,148 lines).
- A piece moves to `shared/` when its second screen needs it (T20), in its own commit.
- Every screen task claims its migration entry (`in-progress`, owner `Hiendeptroai`) in its first commit and marks
  it `done` with the checks only after the browser pass; the `pullRequest` link is filled when the PR exists (T30).

## Phases and checkpoints

| Phase | Tasks   | Gate before moving on                                                                                                                                               |
| ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | T0      | backend health UP on :8019; a demo learner and the content admin sign in through the FE proxy; a PDF uploads to S3 from the course editor; `ffprobe -version` works |
| 1a    | T1–T4   | `npm run check` green; on the mock, `hocvien` opens a course from `catalog` and enrols                                                                              |
| 1b    | T5–T9   | `npm run check` green; on the mock, a text lesson completes manually, % moves, reload lands on the same block                                                       |
| 1c    | T10–T13 | lesson-player success criteria 1–4 on the local backend, two browsers for takeover                                                                                  |
| 2     | T14–T16 | learner-progress success criteria                                                                                                                                   |
| 3     | T17–T19 | learning-reminders success criteria                                                                                                                                 |
| 4     | T20–T21 | learner-home success criteria; progress and notifications specs unchanged after the move                                                                            |
| 5     | T22–T27 | asset-library success criteria (100 MB video with `ffmpeg`, offline and reload resume, cancel, library pick, delete)                                                |
| 6     | T28–T29 | course-sharing success criteria, including a learner seeing a self-enrol share in `catalog`                                                                         |
| 7     | T30     | every success criterion in SPEC.md met and reported with how it was verified                                                                                        |

## Risks and mitigations

| Risk                                                                                                                      | Impact | Mitigation                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ffmpeg`/`ffprobe` are not installed on this Mac, so no video becomes `ready` locally                                     | High   | T0 asks before `brew install ffmpeg`; until then video is verified on the mock (protocol) and the PDF path covers media on the local backend                   |
| Docker is not running; the local DB lacks the learning and media-progress SQL                                             | High   | T0 starts Docker, applies `learning_hub_learning.sql`, `learning_hub_media_progress.sql` and the learning demo SQL, and checks the tables before anything else |
| S3 (AIStor) in `.env` is not reachable from this machine                                                                  | High   | T0 uploads one PDF through the existing editor; if it fails, stop and report: media paths cannot be verified locally                                           |
| The media cookie does not survive the dev proxy (path `/api/v1/learning-assets`, `SameSite=Strict`, not `Secure` on http) | High   | T0 checks `Set-Cookie` through the proxy with one claim by `curl`/browser before T7; fix in `proxy.conf.mjs` (cookie path/domain rewrite) if needed            |
| Protocol timing (10 s / 20 s heartbeats, 60 s lease, ranges within 2× elapsed) is easy to get subtly wrong                | Med    | Pure `study-protocol.ts` with table tests (T5); the mock enforces the same checks (T2); the local-backend pass (T13) watches for `STALE_EVENT`                 |
| `pdfjs-dist` and its worker break the production bundle budget (1 MB initial) or the bundle guard                         | Med    | `@defer` the PDF block and load the worker as an asset; `npm run check` in T11 is the gate                                                                     |
| `findLearnerCourse` misses a course beyond 5 pages of 100                                                                 | Low    | Spec'd cap; the `missing` state explains it; Open question 1 asks the backend for a direct endpoint                                                            |
| Hashing a 500 MB file is slow in JS                                                                                       | Med    | Worker keeps the UI responsive and shows "Đang kiểm tra tệp… n%"; T24 measures a 100 MB file and reports the time                                              |
| Reminders without a course make the notifications page thin                                                               | Low    | Spec'd interim link to the progress table; backend question recorded                                                                                           |

## Open questions

Backend gaps recorded in the module specs (learner course endpoint, course on a reminder, unit lookup for
sharing) have interim answers in place and do not block any task. `brew install ffmpeg` on this Mac needs your OK
in T0.
