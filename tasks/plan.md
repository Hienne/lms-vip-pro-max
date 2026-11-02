# Implementation Plan: `learner-home-refresh`

Spec: [SPEC-learner-home.md](../SPEC-learner-home.md) (built in Phase 4; amended by this plan, see "Amendments"
below). Map: [SPEC.md](../SPEC.md). Tasks: [todo.md](todo.md).

This plan replaces the one for `certificates`. That plan is done; its PRs are hmhug19/corebanking-academy#22 and
Hienne/lms-vip-pro-max#56, and it is in git history at `2f0f5bc`.

## Overview

`/learn` still differs from the mockup's `dashboard` page in ways the backend can now serve. This module brings it
closer, without the mockup's hero, greeting, date eyebrow, icon tiles or watermark:

- one KPI row of four, as in the mockup: assigned courses, completion rate, last score, best score;
- points and streak beside the continue card, instead of a block of their own;
- no stray "Giờ học sẽ hiển thị…" note on `/learn`;
- the percent on each "Hạn hoàn thành" row;
- the five course tabs on one line at 1280 px;
- "Lộ trình theo chương trình" from the server's programme progress;
- "Công cụ học nhanh" with **"Ghi chú & đánh dấu"** and **"Chứng nhận"** only. **No "Hỏi trợ lý AI" and no
  "Ôn bằng flashcard"** (the user's decision, 2026-11-02).

**Backend.** No code change and no new endpoint. Two endpoints already on `main` are not yet in the app:
`GET /me/learning/dashboard` (it has `completionRate`) and `GET /me/learning/dashboard/programs`. The dashboard and
the competency endpoint need `docs/sql/learning_hub_reporting.sql`, which has never been run on the local DB.

## What was checked while planning (2026-11-02)

**Backend (`corebanking-academy`, `origin/main` at `5563e76`, with #22 merged)**

- **`GET /api/v1/me/learning/dashboard`** returns `LearningAnalytics.Home`:
  - `counts {enrollments, learners, courses, assigned, mandatory, completed, inProgress, notStarted, overdue,
averageProgress, completionRate}`;
  - `nextAction`, and `deadlines` (at most five `Enrollment` rows, each with `progressPercent` and `dueAt`).
  - `docs/api/LEARNING.md` §16 defines the two percents: `completionRate` = completed / total × 100;
    `averageProgress` = the mean of the courses' progress.
- **`GET /api/v1/me/learning/dashboard/programs?page&size`** returns a page of `Group {id, name, enrollments,
learners, courses, completed, inProgress, notStarted, overdue, averageProgress, completionRate}`.
- **Local stack, as `hocvien`:**
  - `/dashboard/programs` answers 200 with four programmes (e.g. "Nền tảng nghiệp vụ Core Banking", 3 courses,
    `averageProgress` 50, `completionRate` 33.33).
  - `/dashboard` and `/dashboard/competencies` answer `CORE-INTERNAL_ERROR`. The log says
    `relation "learning_hub.quiz_user_results" does not exist` and `"attempt_competency_scores" does not exist`.
  - The app's `myCompetency` (`/api/v1/me/competency`) fails for the same reason, so "Biểu đồ năng lực" on `/learn`
    and `/progress` shows its error state today.
- **`learning_hub_reporting.sql`** (128 lines, from BE #19):
  - creates `quiz_user_results` and `attempt_competency_scores` with their indexes, and fills them from the graded
    attempts in one transaction under a `SHARE` lock;
  - adds no FK, trigger, job or seed and does not change the attempts;
  - is run once with `psql -v ON_ERROR_STOP=1 -f docs/sql/learning_hub_reporting.sql` (`docs/sql/README.md`).

**App (`origin/main` at `a27364a`)**

- `/learn` calls `progressSummary`, `myCourses` (resume, due, tabs), `enrollment`, `reminders`, `myPoints` and
  `myCompetency`. It renders:
  - `app-progress-counts` (five loose counts), then `app-score-figures` and `app-points-figure` in one row;
  - `app-unavailable-note`, shown because `summary.activity.availability` is `unavailable`;
  - "Hạn hoàn thành" from `myCourses` sorted by due date, with no percent although every card has
    `progressPercent`;
  - five `ui-tabs` with `wrap`, which wraps "Được giao" to a second line at 1280 px.
- `/progress` uses the same four shared pieces and keeps them.
- `@lms/ui` already has the `kpi` molecule and the `ring` and `progress` atoms.
- `/saved` and `/certificates` are routes with no sidebar entry. The new `/certificates` screen is in
  Hienne/lms-vip-pro-max#56, not yet merged.

## Decisions

1. **Completion rate is `dashboard.counts.completionRate`**, the server's completed / total. The mockup averaged the
   course percents, but its label is "Tỷ lệ hoàn thành" over "{completed}/{n} khóa đã xong", which is the
   completion rate. `averageProgress` is not shown on the KPI.
2. **The journey bar is each programme's `averageProgress`**, as the mockup's `journey` (the mean of its courses'
   percents). The line under the bar is "{completed}/{courses} khóa đã xong".
3. **The dashboard is one more call.** `progressSummary` stays for the counts and the scores; `dashboard` is read
   only for `completionRate`. Its `deadlines` are not used: the due list keeps `myCourses` and adds the card's
   `progressPercent`.
4. **"Công cụ học nhanh"** is a plain list of two links, each a title over a muted line, with a `chevron-right`
   `ui-icon` of size `sm` and no tile:
   - "Ghi chú & đánh dấu" · "Mở đúng trang / mốc video" → `/saved`;
   - "Chứng nhận" · "Chứng nhận các khóa đã hoàn thành" → `/certificates`.

   No AI assistant and no flashcards. The leaderboard stays reachable from the points figure.

5. **Points and streak** move next to the continue card at `lg` (one row; stacked below `lg`), like the mockup's
   hero tile, and keep linking to `/leaderboard`.
6. **`app-progress-counts`, `app-score-figures` and `app-unavailable-note` leave `/learn`** and stay on
   `/progress`. The KPI row is a new component in `features/learning/learn/components/`.
7. **KPI row** follows visual-design.md: label (`text-muted`) over value (`ui.num`, semibold) with an optional delta,
   no card per number unless it links. The completion KPI shows its value in `uiRing` (`accent`, the completed
   ring); it is not a placeholder chart, since the value is the server's.

   | KPI                    | Value                             | Delta                                      | Link                      |
   | ---------------------- | --------------------------------- | ------------------------------------------ | ------------------------- |
   | Khóa học được giao     | `summary.counts.assigned`         | "{mandatory} bắt buộc · {overdue} quá hạn" | `/catalog?scope=assigned` |
   | Tỷ lệ hoàn thành       | `dashboard.counts.completionRate` | "{completed}/{total} khóa đã xong"         | none                      |
   | Điểm kiểm tra gần nhất | `assessment.last.scorePercent`    | "Đạt · {quiz}" / "Chưa đạt · {quiz}"       | `/progress`               |
   | Điểm cao nhất          | `assessment.bestScorePercent`     | "Đạt {passed}/{total} bài kiểm tra"        | `/progress`               |

## Amendments to `SPEC-learner-home.md` (made in F6)

- The "What is built and what is not" table: the KPI row, points and streak, competency, the journey and
  "Công cụ học nhanh" become built as above. The mockup's "Hỏi trợ lý AI" and "Ôn bằng flashcard" rows are "Not
  built: removed by the user (2026-11-02)".
- Boundaries: "Ask first" drops points, streak, scores, competency and journey, which now have data. "Never:
  computing a completion rate in the app" stays.
- `/learn` reads two more endpoints: `dashboard` and `dashboardPrograms`.

## Phases

### Phase 0: Local environment (main session) → Checkpoint A

- **A1.** Run `learning_hub_reporting.sql` once on the **local** DB (approved with this plan). Check that
  `/dashboard`, `/dashboard/competencies` and `/me/competency` answer 200 as `hocvien` and `hocvien.tichhop`.
- **Checkpoint A:** the main session records the responses in `todo.md`, then starts a Sonnet child for Phase 1.

### Phase 1: App (child session, one commit per task) → Checkpoint B

- **F1. Contracts.** `learnerEndpoints.dashboard` and `learnerEndpoints.dashboardPrograms` with zod schemas,
  fixtures captured from the local backend, and endpoint specs.
- **F2. Mock.** The in-app mock serves both from the learning seed with the backend's rules.
- **F3. KPI row and points.** The four KPIs, the points figure beside the continue card, and no counts, score
  figures or unavailable note on `/learn`.
- **F4. Side column.** The percent on each due row; "Công cụ học nhanh" with the two links.
- **F5. Tabs and journey.** The five tabs on one line at 1280 px; the "Lộ trình theo chương trình" section.
- **F6. Docs and routes.** The spec amendments, the migration notes, and `requires` on the `learn` screen entry.
- **Checkpoint B:** the main session reviews each diff, runs `npm run check`, and checks `/learn` in the browser as
  both learners at 375, 768 and 1280 px, light and dark, beside the mockup on :4320.

## Before merging (the user)

- **Shared DB:** check whether `learning_hub_reporting.sql` has been run there:

  ```sql
  SELECT to_regclass('learning_hub.quiz_user_results'), to_regclass('learning_hub.attempt_competency_scores');
  ```

  If either is null, run the script there before merging the app PR. Without it the completion KPI and the
  competency section show their error state; the rest of the page still works.

- **Order:** merge Hienne/lms-vip-pro-max#56 first, so "Chứng nhận" opens the new certificates list. This branch is
  then rebased on `main`.

## Risks

- The reporting script takes a `SHARE` lock on the attempt tables while it runs. Locally that is instant; on the
  shared DB the script asks for a maintenance window.
- If the dashboard fails, only the completion KPI shows an inline error with retry. The other three KPIs come from
  `progressSummary` and still render.
