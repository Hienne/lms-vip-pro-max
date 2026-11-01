# Spec: `lesson-notes`

Map: [SPEC.md](SPEC.md). Status: **built 2026-11-01** (amended by the plan, see "Amendments"; results in `tasks/todo.md` Checkpoint B). Depends on
`catalog-discovery` (D4 gives course and lesson titles from one call) and `local-stack` (READY PDF and video blocks).

## Amendments

Written with [tasks/plan.md](tasks/plan.md) on 2026-11-01. Where they differ from the sections below, they win.

1. **Errors use the existing codes:**
   - `LEARNING-NOT_FOUND` for a lesson outside the caller's enrollments, and for another user's, a missing or a
     deleted note or bookmark;
   - `LEARNING-INVALID_REFERENCE` for a wrong block or an anchor beyond the asset's bounds;
   - `CORE-VALIDATION_FAILED` for blank or too long text.

   The only new code is `LEARNING-NOTE_LIMIT`.

2. **Access:** the lesson belongs to the revision of one of the caller's enrollments, whatever its status. A note
   stays on the lesson and block it was written on.
3. **Video anchors are whole seconds** (`video_second integer`), so the bookmark toggle can compare them.
4. **Bookmarks on PDF and video:**
   - "Đánh dấu trang này" in the PDF toolbar;
   - "Đánh dấu mốc {m:ss}" under the video;
   - both with `aria-pressed`;
   - the default label "{block title} — trang {n}" or "{block title} — {m:ss}".
5. **N7 `DELETE /bookmarks/{bookmarkId}`** for the saved page's delete.
6. **N6 takes only `kind`, `page` and `size`**, as the mockup's saved page has no search or filter.
7. **Anchor URL:**
   - `/lesson/{courseId}/{lessonId}?block={id}&page={n}` or `…&t={s}`;
   - read by the lesson store on entry;
   - invalid values are ignored.
8. **The saved page has no icon tiles.** Each row shows the text or label, then "{lesson} · Trang n | Video m:ss ·
   {time}". Deleting asks first.
9. **The notes panel lists the bookmarks under the notes.** The Ghi chú tab shows the note count.
10. **The upgrade is `2026-11-03-lesson-notes.sql`**, and it runs on the shared DB before the backend PR is merged.

Open questions keep their defaults:

- there is no note editing;
- Đã lưu does not save courses;
- notes do not follow a newer revision;
- writing a note is not a learning day.

## Objective

The mockup lesson page (`lesson.js`) has two side tabs, Mục lục and Ghi chú, plus a bookmark control:

- A learner writes a **note** tied to where they are: a PDF page, a video time, or the lesson as a whole. They see
  the lesson's notes in the Ghi chú tab, newest first. Clicking a note's anchor jumps the PDF or the video there.
  Deleting a note removes it.
- A learner **bookmarks** the current PDF page or video time with an optional label. The control toggles: pressing
  it again on the same anchor removes the bookmark.
- The **"Đã lưu & ghi chú"** page (`saved`, `tools.js`) lists all of the caller's notes and bookmarks across
  courses. It has the tabs Ghi chú / Đánh dấu with counts. Each row links to the lesson at its anchor.

The app already has the `saved` screen and `personal` contracts on mock paths (`/api/me/notes`, `/api/me/bookmarks`,
`/api/me/saved`). The backend has none of this. The Trợ lý AI tab is out of scope.

## Backend (`corebanking-academy`, module `learning`)

### Endpoints (`LearningNotesController`, `/api/v1/me/learning`)

| #   | Endpoint                            | Body / query                                                                | Response                                                                                                                   |
| --- | ----------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| N1  | `GET /lessons/{lessonId}/notes`     | —                                                                           | `List<NoteView>`, newest first                                                                                             |
| N2  | `POST /lessons/{lessonId}/notes`    | `{ blockId?, anchorType: none\|pdf\|video, pdfPage?, videoSeconds?, text }` | `NoteView`                                                                                                                 |
| N3  | `DELETE /notes/{noteId}`            | —                                                                           | `null`; another user's note → `LEARNING-NOTE_NOT_FOUND`                                                                    |
| N4  | `GET /lessons/{lessonId}/bookmarks` | —                                                                           | `List<BookmarkView>`                                                                                                       |
| N5  | `PUT /lessons/{lessonId}/bookmarks` | `{ blockId, anchorType: pdf\|video, pdfPage?, videoSeconds?, label? }`      | `{ saved: boolean, bookmark?: BookmarkView }`. This toggles: an existing bookmark at the same block and anchor is removed. |
| N6  | `GET /saved`                        | `kind=notes\|bookmarks`, `q?`, `courseId?`, `page`, `size`                  | `Page<SavedItemView>` plus `counts { notes, bookmarks }`                                                                   |

