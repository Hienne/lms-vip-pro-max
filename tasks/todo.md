# Tasks: `lesson-feedback`

Spec: [SPEC-lesson-feedback.md](../SPEC-lesson-feedback.md) · Plan: [plan.md](plan.md).
The previous `lesson-notes` checklist, with its success criteria and how each was checked, is in git history at
`0b964b9`.

- **Repositories:**
  - backend: `corebanking-academy`, branch `feat/lesson-feedback` from `origin/main` (`a8b05ea`, #20 merged), in its
    own worktree `~/my-projects/corebanking-academy-feedback`;
  - app: this one, branch `feat/lesson-feedback` from `origin/main` (`f03b326`, #54 merged).

  Nothing is pushed.

- **Local stack:**
  - the backend on :8019 is the main session's background task. Never run `mvn` in the worktree it runs from, and
    never start another backend. Message the main session for a restart.
  - **The local DB gets the new table only at Checkpoint A, from the main session.** Until then, test with
    Testcontainers.
  - The app runs on :4200 against `localhost:8019`.
  - Accounts: `hocvien` and `hocvien.tichhop` as learners.
  - Demo data:
    - PDF block 32 (lesson 16, 4 pages) and video block 33 (lesson 17, 30 s), in "Demo tài liệu PDF và video"
      (course 7);
    - for the visibility check, a lesson both learners are enrolled in, found at Checkpoint A.
  - Passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, and are never printed.
  - In the browser, sign in with the one-shot token method, never by typing the password.
- **Never** touch the shared server `103.121.90.119`. No seeding users, and no direct edits to progress or attempts.
- **Schema rules:**
  - an upgrade script, a rollback, the psql command and a README entry;
  - no FK, no business UNIQUE, and every column commented;
  - Flyway is off and `ddl-auto=validate`.

## Phase 1: Backend

- [x] **B1: Schema, entity and repository**
  - Acceptance:
    - `docs/sql/upgrade/2026-11-04-lesson-feedback.sql` creates `learning_hub.lesson_feedback` as in the spec, with
      amendment 4:
      - `video_second integer`;
      - `status` null for `rating` / `comment`, and `new | answered | resolved` for `question` / `report`, with a
        CHECK;
      - the notes anchor CHECK, and no anchor on a rating;
      - the two partial indexes;
      - audit columns;
      - a comment on the table and on every column;
      - `BEGIN/COMMIT` with `lock_timeout`, and safe to run twice.
    - The rollback prints the row count, then drops the table.
    - The baseline `learning_hub_learning.sql` gets the table, and `docs/sql/README.md` gets the upgrade row.
    - The entity `LessonFeedback` and its repository.
  - Verify:
    - The ITs start on the baseline with `ddl-auto=validate`.
    - A Testcontainers test runs the upgrade twice, then the rollback.
    - The CHECKs refuse a rating with a body, a comment with stars, and a question without a status.
  - Size: S. Depends on: none.

- [x] **B2: Rating (F2) and the course rating (F5)**
  - Acceptance:
    - The anchor and access checks move from `LearningNotesService` into a shared helper, and the notes ITs stay
      green.
    - F2 `PUT /me/learning/lessons/{lessonId}/rating` with `{ stars }`:
      - stars outside 1–5 → `CORE-VALIDATION_FAILED`;
      - access as for notes, else `LEARNING-NOT_FOUND`;
      - under the advisory lock `lesson-rating:{userId}`, it replaces the live rating or inserts one;
      - it answers `{ average, count, myStars }`, with the average rounded to one decimal.
    - `CourseCard` gains `rating: { average, count } | null`, the course's live ratings over every revision. It is
      set per page by one grouped query beside `withBestScores`, in learner and `MANAGE` modes. `LearnerCourse`
      carries it through the card.
  - Verify: ITs for:
    - rate 4, then 5: one live row, and `myStars` 5;
    - two concurrent `PUT`s from one user: one live row;
    - stars 0 and 6 refused;
    - a lesson outside the enrollments → `NOT_FOUND`;
    - a non-learner → `CORE-ACCESS_DENIED`;
    - the card rating over two lessons and two learners, and null with no ratings;
    - `/courses/{id}` carries the same rating as the catalogue card.
  - Size: M. Depends on: B1.

- [x] **B3: Comments, questions and reports (F3, F1, F4)**
  - Acceptance:
    - F3 `POST /me/learning/lessons/{lessonId}/feedback` with
      `{ kind: comment|question|report, text, anchor }` returns `FeedbackView`:
      - text trimmed, 5–1000 characters, else `CORE-VALIDATION_FAILED` with the mockup's field message;
      - the anchor as for notes, else `LEARNING-INVALID_REFERENCE`;
      - status: null for a comment, `new` for a question or a report;
      - more than 20 sends per user per lesson per learning day (`Asia/Ho_Chi_Minh`), counted under the advisory
        lock `lesson-feedback:{userId}` → the new `LEARNING-FEEDBACK_LIMIT`.
    - F1 `GET /me/learning/lessons/{lessonId}/feedback` returns
      `{ rating: {average, count} | null, myStars | null, comments: PageResponse<CommentView> (first 20), mine: List<FeedbackView> }`:
      - `CommentView { id, authorName, text, anchor, createTime, mine }`, newest first;
      - `mine` holds the caller's questions and reports, newest first.
    - F4 `GET /me/learning/lessons/{lessonId}/comments?page&size` (size at most 100) → `PageResponse<CommentView>`.
    - `FeedbackView { id, kind, text, anchor, status, reply, replyTime, createTime }`.
  - Verify: ITs for:
    - each kind saved with its status;
    - 4 and 1001 characters refused, and 5 and 1000 accepted;
    - a bad anchor refused;
    - the 21st send of the day refused, and the limit holding under concurrent sends;
    - learner B sees A's comment with `mine: false` and A's name, but not A's question or report;
    - the comment paging;
    - access refused outside the enrollments.
  - Size: M. Depends on: B2.

- [x] **B4: Docs**
  - Acceptance:
    - `docs/api/LEARNING.md` gets a "Phản hồi bài học" section: F1–F5, the rules, the limits and the error codes.
    - `LEARNING_CURL.md` gets examples, if the notes added some there.
  - Verify: the doc's examples match the IT payloads.
  - Size: XS. Depends on: B3.

### Checkpoint A

- [x] `mvn clean test` green in the worktree: 429 run, 0 failures, 42 skipped (`CommunityApiIT`, untouched).
- [x] Main session check (2026-11-02):
  - **Upgrade:** applied twice to the local DB (the `core-academy-local` stack); the second run only reports
    "already exists". :8019 now runs from the `feat/lesson-feedback` worktree.
  - **Shared lesson:** both learners hold course 1 revision 1. Lesson 1 is used for the visibility check.
  - **`curl` as `hocvien` (H) and `hocvien.tichhop` (T):**
    - **F2:**
      - H rates 4, then 5: count 1, `myStars` 5. T rates 3: average 4.0, count 2.
      - Stars 0 and 6 return `CORE-VALIDATION_FAILED` on `stars` with "Số sao phải từ 1 đến 5.".
    - **F3:**
      - A comment comes back trimmed with status null. A question and a report come back with status `new`.
      - A pdf p3 anchor (block 32) and a video 12 s anchor (block 33) are stored.
      - " abcd " and 1001 characters fail with the mockup messages. Kind `rating` fails with `CORE-VALIDATION_FAILED`.
      - pdf page 5 returns `LEARNING-INVALID_REFERENCE`.
      - T on lesson 16 (course 7, not enrolled) returns `LEARNING-NOT_FOUND`.
    - **F1:**
      - H sees its comment (`mine: true`, "Học viên tiền gửi Demo") and its question and report.
      - T sees the same comment with `mine: false`, the same average, `myStars` 3, and `mine: []`.
    - **F4:**
      - With size 1, page 0 and page 1 come back newest first, with total 2.
      - Size 101 returns `CORE-VALIDATION_FAILED`.
    - **F5:**
      - `/courses/1` gives `rating {4.0, 2}` for both learners, and the catalogue card matches.
      - `/courses/2` gives null.
    - **Not run live:**
      - the 21st send of the day;
      - concurrent sends and ratings.

      Both are covered by `LearningFeedbackIT` and `LearningRatingIT`, and the build session saw them fail with the
      lock removed.

  - **`EXPLAIN` of the course rating query on the demo DB:** 0.05 ms. With 8 rows the planner picks
    `idx_lesson_feedback_lesson_kind`.

    The query binds `kind` as a parameter. Under a generic prepared plan this cannot match the partial
    `idx_lesson_feedback_course_rating` (`WHERE kind = 'rating'`). **Fix:** write the literal `'rating'` in that
    SQL.

  - **Test rows left for Checkpoint B:**
    - ratings on lesson 1 (H 5, T 3);
    - comments 3 and 6 (H) and one from T;
    - questions 4 and 7, and report 5 (H).

## Phase 2: App

- [ ] **F1: Contracts, captured responses, mock**
  - Acceptance:
    - Endpoints `lessonFeedback`, `rateLesson`, `sendFeedback` and `lessonComments`, with zod schemas that reuse
      the notes `AnchorSchema`.
    - `CourseCardSchema` gains `rating`.
    - Responses captured from the local backend parse.
    - The in-app mock serves F1–F4 with the backend rules (limits, visibility, status) and a small seed. Its cards
      carry `rating`.
  - Verify: the contracts and mocks specs are green, and the captured responses parse.
  - Size: M. Depends on: Checkpoint A.

- [ ] **F2: The "Đánh giá & trao đổi" section**
  - Acceptance:
    - `LessonStore`:
      - `feedback` keyed by lesson;
      - `rate` keeps the latest only;
      - `sendFeedback` sends the current anchor;
      - `moreComments`;
      - each mutation reloads.
    - `app-lesson-feedback` sits after the block and before the quiz section, with the mockup copy listed in the
      plan:
      - **Header:** the average and count, or "Chưa có đánh giá".
      - **Rating:** the row with `ui-rating` and "Đã ghi nhận {n} sao".
      - **Tabs:** `ui-tabs` with the counts.
      - **Form:**
        - the label, help and button for the selected tab;
        - "Gửi kèm vị trí: …" when there is an anchor;
        - the server's field error shown under the textarea;
        - the report confirm before it sends.
      - **Lists:**
        - comments with "Xem thêm nhận xét";
        - your questions with "Chờ trả lời" / "Đã trả lời";
        - your reports with "Chờ xử lý" / "Đã xử lý";
        - each list's empty line.
      - **Toasts:** the rating toast and the send toasts, per amendment 8.
    - Visual design: no icon tiles, badges only for status, one primary button. The report button is the danger
      variant, as in the mockup.
  - Verify: specs for:
    - rating by click and by arrow keys (one saved value);
    - each tab's copy;
    - the anchor line;
    - a validation error;
    - the report confirm (cancel sends nothing);
    - the lists, the status labels and the empty lines;
    - "Xem thêm nhận xét";
    - the error state with retry.
  - Size: L. Depends on: F1.

- [ ] **F3: Course page rating**
  - Acceptance: `course__meta` shows "★ {average} ({count})" with the average formatted to one decimal in
    Vietnamese, and nothing when `rating` is null.
  - Verify: the course spec covers both cases.
  - Size: XS. Depends on: F1.

- [ ] **F4: End-to-end check against the spec**
  - Acceptance: the success criteria below are written here, each with how it was checked.
  - Verify: `npm run check`.
  - Size: S. Depends on: F2, F3.

### Checkpoint B

- [ ] Success criteria recorded:
  1. Rating, comment, question and report work on the local backend, and a reload shows the same state.
  2. Visibility holds across `hocvien` and `hocvien.tichhop`.
  3. The course page shows the course rating, matching `curl` of the card.
  4. The upgrade and the rollback apply cleanly. `mvn clean test` and `npm run check` are green. The
     visual-design checklist passes for the section.
- [ ] Browser check by the main session at 1280 px light and 375 px dark.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan `certificates`.
