# Implementation Plan: `learning-leaderboard`

Spec: [SPEC-learning-leaderboard.md](../SPEC-learning-leaderboard.md) (draft, amended below, waiting for approval).
Map: [SPEC.md](../SPEC.md). Tasks: [todo.md](todo.md).

This plan replaces the one for `learner-scores`. That plan is done; its PRs are hmhug19/corebanking-academy#17 and
Hienne/lms-vip-pro-max#50, and it is in git history at `cd4b2f1`.

## Overview

Learners earn learning points from what they already do, and see where they stand:

- **New page `/leaderboard`, "Bảng xếp hạng & thành tích":**
  - a ranking under three scopes, Nhóm của tôi / Đơn vị / Toàn hệ thống;
  - the caller's row is marked;
  - a card with the caller's points, rank and the four parts.
- **Learn page:** one more figure, "Điểm thưởng" with "Chuỗi n ngày", linking to `/leaderboard`.

**Backend.** The server computes the points on read from progress, quiz passes and course rewards, plus a streak of
learning days. The streak needs **one new table**, `learning_activity_days`. This is the first schema change since
`learner-quiz`, so the deploy order matters (see "Shared server").

## What was checked while planning (2026-11-01)

**Backend (`corebanking-academy`, `main` at `6717718`, with #17 not merged yet)**

- **Course rewards.** `course_completion_rules.reward_points` is stored per revision and never totalled.
- **Lesson progress.**
  - `lesson_progress` is per enrollment (`enrollment_id`, `lesson_id`, `status`, `progress_percent`), and
    `course_enrollments` holds `user_id`, `cycle_no`, `revision_id`, `status`, `completed_at`.
  - A new revision copies its lessons with new ids. `course_lessons.source_lesson_id` points back, so "the same
    lesson across cycles" can be told apart.
- **No record of learning days.** The closest data are `lesson_progress.update_time`, `block_progress` and
  `quiz_attempts.submitted_at`.
- **Quiz passes live in Assessment.** Learning reaches them only through `LearningQuizDirectory`, which #17 extends.
- **Identity.** `learning_hub.users` has `org_id` and `team_id`. `LearningIdentityService` has `Person(id, name,
orgId, teamId)`, `teamNames`, and a learner-eligibility query (`UserRepository.findLearningCandidates`).
- **Community board scope.** The community contribution board ranks only within the caller's org
  (`visibleOrg = actor.orgId`). It has no cross-org view, so the spec's "`all` reuses the community visibility"
  would make `all` the same as `org`. See amendment 2.
- **Advisory locks.** They are already used: `pg_advisory_xact_lock(hashtextextended(:key, 0))` in
  `AssessmentRepository`.
- **Local data.** One org (Ban Quản lý và phát triển Core Banking) and 7 users. `hocvien` is in team 7 "Nhóm BA&QC
  Tiền gửi" and `hocvien.tichhop` in team 11. So locally `org` and `all` show the same people.

**App**

- `core/routing/screens.ts` has `{ path: 'leaderboard', title: 'Bảng xếp hạng', mockupPage: 'leaderboard' }` with no
  screen.
- `ui-segmented` exists (used on `/progress`).
- The learn page shows `app-progress-counts` and `app-score-figures`.

**Mockup** (`tools.js` `leaderboard`, `api/core.js` `points` / `streak`, `api/learner.js` `leaderboard`)

- **Header and scopes.**
  - Title "Bảng xếp hạng & thành tích".
  - Description: "Điểm thưởng tính tự động từ bài học hoàn thành, bài kiểm tra đạt, khóa học hoàn thành và chuỗi
    ngày học."
  - Segmented "Nhóm của tôi / Đơn vị / Toàn hệ thống", default "Đơn vị".
- **Ranking card** "Xếp hạng" with "{n} học viên". Each row shows the rank, the name, "Bạn" on the caller's own
  row, "{nhóm} · chuỗi {n} ngày", and the points.
- **Side card.**
  - "{total}" with "Điểm thưởng của bạn · hạng {rank in the current scope}".
  - Four lines: "Bài học hoàn thành", "Bài kiểm tra đạt", "Khóa học hoàn thành", "Chuỗi ngày học", each "+{points}".
- **Out of scope (spec):** the decorations (mai icons, avatars, highlighted top 3), "Mốc ghi nhận" and "Huy hiệu".
- **Rules.**
  - The weights are `lesson 5`, `quizPass 30`, `streakDay 10`.
  - Courses earn their own `rewardPoints`.
  - The streak counts consecutive days ending today, capped at 30 for points.

## Spec amendments (written into the spec with this plan)

1. **Labels from the mockup.** "Bảng xếp hạng & thành tích", "Toàn hệ thống" (not "Toàn bộ"), "Xếp hạng" with
   "{n} học viên", and the four part labels above. The default scope is `org` ("Đơn vị").
2. **What `all` means** (open question 1).
   - Default: every active, learning-eligible user in the system, as the mockup's "Toàn hệ thống".
   - The community board cannot be the model, because it has no cross-org view.
   - The alternative is that `all` shows only the caller's own rank and total, with no other names.
3. **Who is ranked.** Active users who are eligible to learn, by the same rule as `findLearningCandidates`, which
   is reused and not copied.
   - `team`: the caller's team. With no team, the page is empty, plus the caller's own row.
   - `org`: the caller's org.
   - `all`: as amendment 2.
4. **The rank lives in L1, not L2.**
   - L2 `MyPoints` is `{ total, parts { lessons, quizzes, courses, streak }, streakDays }`.
   - The side card's "hạng n" is `me.rank` from L1 for the selected scope, as in the mockup.
5. **Points are computed per scope in the service.** One grouped query per part over the scope's users (lessons,
   courses, activity days), plus one port call for quiz passes. The service sums, sorts, assigns tie ranks and
   pages. The quiz part cannot be summed in Learning's SQL, because Learning must not read Assessment tables.
   Timings on the demo data are recorded at Checkpoint A.
