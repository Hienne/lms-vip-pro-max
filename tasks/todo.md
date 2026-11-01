# Tasks: `learning-leaderboard`

Spec: [SPEC-learning-leaderboard.md](../SPEC-learning-leaderboard.md) · Plan: [plan.md](plan.md).
The previous `learner-scores` checklist, with its success criteria and how each was checked, is in git history at
`cd4b2f1`.

- **Repositories:**
  - backend: `corebanking-academy`, branch `feat/learning-leaderboard`, in its own worktree
    `~/my-projects/corebanking-academy-leaderboard`. Branch from `main` if #17 is merged, else from
    `feat/learner-scores`;
  - app: this one, branch `feat/learning-leaderboard` from `main` after #50 is merged.

  Nothing is pushed.

- **Local stack:**
  - the backend on :8019 is the main session's background task. Never run `mvn` in the worktree it runs from, and
    never start another backend. Message the main session for a restart;
  - **the local DB gets the new table only at Checkpoint A, from the main session.** Until then, test with
    Testcontainers;
  - the app runs on :4200 against `localhost:8019`;
  - accounts: `hocvien` and `hocvien.tichhop` as learners, plus `giangvien` (also a learner);
  - passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, never printed;
  - in the browser, sign in with the one-shot token method, never by typing the password.
- **Never** touch the shared server `103.121.90.119`. No seeding users, no direct edits to progress or attempts.
- Schema rules: an upgrade script, a rollback, the psql command and a README entry. No FK, no business UNIQUE,
  every column commented. Flyway is off and `ddl-auto=validate`.

## Phase 1: Backend