- `NoteView` has: `id`, `lessonId`, `blockId`, `anchorType`, `pdfPage`, `videoSeconds`, `text`, `createTime`.
- `BookmarkView` has the same fields, with `label` in place of `text`.
- `SavedItemView` adds: `courseId`, `courseTitle`, `lessonTitle`, `kind`.

**Rules (service):**

- **Access.** The caller must have a current enrollment whose revision contains the lesson. Otherwise the
  response is `LEARNING-LESSON_NOT_FOUND`, the same as reading the lesson.
- **Block.** `blockId` must belong to the lesson. The block must be `pdf` for a page anchor, or `video` for a time
  anchor.
- **PDF page.** `pdfPage` must be between 1 and the asset's `page_count`.
- **Video time.** `videoSeconds` must be between 0 and the asset's `duration_seconds`. It is stored as
  `numeric(12,3)`.
- **Note text.** Trimmed, 1–4000 characters. A blank note is `LEARNING-NOTE_INVALID`.
- **Bookmark label.** At most 200 characters.
- **Limits.** At most 500 notes and 500 bookmarks per user per lesson. Beyond that the response is
  `LEARNING-NOTE_LIMIT`.
- **Uniqueness.** "One bookmark per user, block and anchor" is checked in the service under the user's advisory
  lock, as the guidelines ask. It is not a `UNIQUE` index.
- **Deleting.** A delete is soft (`is_deleted`), so the audit trail stays.

