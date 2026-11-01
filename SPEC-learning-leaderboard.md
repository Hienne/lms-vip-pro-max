# Spec: `learning-leaderboard`

Map: [SPEC.md](SPEC.md). Status: **built 2026-11-01** (amended by the plan, see "Amendments"; results in `tasks/todo.md` Checkpoint B). Depends on
`learner-quiz`, because quiz passes count toward points.

## Amendments

Written with [tasks/plan.md](tasks/plan.md) on 2026-11-01. Where they differ from the sections below, they win.

1. **Mockup labels.** "Bảng xếp hạng & thành tích", the scopes Nhóm của tôi / Đơn vị / **Toàn hệ thống**, "Xếp
   hạng · {n} học viên", and the part labels Bài học hoàn thành / Bài kiểm tra đạt / Khóa học hoàn thành / Chuỗi
   ngày học. The default scope is `org`.
2. **`all` is every active learner in the system** (open question 1's default, as in the mockup). The community
   board ranks only within the caller's org, so it cannot be the model for `all`.
3. **Who is ranked:** active users eligible to learn, by the rule of `findLearningCandidates`. A caller with no team
   gets an empty `team` page, plus their own row.
4. **The rank comes from L1's `me`, for the selected scope.** L2 is `{ total, parts, streakDays }` with no rank.
5. **Ranking is computed in the service** from one grouped query per part, plus one port call for quiz passes.
   Learning cannot sum Assessment data in its own SQL.
6. **A lesson counts once per user across cycles and revisions.** Its identity follows `source_lesson_id` back to
   the original lesson.
7. **The learn page gets a "Điểm thưởng" figure** ("Chuỗi {n} ngày", linking to `/leaderboard`) beside the score
   figures (open question 2's default).
8. **Caller's row:** the selected-row token, `aria-current` and "(bạn)". No badge, no avatar, no top-3
   decoration. "Vị trí của bạn" appears when the caller's row is off the page.
9. **`learning_activity_days` has no audit columns** (open question 3's default). It has no FK and no UNIQUE; one
   row per user per day is checked in the service under an advisory lock. The upgrade is dated `2026-11-02`.
10. **Deploy order:** the upgrade runs on the shared DB before the backend PR is merged, because `ddl-auto=validate`
    refuses to start without the table.

## Objective

The mockup's "Bảng xếp hạng & thành tích" page (`tools.js` `leaderboard`, `api/core.js` `points` and `streak`)
describes learning points and their uses.

**How points are earned.** The page says points are computed automatically from four sources:

- each completed lesson;
- each quiz passed (counted once per quiz);
- the `reward_points` of each completed course;
- the current streak of consecutive learning days, capped at 30.

**What the page shows.**

- **Ranking.** Active learners ranked by total, under a segmented control with three scopes: Nhóm của tôi,
  Đơn vị and Toàn bộ.
- **Rows.** Each row shows rank, name, team, points and streak, and the caller's own row is marked.
- **My points.** A card with the caller's total, their rank, and the four parts.

The route `leaderboard` exists in `core/routing/screens.ts` with no screen. The backend stores
`course_completion_rules.reward_points` but never totals it, and it has no record of learning days. The
community leaderboard counts contributions. It stays separate (map decision 1).

The mockup's "Mốc ghi nhận" (perks at 300 / 600 / 1000 points) and "Huy hiệu" are **out of scope**:

- the perks are organisational promises that nobody has approved;
- badges already exist in Community, with their own rules.

## Backend (`corebanking-academy`, module `learning`)

### Points

The total is computed on read from the progress tables, so it never drifts from progress:

| Part      | Source                                                                                       | Weight (config)                       |
| --------- | -------------------------------------------------------------------------------------------- | ------------------------------------- |
| `lessons` | `lesson_progress` rows at 100% (each lesson counted once per user, across cycles)            | `app.learning.points.lesson` = 5      |
| `quizzes` | distinct quizzes with an attempt `passed = true` (via the assessment adapter)                | `app.learning.points.quiz-pass` = 30  |
| `courses` | sum of the completed revision's `reward_points` over completed enrollments (once per course) | from the course                       |
| `streak`  | `min(currentStreak, 30)`                                                                     | `app.learning.points.streak-day` = 10 |

The weights come from the mockup seed (`settings.points`). They live in `application.yml` and can be overridden
by environment, so changing them needs no deploy of code.

### Streak

A new table records one row per user per local day (`Asia/Ho_Chi_Minh`) on which they learned. A row is written
when one of these succeeds:

- `POST /sessions` (opening a lesson);
- `PUT …/blocks/{blockId}/progress`;
- a quiz start or submit, through a Learning adapter call.

Before inserting, the write checks whether that day already exists. This "one row per user per day" check is
done in the service, under the user's advisory lock.

`currentStreak` counts consecutive days ending today. If there is no row for today, it ends yesterday, so the
streak does not drop to 0 until a full day is missed.

### Endpoints (`LearningLeaderboardController`, `/api/v1/me/learning`)

| #   | Endpoint           | Query                                                          | Response                                                                                                                                                     |
| --- | ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1  | `GET /leaderboard` | `scope=team\|org\|all` (default `org`), `page`, `size` (≤ 100) | `Page<LeaderboardRow { rank, userId, fullName, teamName, points, streak, me }>` plus `me: LeaderboardRow` (the caller's row even when it is not on the page) |
| L2  | `GET /points`      | —                                                              | `MyPoints { total, rank (org scope), parts { lessons, quizzes, courses, streak }, streakDays }`                                                              |

**Scope (service):**

| Scope  | Who is ranked                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `team` | Active users of the caller's team                                                                                                                                                     |
| `org`  | Active users of the caller's org (branch or unit)                                                                                                                                     |
| `all`  | Active users of every org the caller can see as a learner. This is the same visibility rule as the community leaderboard (`ContributorRank`), reused through its adapter, not copied. |

**Ranking rules:**

- Ties share a rank, and the next rank skips (1, 1, 3).
- Users with 0 points are listed after everyone else, ordered by name.

The ranking query aggregates per user in SQL. With the demo data, its query plan is recorded in the plan. If it
is too slow at the expected size, a nightly summary table is proposed then, not now.

### DB upgrade `docs/sql/upgrade/2026-11-xx-learning-leaderboard.sql`

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS learning_hub.learning_activity_days (
    activity_id    bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id        varchar(20) NOT NULL,
    activity_date  date        NOT NULL,
    first_source   varchar(20) NOT NULL,   -- session | block_progress | quiz
    create_time    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_activity_days_user_date
    ON learning_hub.learning_activity_days (user_id, activity_date DESC);
COMMENT ON TABLE learning_hub.learning_activity_days IS
    'Ngày có hoạt động học của người dùng (theo Asia/Ho_Chi_Minh); một dòng mỗi người mỗi ngày, kiểm tra ở service.';
-- COMMENT ON COLUMN for every column.
COMMIT;
```

- **No audit columns.** The table is append-only and written by the system, not by a user command, so the
  `created_by` / `row_version` columns of the baselines do not apply. This is an exception to the baseline style;
  see open question 3.
- **Backfill.** An optional, separate script, `…-learning-leaderboard-backfill.sql`, inserts one day for each
  distinct date of `lesson_progress.update_time` and `quiz_attempts.submitted_at` per user. Existing local and
  demo users then get a streak.
- **Rollback.** Drops the table.
- **Baseline.** The learning baseline gets the table.

Docs: a "Điểm học tập và bảng xếp hạng" section in `docs/api/LEARNING.md`, with the weights and the rules.

## App

| Where                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/contracts/src/lib/learner`    | `leaderboard` (L1), `myPoints` (L2) and their schemas                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `features/achievements/leaderboard` | **New screen** for the `leaderboard` route.<br>• Header: "Bảng xếp hạng". The description line comes from the mockup copy about how points are earned.<br>• A segmented control: Nhóm của tôi / Đơn vị / Toàn bộ.<br>• An ordered list with the caller's row marked through the selected-row token and `aria-current`.<br>• A side card with "Điểm thưởng của bạn · hạng n" and the four parts.<br>• Paging, and "Vị trí của bạn" when the caller is not on the current page.<br>The store keeps `scope` in the URL. |
| learn page                          | Only if open question 2 is answered yes: a points/streak line ("{total} điểm · chuỗi {n} ngày"). `SPEC-learner-home.md` left it out for lack of data.                                                                                                                                                                                                                                                                                                                                                                |
| `core/routing/screens.ts`           | The `leaderboard` entry gets its `load`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Mock                                | Seeded rows and points.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Testing

- **Backend:**
  - Each points part on fixtures. Course reward is counted once per course across cycles.
  - The streak counts today, yesterday, a gap, and a timezone edge at 23:30 / 00:30 local.
  - Activity written once per day under concurrent calls.
  - Scopes `team` / `org` / `all` limit the rows.
  - Tie ranks.
  - The caller's row is present when it is off the page.
- **App:**
  - The store maps scope to the query.
  - The list marks `me`.
  - The parts card.
  - The "Vị trí của bạn" row.
- **Local:**
  - As `hocvien`, after the lessons, quizzes and course completed in earlier modules, the points card equals the
    sum of its parts.
  - Each part matches what the weights predict from the DB.
  - `hocvien.tichhop` appears in the `org` ranking.
  - The streak increases the next day.

## Boundaries

- **Always:** points and ranks come from the server; the weights live in configuration.
- **Ask first:** perks, badges, or any use of points outside display.
- **Never:**
  - add learning points to the community contribution board;
  - show users outside the caller's visible scope.

## Success criteria

1. `/leaderboard` on the local stack shows the three scopes with correct membership. The rows are ranked by the
   server's totals, and the caller's row is marked.
2. The caller's points card equals L2. Each part equals the formula applied to the local DB, checked with a SQL
   query recorded in the plan.
3. Opening a lesson writes today's activity once. The streak shows on the next day.
4. The upgrade script, the backfill and the rollback apply cleanly. `mvn clean test` and `npm run check` green.
   The visual-design checklist passes.

## Open questions

1. **Toàn bộ:** may "Toàn bộ" list learners from other units by name? The default reuses the community
   leaderboard's visibility. If the Ban prefers, `all` can show only the caller's own rank.
2. **Learn page:** should the learn page show points and streak (the mockup hero has them)? Default: yes, as one
   quiet line, no hero.
3. **Activity table without audit columns:** is a system-written, append-only table without
   `created_by` / `row_version` acceptable? Default: yes.
