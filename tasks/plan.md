# Implementation Plan: `learner-scores`

Spec: [SPEC-learner-scores.md](../SPEC-learner-scores.md) (draft, amended below, waiting for approval). Map:
[SPEC.md](../SPEC.md). Tasks: [todo.md](todo.md).

This plan replaces the one for `learner-competency`. That plan is done and merged (Hienne/lms-vip-pro-max#49), and
it is in git history at `3aaf270`.

## Overview

The learner sees their quiz scores where the mockup puts them:

- **Learn page:** "Điểm kiểm tra gần nhất" and "Điểm cao nhất · Đạt x/y bài kiểm tra", next to the counts.
- **Course cards:** "Điểm cao nhất x%" on the status line.
- **Progress page:**
  - "Điểm thi trung bình" next to the counts;
  - a "Điểm cao nhất" column in the course table and the CSV;
  - "Lịch sử thi", the latest graded attempts.

The server computes every figure. The backend gets three additive changes and one new filter, with no schema change.

## What was checked while planning (2026-11-01)

**Backend (`corebanking-academy`, `main` at `6717718`)**

- `LearningProgressReportService.summary()` returns `assessment: { availability: "unavailable" }` unconditionally.
  `LearningProgressOverview.assessment` is the plain `Availability` record.
- The per-quiz rule is `QuizAttemptService.summarize` (private static):
  - graded means `SUBMITTED` or `AUTO_SUBMITTED`;
  - `bestScore` is the max `scorePercent`;
  - `finalScore` and `passed` follow the quiz's `scoreMethod` (BEST: ever passed / best; LAST: the latest graded
    attempt).
- Learning reaches Assessment only through the port `LearningQuizDirectory` (`find`, `failedFinalExamCourseIds`),
  implemented by `AssessmentQuizDirectory`.
- `CourseCard` has no score field. The progress CSV columns are: Mã khóa, Tên khóa, Lần học, Trạng thái, Tiến độ,
  Bắt đầu, Truy cập gần nhất, Hoàn thành, Hạn, Trạng thái hạn.
- `GET /me/quiz-attempts` filters by one `status` only. Without a filter it also returns `IN_PROGRESS` and `VOIDED`
  rows, which have no score.
- **Local data, `hocvien`.** Every quiz scores by BEST. There are five graded attempts on three quizzes:

  | Quiz | Type       | Course | Attempts               |
  | ---- | ---------- | ------ | ---------------------- |
  | 1    | practice   | 1      | 14,28% then 0%, failed |
  | 2    | final exam | 1      | 12,5%, failed          |
  | 5    | final exam | 8      | 0% then 100%, passed   |

  The latest attempt is quiz 1 at 0%, failed.

**App**

- `LearningProgressOverviewSchema.assessment` is `AvailabilitySchema`. `CourseCardSchema` has no score.
- The progress table already has "Bắt đầu" and "Truy cập gần nhất". The spec's "while here" item is done.
- `learnerQuizEndpoints.myAttempts` and `exportAttempts` exist. `/quiz/:id/result/:attemptId` exists, so an attempt
  row can link to its result.
- The learn page shows `app-progress-counts`, a row of label-over-number figures.

**Mockup**

- **Learn** (`learner.js`):
  - "Điểm kiểm tra gần nhất" shows the last attempt's score with "Đạt/Chưa đạt · {quiz}", or "—" with "Chưa làm bài
    kiểm tra".
  - "Điểm cao nhất" shows the best score over the caller's quizzes, with "Đạt {passed}/{total} bài kiểm tra"; total
    counts every quiz of the caller's courses.
  - Both link to `#/progress`.
- **Course card** (`components.js`): the status line ends with "· Điểm cao nhất {best}%", where `best` is the
  course's **final exam** (`completion.quizId`).
