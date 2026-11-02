# Tasks: `lesson-player-modes`

Spec: [SPEC-lesson-player-modes.md](../SPEC-lesson-player-modes.md) · Plan: [plan.md](plan.md).
The previous `learner-home-refresh` checklist is in git history at `3d16946`.

- **Repositories:**
  - backend: `corebanking-academy`, branch `feat/lesson-player-modes` from `origin/main` (`5563e76`), in its own
    worktree `~/my-projects/corebanking-academy-player-modes`;
  - app: this one, branch `feat/lesson-player-modes` from `origin/main` (`3d16946`).

  Nothing is pushed.

- **Local stack:**
  - The backend on :8019 is the main session's background task. Never run `mvn` in the worktree it runs from, and
    never start another backend. Message the main session for a restart.
  - The app runs on :4200 against `localhost:8019`.
  - Accounts: `hocvien` as the learner; `quantri` as the admin who saves course trees.
  - The demo video is block 33, lesson 17, course `DEMO-MEDIA`, 30 s.
  - Passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, and are never printed.
  - In the browser, sign in with the one-shot token method, never by typing the password.
- **Never** touch the shared server `103.121.90.119`. No seeding users, and no direct edits to enrollments, progress
  or attempts. The only SQL is the upgrade and the demo file, run by the main session at Checkpoint A.
- **Schema change:** two nullable `jsonb` columns on `learning_hub.lesson_blocks`. No FK, no unique, every column
  commented. Backend Javadoc and comments in Vietnamese (`DEVELOPMENT_GUIDELINES.md`).

## Phase 1: Backend

- [ ] **B1: Schema**
  - `docs/sql/upgrade/2026-11-03-lesson-player-modes.sql`: `ADD COLUMN IF NOT EXISTS video_chapters jsonb` and
    `transcript jsonb`, each with a Vietnamese `COMMENT`, in one transaction.
  - `2026-11-03-lesson-player-modes.rollback.sql`: `DROP COLUMN IF EXISTS` both.
  - The learning baseline (`docs/sql/learning_hub_learning.sql`) gets both columns and comments.
  - `docs/sql/README.md`: an entry with the psql command, and that it must run before the backend deploys.
  - `LessonBlock` maps both as `@JdbcTypeCode(SqlTypes.JSON) JsonNode`.
  - Acceptance: `mvn -o clean test` green (the test schema has the columns).
- [ ] **B2: Save, read and copy**
  - `BlockInput` gains `List<VideoChapterInput> videoChapters` and `List<TranscriptLineInput> transcript`
    (nullable); `LessonBlockView` gains both as lists, `[]` when `NULL`.
  - `validateBlockInput` applies plan Decision 5 with `BusinessException.validation`.
  - `writeBlock` stores them (an empty list is stored as `NULL`); the revision copy passes them through.
  - Acceptance: tests below.
- [ ] **B3: Tests, docs and demo data**
  - Integration tests: save with valid lists and read them back in the tree and in the learner's enrollment detail;
    each refusal (count, length, blank, order, beyond the duration, non-video block); a new revision keeps them; a
    save without the lists clears them (documented behaviour).
  - `docs/api/LEARNING.md`: the block fields, the limits, and that a tree save replaces them.
  - `docs/sql/demo-media/lesson-player-modes-demo.sql`: plan Decision 6, idempotent, local only.
  - `scripts/local-seed-media.sh`: the video block of a fresh `DEMO-MEDIA` gets the same lists.
  - Acceptance: `mvn -o clean test` green.

### Checkpoint A

- [ ] The main session runs the upgrade and the demo SQL on the local DB and restarts :8019 on the branch.
- [ ] `curl`: block 33 has both lists for `hocvien`; the refusals and the revision copy behave as specified.
- [ ] `mvn clean test` green. The responses are recorded here. The app child starts Phase 2.

## Phase 2: App

- [ ] **F1: Contracts**
  - `VideoChapterSchema {startSeconds, title}` and `TranscriptLineSchema {startSeconds, text}`;
    `LessonBlockSchema` gains `videoChapters` and `transcript` with `.default([])`; `BlockInputSchema` gains both as
    optional.
  - Fixtures captured from the local backend.
  - Acceptance: `npx nx test contracts` green.
- [ ] **F2: Mock and editor**
  - The mock's seeded video blocks carry the mockup's chapters and transcript (`lms-mockup/src/data/seed.js`); the
    mock tree save stores and returns them.
  - `course-draft.ts` keeps each loaded video block's lists in the save payload; a new block has none.
  - Acceptance: specs for the mock round trip and for an editor save that keeps the lists.
- [ ] **F3: Chapters**
  - Under a video block with chapters: a row of buttons "{mm:ss} · {title}"; a click sets the block's `jump`; the
    current chapter has `aria-current="true"`.
  - Acceptance: specs for the seek and the current chapter following the time.
- [ ] **F4: Transcript**
  - Under a video block with lines: a collapsible "Transcript ({n} đoạn)", closed by default; a search field
    ("Tìm trong transcript"); each line a button "{mm:ss} {text}" that seeks; the current line marked without
    scrolling the page; "Không có đoạn nào khớp." when the search finds nothing.
  - Acceptance: specs for search, seek and the current line.
- [ ] **F5: Focus mode**
  - A top-bar button "Chế độ tập trung" / "Hiện mục lục" with `aria-pressed`; it hides the side panel from `lg` and
    is hidden below `lg`; remembered under `lms.lesson.focus` in `try/catch`.
  - Acceptance: specs for the toggle, the label, `aria-pressed`, and storage that throws.
- [ ] **F6: Docs**
  - `SPEC-lesson-player-modes.md`: implementation notes; migration entries for the lesson screen.
  - Acceptance: `npm run check` green.

### Checkpoint B

- [ ] Main-session review of each commit's diff against angular.md §14 and visual-design.md.
- [ ] `npm run check` green.
- [ ] Browser on the local stack as `hocvien`, lesson 17: chapters and transcript from the backend; a click on
      either seeks; search filters; focus mode hides the outline and survives a reload.
- [ ] 375, 768 and 1280 px, light and dark, keyboard only, beside the mockup on :4320.
- [ ] The spec is marked built.
