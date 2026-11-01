# Implementation Plan: `lesson-notes`

Spec: [SPEC-lesson-notes.md](../SPEC-lesson-notes.md) (approved 2026-11-01, amended below).
Map: [SPEC.md](../SPEC.md). Tasks: [todo.md](todo.md).

This plan replaces the one for `learning-leaderboard`. That plan is done; its PRs are hmhug19/corebanking-academy#18
and Hienne/lms-vip-pro-max#51, and it is in git history at `a04912c`.

## Overview

A learner keeps private notes and bookmarks on the lesson they study, and finds them again later:

- **Lesson page:** the side panel gets two tabs, Mục lục and Ghi chú.
  - Ghi chú has a form "Ghi chú tại {Trang n | Video m:ss}" with "Lưu ghi chú".
  - Below the form are the lesson's notes and bookmarks. Clicking an anchor jumps there; deleting asks first.
  - The PDF and video blocks get a bookmark toggle.
- **"Đã lưu & ghi chú"** (`/saved`, already built on mock data): real data, tabs Ghi chú / Đánh dấu with counts. A row
  opens the lesson at its anchor.

**Backend.** Two new tables, `lesson_notes` and `lesson_bookmarks`, and seven endpoints. This is a schema change, so
the upgrade runs on the shared DB before the backend PR is merged (see "Shared server").

## What was checked while planning (2026-11-01)

**Backend (`corebanking-academy`, `origin/main` at `214d768`, with #18 merged)**

- **No notes or bookmarks.** Nothing in `learning` stores them. Community has its own collections, unrelated.
- **How a learner reads a lesson.** There is no per-lesson endpoint. The app loads
  `GET /me/learning/enrollments/{enrollmentId}`, which returns the enrollment's revision tree. Access is "the
  enrollment is the caller's".
- **Error codes.** `LearningResponseCode` has generic codes: `LEARNING-NOT_FOUND`, `LEARNING-INVALID_REFERENCE`,
  `LEARNING-CONFLICT`. Bean validation answers `CORE-VALIDATION_FAILED`. The spec's `LEARNING-NOTE_NOT_FOUND`,
  `NOTE_INVALID` and `LESSON_NOT_FOUND` do not exist. See amendment 3.
- **Asset bounds.** `assets.page_count` (integer) and `assets.duration_seconds` (`numeric(12,3)`) exist. A block's
  media is `lesson_blocks.media_asset_id`, and `block_assets` links the rest.
- **Revisions.** A new revision copies lessons and blocks with new ids. `source_lesson_id` and `source_block_id` point
  back.

**Local DB**

- PDF block 32 (lesson 16), asset `ready`, 4 pages.
- Video block 33 (lesson 17), asset `ready`, 30 seconds.
- Video block 31 (lesson 15), asset `failed`.
- These are the lessons of "Demo tài liệu PDF và video", in which `hocvien` is enrolled.

**App**

- `personalEndpoints` (`saved`, `addNote`, `deleteNote`, `toggleBookmark`, `deleteBookmark`) are `served: 'mock'` on
  `/api/me/*`.
  - Their ids are strings, and their anchors are `{type: 'pdf', page} | {type: 'video', seconds}`.
  - The certificate keys sit in the same file.
- `features/study-tools/saved` works on the mock. It has tabs, paging and a delete, and builds its links with
  `?anchorType=&page=|seconds=`, which no lesson code reads. Its rows have icon tiles (`saved__icon`), which
  visual-design.md forbids.
- **The lesson page shows one block at a time** (`store.activeBlock$`). Its side panel is "Mục lục" in an `aside`,
  and the same panel in a drawer on narrow screens.
  - `app-pdf-block` emits `pageShown` only after a dwell time.
  - `app-video-block` emits play, pause, a beat every 10 s, and seeks.
  - Neither exposes the current position, nor accepts a jump.
- **The mockup** (`lesson.js`, `viewers.js`, `tools.js`):
  - a bookmark is a PDF page only, with the label "{block title} — trang {n}";
  - "Ghi chú tại {anchor}", "Lưu ghi chú", "Xóa ghi chú?" / "Ghi chú sẽ bị xóa vĩnh viễn.";
  - "Chưa có ghi chú. Ghi chú được gắn với trang PDF hoặc mốc video đang xem.";
  - the saved page has no search, no filter and no paging.

## Amendments to the spec

Written to the spec's "Amendments" section when the plan is approved.

1. **Errors use the existing codes:**
   - a lesson not in any of the caller's enrollments, and another user's (or a deleted) note or bookmark →
     `LEARNING-NOT_FOUND`;
   - a block that is not in the lesson, has the wrong type, or an anchor beyond the asset's bounds →
     `LEARNING-INVALID_REFERENCE`;
   - a blank or too long text → `CORE-VALIDATION_FAILED`.

   One new code: `LEARNING-NOTE_LIMIT`, for more than 500 notes or 500 bookmarks per user per lesson.

2. **Access.** The lesson must belong to the revision of one of the caller's enrollments, whatever its status
   (local statuses: `not_started`, `in_progress`, `completed`). A note stays on the lesson and block it was written on. A new revision does not carry notes over (open question 3).
3. **Video anchors are whole seconds** (`video_second integer`), and the app sends `Math.floor(currentTime)`.
   - The mockup shows `m:ss`.
   - The bookmark toggle compares anchors for equality, which fractional seconds would break.
4. **Bookmarks on PDF and video.** The spec has both; the mockup has PDF only.
   - The PDF toolbar gets an icon button "Đánh dấu trang này".
   - The video block gets a button under the player, "Đánh dấu mốc {m:ss}".
   - Both use `aria-pressed`.
   - The default label is the mockup's: "{block title} — trang {n}" or "{block title} — {m:ss}".
5. **A seventh endpoint, N7 `DELETE /bookmarks/{bookmarkId}`,** for the saved page's delete. The toggle needs the
   anchor, and the saved page should not rebuild it.
6. **N6 keeps the mockup's scope:** `kind`, `page` and `size`, plus `counts`. No `q` and no `courseId` filter.
7. **Anchor URL:**
   - `/lesson/{courseId}/{lessonId}?block={id}&page={n}` or `…&t={s}`;
   - the lesson store reads it on entry, selects the block and opens it there;
   - an unknown block or an out-of-range value is ignored.
8. **The saved page loses its icon tiles.** Each row is the text, then "{lesson} · Trang n | Video m:ss · {relative
   time}". The delete asks first, as on the lesson page.
