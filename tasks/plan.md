# Implementation Plan: `lesson-player-modes`

Spec: [SPEC-lesson-player-modes.md](../SPEC-lesson-player-modes.md) (draft; amended below). Map: [SPEC.md](../SPEC.md).
Tasks: [todo.md](todo.md).

This plan replaces the one for `learner-home-refresh`. That plan is done; its PR is Hienne/lms-vip-pro-max#57, and it
is in git history at `3d16946`.

## Overview

Three features of the mockup's lesson player (`lms-mockup/src/pages/lesson.js`):

1. **Chế độ tập trung:** a top-bar toggle that hides the side panel and widens the content. It is app only.
2. **Mốc video:** a row of chapter buttons under a video block; a click seeks.
3. **Transcript:** a collapsible list of timed lines under a video block, with search; a click seeks; the line being
   played is marked.

**Backend.** `lesson_blocks` gains two `jsonb` columns, `video_chapters` and `transcript`. They are saved through the
existing course tree save and read through the existing block view. There is no new endpoint. This is a schema
change: an upgrade script, a rollback script, the psql command and a README entry.

## What was checked while planning (2026-11-03)

**Backend (`corebanking-academy`, `origin/main` at `5563e76`)**

- **`LearningRequests.BlockInput`** has `blockType, title, body, bodyFormat, completionMode, completionThreshold,
isRequired, assets, steps`. `LearningViews.LessonBlockView` mirrors the entity and is mapped by MapStruct
  (`LearningMapper.view(LessonBlock)`).
- **The tree save rewrites every block.** `LearningContentService.writeTree` → `writeBlock` creates new
  `LessonBlock` rows from the request. A save that omits the new lists would therefore clear them.
- **Revisions copy blocks by building `BlockInput`s** from the original tree (`LearningContentService`, around
  line 597). That constructor call must pass the two lists, or a new revision loses them.
- **Validation** of a block lives in `validateBlockInput` and fails with `BusinessException.validation(field, code,
message)`. There is no `LEARNING-BLOCK_INVALID` code.
- **JSON columns** are mapped as `@JdbcTypeCode(SqlTypes.JSON) JsonNode`, as `MediaTranscript.segmentsJson` does.
- **Asset duration** is `learning_hub.assets.duration_seconds` (`LearningAsset.durationSeconds`, `numeric(12,3)`),
  null until the asset is READY.
- **Upgrades** live in `docs/sql/upgrade/` as `YYYY-MM-DD-<module>.sql` plus `.rollback.sql`; the latest is
  `2026-11-03-lesson-notes`.
- **Local data:** one READY video block, block 33 in lesson 17 of `DEMO-MEDIA` (asset 3, **30 s**). Block 31
  (`FE-DEMO-C6`) points at a failed asset.
- **`scripts/local-seed-media.sh`** does nothing once `DEMO-MEDIA` exists, so it cannot add data to the local
  course.

**App (`origin/main` at `3d16946`)**

- **`video-block`** already has a `jump` input that moves the player and reports the move as a seek (added for
  `lesson-notes`). Chapters and transcript seek through it.
- **`LessonBlockSchema`** has no chapters or transcript. `BlockInputSchema` is the editor's save payload.
- **The course editor** (`features/admin-content/course-editor/course-draft.ts`) builds every block's input from
  its form value. Without a change it would send no lists, and the backend would clear them on every save.
- **No focus mode** exists in the lesson page.

## Decisions (amendments to the spec)

1. **Errors** use the existing validation error (`BusinessException.validation`), with the fields `videoChapters` or
   `transcript` and the Vietnamese messages of the module. Not `LEARNING-BLOCK_INVALID`.
2. **Null and empty.** In a request, a missing list or `null` is saved as `NULL`; an empty list too. The view always
   returns a list (`[]` when `NULL`).
3. **Revision copy** passes both lists through.
4. **The course editor keeps the lists.** It has no chapters or transcript UI (open question 1 stays "no"), but it
   carries each video block's loaded `videoChapters` and `transcript` into the save payload unchanged, so a save
   from the app does not clear them. A new block starts with none.