### DB upgrade `docs/sql/upgrade/2026-11-xx-lesson-notes.sql`

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS learning_hub.lesson_notes (
    note_id        bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id        varchar(20)   NOT NULL,
    lesson_id      bigint        NOT NULL,
    block_id       bigint,
    anchor_type    varchar(10)   NOT NULL,
    pdf_page       integer,
    video_seconds  numeric(12,3),
    body           text          NOT NULL,
    is_deleted     boolean       NOT NULL DEFAULT false,
    created_by     varchar(20)   NOT NULL,
    updated_by     varchar(20)   NOT NULL,
    row_version    bigint        NOT NULL DEFAULT 0,
    create_time    timestamptz   NOT NULL DEFAULT now(),
    update_time    timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT ck_lesson_notes_anchor CHECK (
        (anchor_type = 'none'  AND pdf_page IS NULL AND video_seconds IS NULL) OR
        (anchor_type = 'pdf'   AND pdf_page IS NOT NULL AND video_seconds IS NULL AND block_id IS NOT NULL) OR
        (anchor_type = 'video' AND video_seconds IS NOT NULL AND pdf_page IS NULL AND block_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS learning_hub.lesson_bookmarks (
    bookmark_id    bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id        varchar(20)   NOT NULL,
    lesson_id      bigint        NOT NULL,
    block_id       bigint        NOT NULL,
    anchor_type    varchar(10)   NOT NULL,
    pdf_page       integer,
    video_seconds  numeric(12,3),
    label          varchar(200),
    is_deleted     boolean       NOT NULL DEFAULT false,
    created_by     varchar(20)   NOT NULL,
    updated_by     varchar(20)   NOT NULL,
    row_version    bigint        NOT NULL DEFAULT 0,
    create_time    timestamptz   NOT NULL DEFAULT now(),
    update_time    timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_lesson
    ON learning_hub.lesson_notes (user_id, lesson_id, create_time DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_lesson_bookmarks_user_lesson
    ON learning_hub.lesson_bookmarks (user_id, lesson_id) WHERE NOT is_deleted;
-- COMMENT ON TABLE / COLUMN for every table and column, in Vietnamese, as in the baselines.
COMMIT;
```

- **Indexes.** Both serve N1, N4 and N6, which always filter on `user_id`.
- **CHECK constraint.** It only checks that each row's anchor fields are consistent with each other. It is not a
  business uniqueness rule, so it stays within the "no business UNIQUE" convention.
- **Rollback.** `DROP TABLE IF EXISTS` for both tables, after printing their row counts.
- **Baseline.** The two tables are also added to `learning_hub_learning.sql`, and the README gets the `psql` lines.

Docs: a "Ghi chú và đánh dấu" section in `docs/api/LEARNING.md`.

## App

### Contracts (`libs/contracts/src/lib/personal`)

Endpoints are re-pointed to N1–N6, and `served: 'mock'` is removed:

- `lessonNotes`, `addNote`, `deleteNote`
- `lessonBookmarks`, `toggleBookmark`
- `saved`

Schemas follow the backend:

- **Ids.** Numbers (today they are strings).
- **Anchor.** `AnchorSchema` gets a `none` branch and a `blockId`.
- **Saved list.** `SavedPageSchema` keeps `counts`.

The certificate keys stay where they are until `certificates`.

### Screens

| Where                        | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `features/lesson/lesson`     | The side panel becomes tabs Mục lục / Ghi chú (`@angular/aria` tabs, the same in the drawer on narrow screens). The Ghi chú tab has a textarea with "Thêm ghi chú". The anchor is taken from the active block: the PDF block's current page or the video's current time, else none. The note list shows each anchor as a link: "Trang 3", "12:40". Deleting asks for confirmation. A bookmark icon button sits in the PDF and video block toolbars, with `aria-pressed` showing the state. |
| `pdf-block`, `video-block`   | They expose the current page or time, and a `seek(anchor)` input the lesson store drives, so a note link or a `?anchor=` URL jumps there.                                                                                                                                                                                                                                                                                                                                                  |
| `lesson.store.ts`            | Holds the notes and bookmarks of the lesson (`serverData`) and the add, delete and toggle commands (`serverMutation`), which reload the lists. Reads `?block=&page=` / `?block=&t=` on entry.                                                                                                                                                                                                                                                                                              |
| `features/study-tools/saved` | Uses N6. Tabs Ghi chú / Đánh dấu with counts, search, a course filter and paging. A row links to `/lesson/{courseId}/{lessonId}?block=…&page=…`.                                                                                                                                                                                                                                                                                                                                           |

### Mock

`libs/mocks/src/lib/personal` serves the new paths and shapes.

## Testing

- **Backend:**
  - Service tests: access refused outside the caller's enrollment; anchor validation (page beyond
    `page_count`, time beyond `duration_seconds`, wrong block type).
  - The bookmark toggle adds and then removes.
  - Limits.
  - Another user's note → not found.
  - N6 paging and counts.
- **App:**
  - Store specs: add, delete and toggle reload the lists; the anchor is taken from the active block.
  - Component specs: the tab panel, and a note link that seeks.
  - The saved page tabs and links.
  - Schema specs.
- **Local, as `hocvien`:**
  - On the demo PDF, add a note on page 3. On the video, bookmark 0:40.
  - Reload: both are there.
  - Click each: the PDF opens at page 3 and the video seeks to 0:40.
  - Both appear in Đã lưu, and delete and toggle work.
  - Signed in as `hocvien.tichhop`, the same lesson shows none of them.

## Boundaries

- **Always:** anchors are validated on the server against the real asset.
- **Never:** keep notes in `localStorage` as the source of truth.

## Success criteria

1. Notes and bookmarks are created, listed, followed and removed on the local backend for PDF and video blocks,
   with the same results after a reload.
2. They are private: another learner sees none, and a direct `DELETE` of someone else's note returns
   `LEARNING-NOTE_NOT_FOUND`.
3. "Đã lưu & ghi chú" lists both kinds with correct counts, and links open the lesson at the anchor.
4. The upgrade script and its rollback apply cleanly on the local DB. `mvn clean test` and `npm run check` green.
   The visual-design checklist passes for the lesson side panel and the saved page.

## Open questions

1. **Editing notes:** may a learner edit a note? The mockup only adds and deletes. Default: no edit.
2. **Saved courses:** the mockup course page shows a `saved` flag (bookmark on a course). Is "save a course" part
   of Đã lưu? Default: no; Đã lưu holds notes and bookmarks only.