9. **The notes panel lists the bookmarks too**, under the notes, as the mockup does. The Ghi chú tab shows the
   note count.
10. **The upgrade is dated `2026-11-03`.**
    - It keeps the spec's audit columns and the anchor CHECK.
    - It has no FK and no UNIQUE. "One bookmark per user, block and anchor" is checked in the service under an
      advisory lock.
    - It runs on the shared DB before the backend PR is merged.

## Architecture decisions

**Backend (`learning` module)**

- **One service, `LearningNotesService`, for notes and bookmarks.** They share the access check, the anchor
  validation and the limits. The controller `LearningNotesController` sits under `/api/v1/me/learning`.
- **The access check goes through the enrollment, as reading a lesson does.** Resolve the lesson's revision, then
  check the caller has an enrollment on it. One query, reused by every endpoint.
- **Anchor validation against the real asset:**
  - `pdf` needs a `pdf` block with `1 ≤ page ≤ page_count`;
  - `video` needs a `video` block with `0 ≤ second ≤ floor(duration_seconds)`;
  - `none` needs no block.

  An asset with a null bound refuses that anchor type (`INVALID_REFERENCE`), rather than accepting any value.

- **The toggle (N5) runs under the advisory lock `lesson-bookmark:{userId}`.** It finds a live bookmark with the same
  block and anchor: if there is one, it soft-deletes it and answers `saved: false`; otherwise it inserts one.
- **Deletes are soft** (`is_deleted`, `updated_by`, `row_version`), so the audit trail stays. A second delete of the
  same id answers `NOT_FOUND`.
- **N6 joins Learning's own tables** for `courseId`, `courseTitle` and `lessonTitle`. It is a paged native query per
  kind, newest first, with one count query for both kinds.

**App**

- **Contracts.** `personalEndpoints` gets the real N1–N7 paths, numeric ids, and `AnchorSchema` with
  `{type: 'none'} | {type: 'pdf', blockId, page} | {type: 'video', blockId, second}`. `served: 'mock'` is removed
  from these keys. The certificate keys are untouched.
