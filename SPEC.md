# Capability map: learner and lesson APIs ("Học viên & bài học")

Status: **map and the six module specs approved 2026-10-26; plan in [tasks/plan.md](tasks/plan.md). Nothing is built yet.**

Replaces the map of the AI chatbot initiative (shipped in PR #42; that map is in git history). Its module specs
(`SPEC-agent-*.md`, `SPEC-chat-widget.md`, `SPEC-owl-launcher.md`) and the older `SPEC-kb-*.md`,
`SPEC-doc-tracker.md`, `SPEC-assistant-screen.md`, `SPEC-owl-indicator.md` stay beside this file as the reference
for shipped modules.

## Objective

The backend (`corebanking-academy`, `learning` package) serves the whole learner flow and the asset library, but
the app calls only the catalogue (`/me/learning/catalog`, `/me/learning/courses`) and the course authoring
endpoints. A learner can find a course and cannot open it. This initiative wires the 18 backend endpoints the app
does not use yet, through the screens that need them, so a learner can enrol, study a lesson (video, PDF, text,
process, image, attachment) with progress saved by the server, see their progress and reminders, and an author
can manage media and course shares.

Users: learners (`hocvien`), and authors and admins for `asset-library` and `course-sharing`.

## The 18 endpoints

| #   | Endpoint                                                                       | In contracts today          | Module               |
| --- | ------------------------------------------------------------------------------ | --------------------------- | -------------------- |
| 1   | `POST /api/v1/courses/{courseId}/enrollments`                                  | yes (`enroll`), unused      | `lesson-player`      |
| 2   | `GET /api/v1/me/learning/enrollments/{enrollmentId}`                           | yes (`enrollment`), unused  | `lesson-player`      |
| 3   | `POST /api/v1/me/learning/sessions`                                            | no                          | `lesson-player`      |
| 4   | `PUT /api/v1/me/learning/enrollments/{enrollmentId}/blocks/{blockId}/progress` | yes, **schema out of date** | `lesson-player`      |
| 5   | `GET /api/v1/learning-assets/{assetId}/content`                                | yes, unused                 | `lesson-player`      |
| 6   | `GET /api/v1/me/learning/progress/summary`                                     | no                          | `learner-progress`   |
| 7   | `GET /api/v1/me/learning/progress/export` (CSV)                                | no                          | `learner-progress`   |
| 8   | `GET /api/v1/me/learning/reminders`                                            | yes, unused                 | `learning-reminders` |
| 9   | `POST /api/v1/me/learning/reminders/{reminderId}/read`                         | yes, unused                 | `learning-reminders` |
| 10  | `GET /api/v1/learning-assets`                                                  | no                          | `asset-library`      |
| 11  | `POST /api/v1/learning-assets/uploads`                                         | no                          | `asset-library`      |
| 12  | `GET /api/v1/learning-assets/uploads/{uploadId}`                               | no                          | `asset-library`      |
| 13  | `PUT /api/v1/learning-assets/uploads/{uploadId}/parts/{partNumber}`            | no                          | `asset-library`      |
| 14  | `POST /api/v1/learning-assets/uploads/{uploadId}/complete`                     | no                          | `asset-library`      |
| 15  | `DELETE /api/v1/learning-assets/uploads/{uploadId}`                            | no                          | `asset-library`      |
| 16  | `DELETE /api/v1/learning-assets/{assetId}`                                     | no                          | `asset-library`      |
| 17  | `GET /api/v1/courses/{courseId}/shares`                                        | yes, unused                 | `course-sharing`     |
| 18  | `PUT /api/v1/courses/{courseId}/shares`                                        | yes, unused                 | `course-sharing`     |

`learner-home` adds no new endpoint: it reuses #6, #8 and the shipped `myCourses`.

Not wired: `GET /api/v1/learning-assets/{assetId}/gateway-authorization` is called by the media gateway with
`X-Media-Gateway-Key`, never by the browser.

## Modules

| Module id            | Screens                                                     | Responsibility                                                                                                                                                                    | Depends on                                                |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `lesson-player`      | `course/:id`, `lesson/:courseId/:lessonId` (mockup F.3–F.6) | Course page with enrol and resume; the lesson player per block type; the study session (claim, fence, takeover on another device); progress events; media playback                | shipped `catalog`                                         |
| `learner-progress`   | `progress` (F.8)                                            | Summary counts, the personal course table (shipped `myCourses`), CSV export                                                                                                       | —                                                         |
| `learning-reminders` | `notifications` (E.3)                                       | Due reminders, mark as read, unread count on the menu                                                                                                                             | —                                                         |
| `learner-home`       | `learn` (F.1)                                               | Continue learning, summary counts, my courses by state, due dates, latest reminders; no radar, scores or streak while the backend returns `unavailable`                           | `lesson-player`, `learner-progress`, `learning-reminders` |
| `asset-library`      | course editor, lesson form                                  | Pick a file from the library; chunked upload (8 MiB parts, SHA-256 of the whole file) with progress, resume and cancel, replacing today's one-shot upload; delete an unused asset | —                                                         |
| `course-sharing`     | course list (`admin/courses`), row menu → drawer            | List and change the units a course is shared with                                                                                                                                 | —                                                         |

Each module owns its contracts (zod schema, endpoint, fixture, mock handler) and its screen, so each ships and is
verified on its own. Dependencies point one way; only `learner-home` depends on other modules of this map, and only
on their contracts and the lesson route.

Build order (one phase at a time; each ends with `npm run check`, a run on the local backend, a commit and a stop
for approval):

| Phase | Modules                             |
| ----- | ----------------------------------- |
| 0     | this map, then the six module specs |
| 1     | `lesson-player`                     |
| 2     | `learner-progress`                  |
| 3     | `learning-reminders`                |
| 4     | `learner-home`                      |
| 5     | `asset-library`                     |
| 6     | `course-sharing`                    |

Module specs, in build order: [SPEC-lesson-player.md](SPEC-lesson-player.md) ·
[SPEC-learner-progress.md](SPEC-learner-progress.md) · [SPEC-learning-reminders.md](SPEC-learning-reminders.md) ·
[SPEC-learner-home.md](SPEC-learner-home.md) · [SPEC-asset-library.md](SPEC-asset-library.md) ·
[SPEC-course-sharing.md](SPEC-course-sharing.md).

## Decisions (from the 2026-10-26 questions)

| #   | Decision                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | **All five API modules** are in scope, built in the order above.                                                                                   |
| L2  | **`learner-home` is added** as a sixth module: the `learn` screen is migrated in this initiative.                                                  |
| L3  | **Reminders live on the `notifications` screen** (migrated from mockup E.3), with the unread count on the menu.                                    |
| L4  | **The asset library lives in the course editor**: the lesson form picks from the library or uploads in parts. `admin/lessons` stays a placeholder. |

## Findings that shape the specs

1. **`saveProgress` is out of date in the app.** The backend's `ProgressRequest` requires `sessionId`,
   `sessionFence`, `eventType`, `expectedVersion` and `sequence` (≥ 1), and takes `assetId` and `playing`; the
   app's `SaveProgressCommandSchema` has none of the session fields and makes `sequence` optional. The backend's
   `ProgressResult` also returns `session` (a receipt with the accepted sequence and lease state), which the app's
   `ProgressResultSchema` drops. `lesson-player` fixes both and the mock handler with them.
2. **Progress needs a session.** A lesson block is studied inside a session from `POST /me/learning/sessions`
   (one active session per account, a lease, a fence that rises on each takeover). Opening the same lesson on a
   second device needs a "chuyển sang thiết bị này" confirmation (`takeover: true`).
3. **Media goes through a cookie, not a bearer token.** The session response sets an HttpOnly media cookie, and
   `/learning-assets/{id}/content` streams the file (Range requests, no envelope). `<video>` and the PDF viewer load
   it by URL through the dev proxy.
4. **CSV export is not JSON.** `/progress/export` returns `text/csv` with a BOM and no envelope. It is a `blob`
   endpoint (the transport exists); `learner-progress` makes `envelopeInterceptor` read a JSON refusal on a blob
   endpoint, so `LEARNING-EXPORT_TOO_LARGE` is not saved as a `.csv`.
5. **The summary is partial.** `activity`, `assessment` and `competency` come back as `unavailable` until the
   backend has a source; screens show that state instead of inventing numbers.

## Assumptions (correct any of these before approval)

1. **Local run.** Backend on `localhost:8019` with its own Postgres and object storage, app with
   `LMS_API_TARGET=http://localhost:8019 npm start`. Each phase is verified on it with the seeded accounts, and on
   the mock (`mockBackend: true`) for the specs.
2. **Business rules stay on the server.** Completion modes (`manual`, `video_coverage`, `pdf_end`, `open`),
   percentages, watched ranges and lesson unlocking come from the backend; the app sends events and renders results.
3. **Quiz lessons are out.** The backend's quiz module is not built (`LEARNING-QUIZ_UNAVAILABLE`), so a `quiz`
   lesson is listed in the outline as "Bài kiểm tra chưa mở" and is not a link.
4. **No backend change.** Every endpoint exists on `corebanking-academy` `main` (`eef62e5`). A backend gap found
   while specifying a module is written in that module's open questions, not patched here.
5. **Branch:** this repo continues on `claude/fe-be-missing-apis-c5a9bd`, one commit per phase.

## Out of scope

Quiz taking and results; notes, bookmarks, transcripts and flashcards from the lesson page; the AI tab in the
lesson; certificates and leaderboard; the `admin/lessons` screen; notification types other than learning
reminders; backend changes; production deployment.

## Boundaries (whole initiative)

- **Always:** one phase at a time, ending with its checks, a commit and a stop; follow `AGENTS.md` and the docs it
  lists (angular.md, contracts-and-mocks.md, visual-design.md, mockup-to-angular.md); every response parsed by its
  zod schema, types from `z.infer`; components render store selectors; UI copy in Vietnamese from the mockup, code,
  comments and commits in English.
- **Ask first:** a new dependency (a PDF renderer, a SHA-256 or upload library); a backend change; a contract change
  to an endpoint another shipped screen uses; moving a screen out of this map's list.
- **Never:** compute progress, completion or permissions in the app; put an access token in a media URL; keep a
  file's bytes or a session id in `localStorage`; commit to `main` or commit secrets.

## Success criteria (end of Phase 6, on the local backend)

1. As `hocvien`: from `catalog`, open a course, enrol, open a video lesson, watch part of it, reload, and resume at
   the saved position; the course and lesson percentages shown are the server's.
2. A PDF block resumes at the last page; a `manual` block completes on "Đánh dấu hoàn thành".
3. Opening the same lesson in a second browser asks to switch device; after confirming, the first one stops
   saving and says the session moved.
4. `progress` shows the server's counts and table; "Xuất CSV" downloads a file that opens in Excel with Vietnamese
   text intact.
5. `notifications` lists due reminders; opening one marks it read and the menu count drops.
6. `learn` shows "Tiếp tục học" pointing at the right lesson, the summary counts and the latest reminders.
7. As an author: in the course editor, upload a video over 8 MiB with a progress bar, cancel one upload, resume
   one after a reload, pick an existing asset from the library, and delete an unused asset.
8. As an author: share a course with another unit and see it in the share list.
9. `npm run check` green; angular.md §14, the visual-design checklist and the migration verify step pass for every
   migrated screen.

## Open questions

None for the map. The module specs leave these for approval:

| Spec                 | Question                                                                       | Kind                          |
| -------------------- | ------------------------------------------------------------------------------ | ----------------------------- |
| `lesson-player`      | Add `pdfjs-dist` to track the PDF page (LP2)                                   | new dependency                |
| `lesson-player`      | One active block at a time instead of the mockup's stacked blocks (LP1)        | deliberate difference         |
| `lesson-player`      | A learner endpoint for one course; until then two lists are paged to find it   | backend gap, interim in place |
| `learning-reminders` | Course id and title on a reminder; until then items link to the progress table | backend gap, interim in place |
| `asset-library`      | Add `@noble/hashes` for the incremental whole-file SHA-256                     | new dependency                |
| `course-sharing`     | Authors see only the units in their scope when sharing                         | backend gap, interim in place |