6. **Lessons counted once per user across cycles and revisions.** The lesson's identity is its original lesson,
   found by following `source_lesson_id`. B1 records how the copy chain works: whether it points to the original or
   to the previous copy.
7. **The learn page gets the points figure** (open question 2's default). It is a third figure next to the score
   figures: "Điểm thưởng", `{total}`, "Chuỗi {n} ngày", linking to `/leaderboard`. There is no hero.
8. **Marking the caller's row.**
   - The row uses the selected-row token and `aria-current="true"`, and its name is followed by a quiet "(bạn)".
   - There is no "Bạn" badge, no avatars and no top-3 decoration (visual-design.md).
   - When the caller's row is off the current page, a "Vị trí của bạn" row follows the list.
9. **Audit columns.** `learning_activity_days` has no `created_by` / `row_version`: the system writes it, it is
   append-only, and it is never edited (open question 3's default). Every column is commented. There is no FK and no
   UNIQUE; "one row per user per day" is checked in the service under an advisory lock keyed on the user.

## Architecture decisions

**Backend**

- **Activity recording.**
  - One Learning service, `LearningActivityService.record(userId, source)`, does this:
    1. take `pg_advisory_xact_lock` on `learning-activity:{userId}`;
    2. check today's row (`Asia/Ho_Chi_Minh`);
    3. insert it if missing.
  - It runs inside the caller's transaction. A failure to record must not fail the learner's action, so record
    runs after the main write, and its errors are logged.
  - Callers:
    - `POST /sessions`;
    - `PUT …/blocks/{blockId}/progress`;
    - a quiz start or submit, through a new method on the existing Learning port that Assessment already calls
      (`requireStudyingLearner`'s service).
- **Points.** `LearningPointsService`:
  - computes `MyPoints` for one user and `LeaderboardPage` for a scope;
  - takes its weights from `app.learning.points.{lesson,quiz-pass,streak-day,streak-cap}` in `application.yml`,
    overridable by environment.
- **Port.** `LearningQuizDirectory.passedQuizCounts(Collection<String> userIds)` returns, per user, the number of
  distinct published, not deleted quizzes with a graded attempt where `passed = true`. It is one grouped query.
- **Endpoints.** `LearningLeaderboardController` under `/api/v1/me/learning`:
  - `GET /leaderboard?scope=team|org|all&page&size` (size ≤ 100) returns `PageResponse<LeaderboardRow>` plus
    `me`. Because the base envelope is a page, the response is `LeaderboardPage { page: PageResponse, me }`.
  - `GET /points`.
  - Both require a learner.

**Schema** (follows the backend's DB rules)

- `docs/sql/upgrade/2026-11-02-learning-leaderboard.sql` creates the table and the index, with every column
  commented. Its rollback drops them.
- `…-backfill.sql` (optional) inserts one day per distinct local date of `lesson_progress.update_time` and graded
  `quiz_attempts.submitted_at` per user. It skips days that already exist, so it can run twice.
- The learning baseline gains the table, so Testcontainers ITs and new DBs have it. `docs/sql/README.md` gets the
  upgrade row and its psql commands.

**Shared server** (learned from #15 on 2026-11-01)

- `ddl-auto=validate` refuses to start without the table. So **the user runs the upgrade script on the shared DB
  before the backend PR is merged**. The PR description says so in its first line.
- Running the backfill there is the user's choice.

**Working tree and process**

- The backend child works in a new worktree, `~/my-projects/corebanking-academy-leaderboard`, on
  `feat/learning-leaderboard`.
  - It branches from `main` if #17 is merged by then; otherwise from `feat/learner-scores`, and it rebases once #17
    is merged.
  - It never runs `mvn` in a worktree that the local backend runs from.
- **Local DB.** The main session applies the upgrade (and the backfill) to the local DB at Checkpoint A. That is the
  only local DB change. Before that, the child tests with Testcontainers only.
- The app work goes on a new branch, `feat/learning-leaderboard`, from `main` after #50 is merged. Plan files are
  committed there.
- One commit per task. Nothing is pushed. PRs are opened when the user asks.

## Task list

### Phase 1: Backend (`corebanking-academy`)

- [ ] B1: Schema: upgrade, rollback, backfill, baseline, README, entity
- [ ] B2: Activity recording on session, block progress and quiz start/submit
- [ ] B3: Points: weights, the quiz-pass port method, `GET /points` (L2)
- [ ] B4: Leaderboard: scopes, tie ranks, `me`, `GET /leaderboard` (L1), docs

### Checkpoint A

- [ ] `mvn clean test` green in the worktree.
- [ ] The main session applies the upgrade and backfill to the local DB, restarts :8019 on the branch, and checks
      L1 and L2 with `curl` against the SQL in todo.md.
- [ ] Review of the backend diff. The PR is opened when the user asks, and the shared DB upgrade comes first.

### Phase 2: App

- [ ] F1: Contracts, captured responses, mock
- [ ] F2: `/leaderboard` screen and store
- [ ] F3: Learn page "Điểm thưởng" figure
- [ ] F4: End-to-end check against the spec

### Checkpoint B

- [ ] Success criteria recorded, with how each was checked.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan the next module (`lesson-notes`).

## Risks and mitigations

| Risk                                                                 | Impact | Mitigation                                                                                                                                                  |
| -------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merging the backend before the shared DB has the table (as with #15) | High   | The PR's first line and the hand-off tell the user to run the upgrade first. The main session reminds the user before any merge.                            |
| Recording activity slows down or fails a learner's write             | Med    | One indexed lookup under a per-user lock. Errors are caught and logged, never thrown to the learner. B2 tests a failing recorder.                           |
| Two requests on the same day insert two rows                         | Med    | Advisory lock on the user plus a check. B2 has a concurrency test. Tolerated if it happens: points count distinct dates.                                    |
| Ranking many users in the service is slow                            | Med    | Grouped queries, one per part. Checkpoint A records the timings on demo data. A nightly summary table is proposed only if the timings call for it, not now. |
| Lessons double-counted across revisions                              | Med    | Amendment 6; B3 tests a learner who completes the same lesson in two cycles on two revisions.                                                               |
| The streak is wrong at the day boundary                              | Low    | Local dates in `Asia/Ho_Chi_Minh`. B2 and B3 test 23:30 and 00:30 local.                                                                                    |
| `all` shows names from other units                                   | Low    | Open question 1. Locally there is one unit, so `org` = `all`.                                                                                               |

## Open questions

None blocks the plan; each has a default.

1. **"Toàn hệ thống":** may it list learners of other units by name?
   - Default: yes, every active learner, as the mockup.
   - Alternative: `all` shows only the caller's own rank.
2. **Learn page points figure:** default yes (amendment 7).
3. **Activity table without audit columns:** default yes (amendment 9).