- **The blocks only report and obey; the store decides.**
  - `app-pdf-block` gains a `pageChange` output (every page change, no dwell).
  - `app-video-block` gains a `secondChange` output (when the whole second changes).
  - Both take a `jump` input `{ value, seq }`; the sequence lets the same anchor be followed twice.
  - Both take a `bookmarked` input and emit `bookmark`.
  - A jump in the video goes through the existing `jumped` path, so the server sees a learner seek as it does today.
- **`LessonStore`:**
  - holds the current anchor, `{blockId, page | second}` of the active block, or `none`;
  - holds the lesson's notes and bookmarks (`serverData` keyed by lesson);
  - has the commands `addNote`, `deleteNote`, `toggleBookmark` and `followAnchor` (`serverMutation`, reloading the
    lists);
  - `followAnchor` on another block selects that block first, then jumps once it is shown.
- **The side panel becomes `ui-tabs`** "Mục lục" / "Ghi chú", the same in the `aside` and in the drawer. The
  notes panel is one component, `app-lesson-notes`, which takes the store's selectors and emits commands.
- **`SavedStore`:**
  - re-pointed to N6;
  - links follow amendment 7;
  - the delete uses N3 or N7 by kind, after a confirm;
  - it keeps the `LearningChanges.saved` signal, so a note added in a lesson refreshes the saved page.

## Shared server

Merging the backend deploys it, and `ddl-auto=validate` refuses to start without the two tables. Order:

1. the user runs `docs/sql/upgrade/2026-11-03-lesson-notes.sql` on the shared DB;
2. merge the backend PR, and wait for the deploy;
3. merge the app PR.

The backend PR's first line says so.

## Task list

Detailed in [todo.md](todo.md).

**Phase 1 (backend)**

- **B1:** schema, entities and repositories.
- **B2:** notes N1–N3.
- **B3:** bookmarks N4, N5 and N7.
- **B4:** saved N6 and docs.
- **Checkpoint A:** the main session applies the upgrade locally and checks with `curl`.

**Phase 2 (app)**

- **F1:** contracts, captured responses, mock.
- **F2:** block positions, jumps and the bookmark toggle.
- **F3:** the lesson side panel and the notes panel.
- **F4:** the saved page.
- **F5:** end-to-end check.
- **Checkpoint B:** the main session checks in the browser.

## Risks and mitigations

| Risk                                                                                               | Mitigation                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| The backend deploys before the upgrade, and fails to start (as #15 did).                           | The upgrade runs on the shared DB first; the PR says so on its first line, and the main session reminds the user.                |
| A jump into the video is reported as a learner seek and changes coverage.                          | It goes through `jumped` as any seek does, and the server already skips seeked-over spans (`SEEK`). A video spec case covers it. |
| Selecting another block, then jumping, races the block's load.                                     | The jump is held in the store and applied as the block's start page or start second, not sent to a block that is not shown.      |
| A note's lesson is no longer in the learner's current revision, so its saved link opens "missing". | Known and accepted (open question 3). The note is still listed and can be deleted.                                               |
| Toggling a bookmark twice quickly.                                                                 | The advisory lock on the server, and the button disabled while the toggle runs.                                                  |

## Open questions (defaults apply unless the user says otherwise)

1. **Editing notes:** no edit, as in the mockup (spec question 1).
2. **Saving a course:** not part of Đã lưu (spec question 2).
3. **Notes across revisions:** a note stays on the lesson it was written on. It is not shown on the copied lesson
   of a newer revision. Following `source_lesson_id` is possible later.
4. **Notes as learning activity:** writing a note does not count as a learning day for the streak.

## Verification

- **Backend:** `mvn clean test`, then Checkpoint A on the local stack.
- **App:** `npm run check`, then Checkpoint B in the browser as `hocvien`:
  - 1280 px light and 375 px dark;
  - a note on page 3 of PDF block 32, and a bookmark at 0:20 on video block 33;
  - reload: both are still there;
  - following each anchor;
  - Đã lưu counts and links;
  - as `hocvien.tichhop`, the same lessons show none of them.
