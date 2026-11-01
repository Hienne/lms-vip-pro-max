# Tasks: `lesson-notes`

Spec: [SPEC-lesson-notes.md](../SPEC-lesson-notes.md) · Plan: [plan.md](plan.md).
The previous `learning-leaderboard` checklist, with its success criteria and how each was checked, is in git history
at `a04912c`.

- **Repositories:**
  - backend: `corebanking-academy`, branch `feat/lesson-notes` from `origin/main` (`214d768`, #18 merged), in its own
    worktree `~/my-projects/corebanking-academy-notes`;
  - app: this one, branch `feat/lesson-notes` from `origin/main` (#51 merged).

  Nothing is pushed.

- **Local stack:**
  - the backend on :8019 is the main session's background task. It runs from
    `~/my-projects/corebanking-academy-leaderboard`. Never run `mvn` in the worktree it runs from, and never start
    another backend. Message the main session for a restart;
  - **the local DB gets the new tables only at Checkpoint A, from the main session.** Until then, test with
    Testcontainers;
  - the app runs on :4200 against `localhost:8019`;
  - accounts: `hocvien` and `hocvien.tichhop` as learners;
  - demo data: PDF block 32 (lesson 16, 4 pages) and video block 33 (lesson 17, 30 s), in "Demo tài liệu PDF và
    video";
  - passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, never printed;
  - in the browser, sign in with the one-shot token method, never by typing the password.
- **Never** touch the shared server `103.121.90.119`. No seeding users, no direct edits to progress or attempts.
- Schema rules: an upgrade script, a rollback, the psql command and a README entry. No FK, no business UNIQUE,
  every column commented. Flyway is off and `ddl-auto=validate`.

## Phase 1: Backend

- [x] **B1: Schema, entities and repositories**
  - Acceptance:
    - `docs/sql/upgrade/2026-11-03-lesson-notes.sql` creates `learning_hub.lesson_notes` and
      `learning_hub.lesson_bookmarks`, as in the spec with amendment 3 (`video_second integer` in place of
      `video_seconds numeric`). It has:
      - the audit columns;
      - the anchor CHECK on both tables;
      - the two partial indexes;
      - a comment on each table and column;
      - `BEGIN/COMMIT` with `lock_timeout`, and is safe to run twice.
    - A rollback prints both row counts, then drops both tables.
    - The baseline `learning_hub_learning.sql` gets both tables. `docs/sql/README.md` gets the upgrade row with the
      psql commands.
    - Entities `LessonNote` and `LessonBookmark`, and their repositories.
  - Verify:
    - The ITs start on the baseline with `ddl-auto=validate`.
    - A Testcontainers test runs the upgrade twice, then the rollback, on a baseline without the tables.
    - The CHECK refuses a `pdf` row without `block_id`.
  - Size: M. Depends on: none.

- [x] **B2: Notes N1–N3**
  - Acceptance:
    - `LearningNotesController` under `/api/v1/me/learning`, for learners only:
      - N1 `GET /lessons/{lessonId}/notes` → `List<NoteView>`, newest first;
      - N2 `POST /lessons/{lessonId}/notes` with `{ anchor: { type: none|pdf|video, blockId?, page?, second? }, text }`
        → `NoteView`;
      - N3 `DELETE /notes/{noteId}` → `null`.
    - `NoteView { id, lessonId, anchor, text, createTime }`.
    - **Access (amendment 2):** one query resolves the lesson's revision and checks it against the caller's
      enrollments; otherwise `LEARNING-NOT_FOUND`.
    - **Anchor validation** against the block and its asset; otherwise `LEARNING-INVALID_REFERENCE`:
      - `pdf`: a `pdf` block of the lesson, with `1 ≤ page ≤ page_count`;
      - `video`: a `video` block of the lesson, with `0 ≤ second ≤ floor(duration_seconds)`;
      - a null bound refuses the anchor type.
    - **Text:** trimmed, 1–4000 characters, else `CORE-VALIDATION_FAILED`.
    - **Limit:** more than 500 live notes on the lesson → the new `LEARNING-NOTE_LIMIT`.
    - **Delete:** soft. Another user's note, a missing note and a deleted note are all `LEARNING-NOT_FOUND`.
  - Verify: ITs for:
    - the access refusal (another learner's enrollment, a lesson of a course with no enrollment);
    - each anchor rule, including the bounds and the wrong block type;
    - blank and 4001-character text;
    - the limit;
    - the delete, a second delete, and another user's note;
    - a non-learner is refused.
  - Size: M. Depends on: B1.

- [x] **B3: Bookmarks N4, N5 and N7**
  - Acceptance:
    - N4 `GET /lessons/{lessonId}/bookmarks` → `List<BookmarkView>`, newest first.
    - N5 `PUT /lessons/{lessonId}/bookmarks` with `{ anchor (pdf | video), label? }`:
      - under the advisory lock `lesson-bookmark:{userId}`, a live bookmark with the same block and anchor is
        soft-deleted (`{ saved: false }`);
      - otherwise one is inserted (`{ saved: true, bookmark }`).
    - N7 `DELETE /bookmarks/{bookmarkId}` → `null`, with the same rules as N3.
    - `BookmarkView { id, lessonId, anchor, label, createTime }`. The label is at most 200 characters.
    - Same access, anchor, limit (500) and not-found rules as B2.
  - Verify: ITs for:
    - toggle on, then off, then on again;
    - two concurrent toggles from one user end in a consistent state (one live row or none);
    - a `none` anchor refused;
    - N7 on another user's bookmark → `NOT_FOUND`.
  - Size: M. Depends on: B2.

- [x] **B4: Saved N6 and docs**
  - Acceptance:
    - N6 `GET /saved?kind=notes|bookmarks&page&size`, where `size` is at most 100. It returns
      `{ page: PageResponse<SavedItemView>, counts { notes, bookmarks } }`.
    - `SavedItemView` is the note or bookmark view plus `kind`, `courseId`, `courseTitle`, `lessonTitle`.
    - Live items of the caller only, newest first.
    - `docs/api/LEARNING.md` gets "Ghi chú và đánh dấu": N1–N7, the anchor rules, the limits and the error codes.
  - Verify: ITs for the paging, the counts across both kinds, another user's items absent, and deleted items absent.
  - Size: S. Depends on: B3.

### Checkpoint A

- [x] `mvn clean test` green in the worktree: 408 run, 0 failures, 42 skipped (`CommunityApiIT`, untouched).
- [x] Stop for the main session. It:
  - applies the upgrade to the local DB;
  - restarts :8019 on the branch;
  - checks with `curl` as `hocvien`:
    - a note on page 3 of block 32 is saved;
    - page 5 is refused with `LEARNING-INVALID_REFERENCE`;
    - a bookmark at second 20 of block 33 toggles on, then off, then on;
    - N6 has the right counts;
  - checks as `hocvien.tichhop` that the lists are empty, and that deleting `hocvien`'s note is `LEARNING-NOT_FOUND`.

  Done 2026-11-01 by the main session:
  - The upgrade applied twice on the local DB; the second run only skipped. Each table has 14 columns, and the
    only constraints are its primary key and the anchor CHECK.
  - :8019 runs from `~/my-projects/corebanking-academy-notes`.
  - **Notes, as `hocvien`:**
    - page 3 of block 32 saved;
    - page 5, page 0 and a video anchor on the PDF block → `LEARNING-INVALID_REFERENCE`;
    - blank text → `CORE-VALIDATION_FAILED`;
    - a whole-lesson note and second 12 of block 33 saved;
    - N1 lists the notes newest first.
  - **Bookmarks:**
    - second 20 of block 33 toggled on (id 1), off, on (id 2), labelled "Video giới thiệu — 0:20";
    - page 2 of block 32 labelled "Tài liệu Core Banking — trang 2";
    - second 31 → `LEARNING-INVALID_REFERENCE`;
    - a `none` anchor → `CORE-VALIDATION_FAILED`;
    - block 31 (lesson 15, revision 6, no enrollment) → `LEARNING-NOT_FOUND`, since access is checked first.
  - **N6:** counts `{notes: 3, bookmarks: 2}`. A row carries `kind`, `courseId` 7, the course and lesson titles, and
    the anchor. `size=101` → `CORE-VALIDATION_FAILED`.
  - **As `hocvien.tichhop`:**
    - N6 counts 0 / 0;
    - lesson 16 → `LEARNING-NOT_FOUND` (not enrolled);
    - deleting `hocvien`'s note and bookmark → `LEARNING-NOT_FOUND`.
  - `quantri` → `CORE-ACCESS_DENIED`.
  - **Deletes:** N3 → `null`, and a second N3 → `LEARNING-NOT_FOUND`. After N7 the counts are `{2, 1}`.
  - **SQL:** the deleted rows have `is_deleted = true` and `row_version = 1`, and the live rows are as above.
  - Deviations accepted (from the child's report):
    - a `withdrawn` enrollment loses access, as opening the lesson does;
    - the server sets the default bookmark label;
    - an advisory lock also guards the note limit;
    - the schema is slightly stricter (a `none` note has no block, and bookmarks have a CHECK too);
    - a missing or extra anchor field → `CORE-VALIDATION_FAILED`;
    - an asset that is not `ready` refuses anchors;
    - N6 rows carry both `text` and `label`, with `kind` `note|bookmark`.
  - To fix in Phase 2: the comment on `requireLessonAccess` says "any status", but the query excludes `withdrawn`.

- [ ] The backend PR is opened only when the user asks. Its first line tells the user to run the upgrade on the
      shared DB before merging.

## Phase 2: App

- [ ] **F1: Contracts, captured responses, mock**
  - Acceptance:
    - `personalEndpoints` gets `lessonNotes`, `addNote`, `deleteNote`, `lessonBookmarks`, `toggleBookmark`,
      `deleteBookmark` and `saved`:
      - on the N1–N7 paths;
      - numeric ids;
      - `AnchorSchema` with `none`, `pdf {blockId, page}` and `video {blockId, second}`;
      - `served: 'mock'` removed.
    - The certificate keys stay as they are.
    - Responses captured from :8019 as `hocvien`.
    - The mock serves the new paths from a seed with a PDF note, a video note and a PDF bookmark.
    - The saved store and anything else on the old shapes still compile.
  - Verify: the contracts and mocks specs are green, and the captured responses parse.
  - Size: M. Depends on: Checkpoint A.

- [ ] **F2: Block positions, jumps and the bookmark toggle**
  - Acceptance:
    - `app-pdf-block`:
      - `pageChange` output on every page change, with no dwell; `pageShown` keeps its dwell;
      - a `jump` input `{ value, seq }`;
      - a `bookmarked` input and a `bookmark` output on an icon button "Đánh dấu trang này" in the toolbar, with
        `aria-pressed`.
    - `app-video-block`:
      - `secondChange` output when the whole second changes;
      - a `jump` input; the jump is reported through `jumped`, as a learner seek is;
      - a button "Đánh dấu mốc {m:ss}" under the player, with `aria-pressed`.
    - Both disable the bookmark control while a toggle runs (a `busy` input).
  - Verify: the block specs cover each output, a jump to the same value twice, the pressed state, and the video
    jump emitting `jumped`.
  - Size: M. Depends on: F1.

- [ ] **F3: Lesson side panel and the notes panel**
  - Acceptance:
    - **Side panel:** `ui-tabs` "Mục lục" / "Ghi chú ({n})", the same in the `aside` and in the drawer.
    - **`app-lesson-notes`:**
      - a form "Ghi chú tại {Trang n | Video m:ss | bài học}" with a textarea and "Lưu ghi chú";
      - the notes, newest first, each with its anchor as a button ("Trang n", "Video m:ss") and a delete that asks
        "Xóa ghi chú?" / "Ghi chú sẽ bị xóa vĩnh viễn.";
      - then the bookmarks, each with its anchor and label;
      - the mockup's empty line;
      - loading, error-with-retry and empty states.
    - **`LessonStore`:**
      - the current anchor;
      - the notes and bookmarks of the lesson;
      - `addNote`, `deleteNote`, `toggleBookmark`, `followAnchor`;
      - on entry, the `?block=&page=` / `?block=&t=` URL (amendment 7).
    - Mutations reload the lists and signal `LearningChanges.saved`.
    - No icon tiles and no badges.
  - Verify:
    - Store specs: the anchor follows the active block; add, delete and toggle reload; following an anchor on another
      block selects it and then jumps; the URL entry; an invalid URL is ignored.
    - Page spec: the tabs, the form label, the list and the confirm.
  - Size: L. Depends on: F2.

- [ ] **F4: Saved page on N6**
  - Acceptance:
    - `SavedStore` reads N6 with `kind`, `page` and `size`.
    - Rows follow amendment 8: no icon tiles; the text (note) or the label (bookmark); then
      "{lesson} · Trang n | Video m:ss · {relative time}".
    - The row links to the lesson with the amendment 7 URL.
    - The delete uses N3 or N7 by kind, after a confirm.
    - The tab counts come from `counts`.
    - Loading, error-with-retry and empty states.
  - Verify: the saved spec covers both tabs, the counts, the link URLs, the confirm and delete, and the three states.
  - Size: M. Depends on: F1.

- [ ] **F5: End-to-end check against the spec**
  - Acceptance: the success criteria below are written here, each with how it was checked.
  - Verify:
    - Run `npm run check`.
    - The main session does the browser checks:
      - as `hocvien`, at 1280 px light and 375 px dark;
      - a note on page 3 of PDF block 32 and a bookmark at 0:20 on video block 33;
      - reload;
      - follow both anchors, from the panel and from Đã lưu;
      - delete and untoggle;
      - as `hocvien.tichhop`, none of them.
  - Size: S. Depends on: F3, F4.

### Checkpoint B

- [ ] Success criteria recorded:
  1. Notes and bookmarks are created, listed, followed and removed on the local backend for PDF and video blocks,
     with the same results after a reload.
  2. They are private: another learner sees none, and a direct `DELETE` of someone else's note answers
     `LEARNING-NOT_FOUND`.
  3. "Đã lưu & ghi chú" lists both kinds with the right counts, and its links open the lesson at the anchor.
  4. The upgrade and the rollback apply cleanly. `mvn clean test` and `npm run check` are green, and the
     visual-design checklist passes for the side panel and the saved page.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan `lesson-feedback`.