5. **Validation:**
   - at most 50 chapters, each title 1–120 characters after trimming;
   - at most 2000 transcript lines, each text 1–1000 characters after trimming;
   - `startSeconds` ≥ 0, strictly increasing within each list, and at most the primary asset's `duration_seconds`
     when that is known;
   - lists on a block other than `video` are refused.
6. **Local demo data** comes from a demo SQL file, `docs/sql/demo-media/lesson-player-modes-demo.sql`, run once on
   the local DB at Checkpoint A. It fills block 33's two columns only when both are `NULL`, so it is idempotent:
   chapters at 0, 10 and 20 s, and six transcript lines within the 30 s video. It changes content only (no
   enrollment, progress or attempt). `local-seed-media.sh` also sends the same lists in its tree, so a fresh stack
   gets them through the API.
7. **Focus mode** is remembered per browser in `localStorage` under `lms.lesson.focus`, read and written in
   `try/catch`. It is hidden below `lg`, where the side panel is a drawer.
8. **Current chapter and line** come from the player's whole-second position and the server's lists: the last item
   whose `startSeconds` ≤ the position. That is display, not a business rule.
9. **Transcript search** filters the lines in the app by a case- and accent-insensitive substring. Nothing is sent
   to the server.

## Phases

### Phase 1: Backend (child session, worktree `~/my-projects/corebanking-academy-player-modes`, branch `feat/lesson-player-modes`) → Checkpoint A

- **B1. Schema.** Upgrade and rollback scripts, the learning baseline, the README entry, the entity fields.
- **B2. Save, read and copy.** `BlockInput` and `LessonBlockView` fields, the validation, the revision copy.
- **B3. Tests and docs.** Integration tests and `docs/api/LEARNING.md`; the demo SQL and the seed script.
- **Checkpoint A (main session):**
  - run the upgrade on the local DB, then the demo SQL; restart :8019 on the branch;
  - `curl` as `hocvien`: the enrollment detail of `DEMO-MEDIA` returns block 33 with both lists;
  - as an admin, the validation errors and the revision copy;
  - `mvn clean test` green.

### Phase 2: App (child session, this checkout) → Checkpoint B

- **F1. Contracts.** `LessonBlockSchema` gains both lists (default `[]`), `BlockInputSchema` gains them as optional;
  fixtures captured from the local backend.
- **F2. Mock and editor.** The mock's seeded video blocks carry the mockup's chapters and transcript; the mock save
  keeps them; the course editor round-trips them.
- **F3. Chapters.** The chapter row under a video block.
- **F4. Transcript.** The collapsible transcript with search.
- **F5. Focus mode.** The top-bar toggle.
- **F6. Docs.** The spec's implementation notes and the migration entries.
- **Checkpoint B (main session):** review each diff, `npm run check`, then the browser on the local stack as
  `hocvien` at 375, 768 and 1280 px, light and dark, keyboard only, beside the mockup on :4320.

## Before merging (the user)

- **Shared DB:** run the upgrade script there **before** merging the backend PR, since merging deploys it and
  `ddl-auto=validate` refuses to start without the columns:

  ```bash
  psql -h <host> -U <user> -d <database> -v ON_ERROR_STOP=1 -f docs/sql/upgrade/2026-11-03-lesson-player-modes.sql
  ```

  The demo SQL is for the local stack only.

- **Order:** merge the backend PR, wait for its deploy, then the app PR.

## Risks

- **Any other client that saves the course tree** without the lists clears them. The app's editor is the only one
  in this repo; the API docs say so.
- **Large transcripts** travel with every course tree and enrollment detail. The limits (2000 lines × 1000
  characters) keep a block under about 2 MB; the demo is a few hundred bytes. A separate endpoint can come later if
  real transcripts are large.
- **The focus toggle** must not hide the outline on a narrow screen where it is a drawer; it is hidden there.