- [x] **B1: Schema: upgrade, rollback, backfill, baseline, README, entity**
  - Acceptance:
    - The table, its index, its rollback and the baseline update, all as described below.
    - The backfill script, as described below.
    - The entity `LearningActivityDay` and its repository.
    - The lesson identity rule for amendment 6, written in a code comment after reading how `source_lesson_id` is
      set on a new revision.
  - The table: `docs/sql/upgrade/2026-11-02-learning-leaderboard.sql` creates `learning_hub.learning_activity_days`:
    - `activity_id` (identity primary key), `user_id varchar(20)`, `activity_date date`,
      `first_source varchar(20)` (`session | block_progress | quiz`), `create_time timestamptz`;
    - index `(user_id, activity_date DESC)`;
    - a comment on the table and on every column;
    - wrapped in `BEGIN/COMMIT` with `lock_timeout`, and safe to run twice (`IF NOT EXISTS`);
    - the rollback drops the index and the table;
    - `docs/sql/learning_hub_learning.sql` (the baseline) gets the same table;
    - `docs/sql/README.md` gets the upgrade row with the psql commands.
  - The backfill: `…-learning-leaderboard-backfill.sql` inserts the distinct local dates (`Asia/Ho_Chi_Minh`) of
    `lesson_progress.update_time` (via the enrollment's `user_id`) and of graded `quiz_attempts.submitted_at`. It
    skips dates that already exist, so it can run twice.
  - Verify: the ITs start on the baseline with `ddl-auto=validate`. A Testcontainers test runs the upgrade, the
    backfill twice (same row count) and the rollback on a baseline without the table.
  - Size: M. Depends on: none.

- [x] **B2: Activity recording on session, block progress and quiz start/submit**
  - Acceptance:
    - `LearningActivityService.record(userId, source)`:
      1. takes the advisory lock `learning-activity:{userId}`;
      2. inserts today's local date if missing.
    - Called after a successful `POST /sessions`, `PUT …/blocks/{blockId}/progress`, quiz start and quiz submit.
      Assessment calls it through the Learning port it already uses.
    - A recording error is logged and never fails the learner's request.
  - Verify:
    - Each of the four calls writes today once; calling twice does not add a row.
    - Two concurrent calls make one row.
    - 23:30 and 00:30 local fall on different dates.
    - A failing recorder still returns success to the learner.
  - Size: M. Depends on: B1.

- [x] **B3: Points: weights, the quiz-pass port method, `GET /points` (L2)**
  - Acceptance: - `app.learning.points.lesson=5`, `quiz-pass=30`, `streak-day=10`, `streak-cap=30` in `application.yml`,
    overridable by environment. - `LearningQuizDirectory.passedQuizCounts(userIds)`: one grouped query. It counts, per user, the distinct
    published, not deleted quizzes with a graded attempt with `passed = true`. - `LearningPointsService` parts: - `lessons` = weight × the distinct completed lessons, by amendment 6's identity; - `quizzes` = weight × the passed quizzes; - `courses` = the sum of the completed revision's `reward_points`, once per course (latest completed cycle); - `streak` = weight × `min(streakDays, cap)`; - `streakDays` counts consecutive local days ending today, or ending yesterday when today has no row. - `GET /api/v1/me/learning/points` returns `MyPoints { total, parts { lessons, quizzes, courses, streak },
streakDays }`, for learners only. - `docs/api/LEARNING.md` gets "Điểm học tập và bảng xếp hạng": the weights, every rule, and the endpoint.
  - Verify:
    - Each part on fixtures, including the same lesson completed in two cycles on two revisions (counted once) and
      a course completed twice (its reward counted once).
    - A streak of today, of yesterday only, with a gap, and over the cap.
    - The port test: failed only, passed twice, an unpublished quiz.
  - Size: M. Depends on: B1.

- [x] **B4: Leaderboard: scopes, tie ranks, `me`, `GET /leaderboard` (L1), docs**
  - Acceptance:
    - `GET /api/v1/me/learning/leaderboard?scope=team|org|all&page&size`: `scope` defaults to `org`, and `size` is
      at most 100.
    - It returns `LeaderboardPage { page: PageResponse<LeaderboardRow>, me: LeaderboardRow }`, where
      `LeaderboardRow { rank, userId, fullName, teamName, points, streakDays, me }`.
    - Who is ranked: the active users eligible to learn, by the rule of `findLearningCandidates`, reused and not
      copied:
      - `team`: the caller's team (none → an empty page, plus `me`);
      - `org`: the caller's org;
      - `all`: everyone (amendment 2).
    - Order: points descending, then name. Ties share a rank and the next rank skips (1, 1, 3). Users with 0 points
      come last, by name.
    - `me` is always present, even when it is off the page.
    - Docs updated.
  - Verify:
    - Each scope's membership.
    - Tie ranks.
    - Zero-point users last.
    - `me` off the page.
    - A non-learner is refused.
    - The timings of the grouped queries on the demo data are written in the commit message.
  - Size: M. Depends on: B2, B3.

### Checkpoint A

- [x] `mvn clean test` green in the worktree: 382 run, 0 failures, 42 skipped (`CommunityApiIT`, untouched).
- [x] Stop for the main session. It:
  - applies the upgrade, then the backfill, to the local DB;
  - restarts :8019 on the branch;
  - checks with `curl` as `hocvien` that L2's parts equal the formula on the local DB (SQL recorded here) and that
    L1 lists `hocvien`, `hocvien.tichhop` and `giangvien` in the `org` scope with the right ranks;
  - opens a lesson and checks that today's row appears once.

  Done 2026-11-01 by the main session:
  - The upgrade applied cleanly. The backfill inserted 5 rows, and a second run inserted 0.
  - L2 equals the SQL below for all three learners. Weights 5 / 30 / 10, cap 30:

    | user              | lessons | quizzes | courses | streak (days) | total |
    | ----------------- | ------- | ------- | ------- | ------------- | ----- |
    | `hocvien.tichhop` | 40      | 30      | 0       | 20 (2)        | 90    |
    | `hocvien`         | 30      | 30      | 0       | 20 (2)        | 80    |
    | `giangvien`       | 20      | 0       | 0       | 10 (1)        | 30    |

    Every local `reward_points` is 0, so `courses` is checked only by the ITs.

  - L1 as `hocvien`:
    - `team` lists only `hocvien`, rank 1;
    - `org` and `all` list `hocvien.tichhop` 1, `hocvien` 2 (`me: true`), `giangvien` 3;
    - `page=2&size=1` returns `giangvien` with `me.rank` 2.
  - Refusals:
    - `scope=x` and `size=101` return `CORE-VALIDATION_FAILED`;
    - `quantri` is refused with `CORE-ACCESS_DENIED`.
  - Activity: `hocvien` already had today from the backfill, so the check used `giangvien` (last day 31/10). Two
    `POST /sessions` wrote one row for 2026-11-01 (`session`), and the streak went from 1 to 2 days (L2 30 → 40).
  - SQL: the four part queries and the "who is ranked" query, as written in the child's Checkpoint A note. They are
    the same as the queries in `LearningPointsRepository` with the user fixed, plus a recursive CTE for the streak.

- [ ] The backend PR is opened only when the user asks. Its first line tells the user to run the upgrade on the
      shared DB before merging.

## Phase 2: App

- [ ] **F1: Contracts, captured responses, mock**
  - Acceptance:
    - `learnerEndpoints.leaderboard` (L1) and `learnerEndpoints.myPoints` (L2), with their schemas;
    - responses captured from :8019 as `hocvien`;
    - the mock serves both from a seed with a tie and a zero-point learner.
  - Verify: the contracts and mocks specs are green.
  - Size: S. Depends on: Checkpoint A.

- [ ] **F2: `/leaderboard` screen and store**
  - Acceptance:
    - `features/achievements/leaderboard`, wired in `screens.ts`.
    - Title "Bảng xếp hạng & thành tích" and the mockup's description line.
    - `ui-segmented` "Nhóm của tôi / Đơn vị / Toàn hệ thống", with `scope` in the URL and `org` as the default.
    - **"Xếp hạng" with "{n} học viên":** an ordered list. Each row shows the rank, the name, "{team} · chuỗi
      {n} ngày" and the points. The caller's row has the selected-row token, `aria-current="true"` and "(bạn)".
      There are pages, and a "Vị trí của bạn" row when `me` is off the page.
    - **Side card:** `{total}`, "Điểm thưởng của bạn · hạng {me.rank}", and the four parts as "+{n}".
    - Loading, error-with-retry and empty states for each read.
    - No badges, avatars, icon tiles or top-3 decoration.
  - Verify:
    - The store spec: scope ↔ query and URL.
    - The page spec: rows, the marked row, the "Vị trí của bạn" row, the parts card and the three states.
    - `npx nx test lms` is green.
  - Size: M. Depends on: F1.

- [ ] **F3: Learn page "Điểm thưởng" figure**
  - Acceptance:
    - The learn store reads L2.
    - A figure follows the score figures in the same style: "Điểm thưởng", `{total}`, "Chuỗi {n} ngày", linking to
      `/leaderboard`.
    - A failed read hides only this figure.
  - Verify: the learn spec with points, with zero and with an error.
  - Size: S. Depends on: F1.

- [ ] **F4: End-to-end check against the spec**
  - Acceptance: the success criteria below are written here, each with how it was checked.
  - Verify:
    - Run `npm run check`.
    - The main session does the browser checks:
      - as `hocvien`, all three scopes at 1280 px light and 375 px dark, matching `curl`;
      - the learn figure.
  - Size: S. Depends on: F2, F3.

### Checkpoint B

- [ ] Success criteria recorded:
  1. `/leaderboard` shows the three scopes with the right membership, ranked by the server's totals, with the
     caller's row marked.
  2. The points card equals L2, and each part equals the formula on the local DB (SQL recorded).
  3. Opening a lesson writes today's activity once. The streak counts it.
  4. The upgrade, the backfill and the rollback apply cleanly. `mvn clean test` and `npm run check` are green, and
     the visual-design checklist passes.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan `lesson-notes`.