- **Progress** (`tools.js`):
  - KPI "Điểm thi trung bình", which the mockup takes over every submitted attempt;
  - column "Điểm cao nhất" (the final exam's best), last in the CSV;
  - card "Lịch sử thi": the 6 latest submitted attempts, each with title, time (+ "tự nộp"), score and Đạt/Chưa đạt,
    linking to the result.

  There is no paging and no CSV in that card.

## Spec amendments (written into the spec with this plan)

1. **A course's score is its final exam.** `CourseCard.bestScorePercent` is the best graded score on the course's
   published final exam, null when there is none or no graded attempt. The mockup reads the course's completion quiz,
   and the `failed` rule already uses the final exam. **`finalExamPassed` is dropped**: no screen needs it, and
   `failed` already says it.
2. **Overview figures.** All of them come from the per-quiz summaries built by the same `summarize` as
   `AttemptSummary`, over the published quizzes of the caller's current courses:
   - `bestScorePercent`: the highest `bestScore`;
   - `passedQuizCount`: the quizzes whose `passed` is true;
   - `quizCount`: every published quiz of those courses, practice included, as in the mockup;
   - `last`: the latest graded attempt, with that attempt's own `passed`;
   - `averageScorePercent`: the mean of `finalScore` over quizzes with a graded attempt, two decimals, half up. This
     is the spec's default. The mockup averages every attempt instead; see open question 1.
3. **CSV column at the end.** "Điểm cao nhất" goes after "Trạng thái hạn", as the mockup's last column, so existing
   column positions do not move.
4. **Attempt list as in the mockup.** "Lịch sử thi" shows the 6 latest graded attempts, linking to
   `/quiz/:quizId/result/:attemptId`, with no paging and no CSV. To ask for graded attempts only, the backend adds
   **S4**: `graded=true` on `/me/quiz-attempts` and its export (`SUBMITTED` or `AUTO_SUBMITTED`).
5. **Course card score.** The course card's status line gains "· Điểm cao nhất {x}%" when `bestScorePercent` is not
   null.
6. **Labels from the mockup.** "Điểm thi trung bình" (not "Điểm trung bình") and "Lịch sử thi". Percents go through
   `fmtPct` with two digits ("14,28%"). The only coloured text is "Chưa đạt", which is status.
7. **Done already:** the "Bắt đầu" and "Truy cập gần nhất" columns.
8. **Not sortable:** the "Điểm cao nhất" column (open question 2's default).

## Architecture decisions

**Backend**

- **One port method for scores.**
  - `LearningQuizDirectory` gains `scores(userId, courseIds)`. It returns one `QuizScore` per published, not deleted
    quiz of those courses: quiz id, course id, title, type, `bestScore`, `finalScore`, `passed`, and the latest graded
    attempt (id, score, passed, submittedAt).
  - `AssessmentQuizDirectory` implements it with one attempts query for the caller and those quizzes. It calls the
    same `summarize`, made package-visible and shared, so the summary can never disagree with the quiz intro.
  - Learning aggregates the overview from that list. The aggregation stays on the server, in
    `LearningProgressReportService`.
- **Course card.** The search fills `bestScorePercent` per page with one `scores` call for the page's course ids. It
  keeps the final exam's `bestScore`. `MANAGE` mode does not call it and leaves null, as with `failed`.
- **Caller's current courses.** Their ids come from the same `MINE` search the counts use, so the KPIs and the tabs
  cover the same courses.

**Working tree and process**

- The backend child works in its own git worktree of `corebanking-academy`, never in
  `~/my-projects/corebanking-academy`, where the main session's local backend runs. The main session restarts the
  local backend on the new code at Checkpoint A.
- The app child starts after Checkpoint A, because its captured fixtures come from the new backend.
- One commit per task: backend on `feat/learner-scores` from `main`, app on `feat/learner-mockup-gap`. Nothing is
  pushed. Merging the backend to `main` deploys it to the shared server, so its PR waits for the user.
- **No schema change.** The new queries read existing tables.

## Task list

### Phase 1: Backend (`corebanking-academy`)

- [ ] B1: `scores` port method and its Assessment implementation
- [ ] B2: `AssessmentOverview` in the progress summary (S1)
- [ ] B3: `bestScorePercent` on `CourseCard` and the CSV column (S2, S3)
- [ ] B4: `graded=true` on `/me/quiz-attempts` and its export (S4)

### Checkpoint A

- [ ] `mvn clean test` green in the worktree. The main session restarts the local backend and checks the figures
      with `curl`.
- [ ] Review of the backend diff. The PR is opened when the user asks.

### Phase 2: App

- [ ] F1: Contracts, captured fixtures and the mock
- [ ] F2: Learn page score figures and the course card score
- [ ] F3: Progress page: average, column and "Lịch sử thi"
- [ ] F4: End-to-end check against the spec

### Checkpoint B

- [ ] Success criteria recorded, with how each was checked.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan the next module (`learning-leaderboard`).

## Risks and mitigations

| Risk                                                 | Impact | Mitigation                                                                                                                           |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| The overview disagrees with the quiz intro           | High   | One `summarize` for both. B1 has a test that compares `scores` with `AttemptSummary` for a BEST quiz and a LAST quiz.                |
| The catalogue gets slower (one more query per page)  | Med    | One batched call per page, not one per card. B3 records the query plan on demo data.                                                 |
| Merging the backend deploys it to the shared server  | Med    | Additive fields and a new optional filter only, no schema change. The PR waits for the user.                                         |
| The backend child disturbs the running local backend | Med    | It works in its own worktree. Only the main session restarts the local backend.                                                      |
| A learner with quizzes but no attempt sees "—"       | Low    | That is the mockup's state: "—" with "Chưa làm bài kiểm tra". With `unavailable` (no quiz in their courses), the figures are absent. |

## Open questions

Neither one blocks the plan. Each has a default.

1. **Average score.** The spec's default is the mean of each quiz's final score (one number per quiz). The mockup
   averages every attempt. For `hocvien` that is 42,26% per quiz against 25,36% over every attempt. Default: per
   quiz, so retakes do not drag the number down.
2. **Sorting by best score.** Default: not sortable. Sorting would need the score inside the course search's SQL.
