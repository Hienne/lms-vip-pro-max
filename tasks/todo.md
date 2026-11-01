# Tasks: `learner-scores`

Spec: [SPEC-learner-scores.md](../SPEC-learner-scores.md) · Plan: [plan.md](plan.md).
The previous `learner-competency` checklist, with its success criteria and how each was checked, is in git history
at `3aaf270`.

- **Repositories:**
  - backend: `corebanking-academy`, branch `feat/learner-scores` from `main` (`6717718`), **in its own git
    worktree**;
  - app: this one, branch `feat/learner-mockup-gap`.

  Nothing is pushed.

- **Local stack:**
  - the backend on :8019 is the main session's background task, running from `~/my-projects/corebanking-academy`.
    Do not run `mvn` or change branches in that checkout. Message the main session when it needs a restart;
  - the app runs on :4200, against `localhost:8019`;
  - accounts: `hocvien` and `hocvien.tichhop` as learners;
  - passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, never printed;
  - in the browser, sign in with the one-shot token method, never by typing the password.
- **Never** touch the shared server `103.121.90.119`. No schema change, no seeding users, no direct edits to quiz
  attempts.

## Phase 1: Backend

- [x] **B1: `scores` port method and its Assessment implementation**
  - Acceptance:
    - `LearningQuizDirectory.scores(String userId, Collection<Long> courseIds)` returns `List<QuizScore>`, one per
      published, not deleted quiz of those courses: `quizId`, `courseId`, `title`, `quizType`, `bestScore`,
      `finalScore`, `passed`, and `last` (attemptId, scorePercent, passed, submittedAt; null when no graded
      attempt).
    - `AssessmentQuizDirectory` implements it with one query for the quizzes and one for the caller's attempts on
      them. Each quiz goes through the same summary code as `AttemptSummary`, extracted from
      `QuizAttemptService.summarize` so both call it.
    - An empty `courseIds` returns an empty list without a query.
  - Verify: a test where `scores` equals the `AttemptSummary` of the quiz intro for a BEST quiz and a LAST quiz, with
    a voided and an in-progress attempt ignored. `mvn -q test -Dtest=…` green.
  - Files: `learning/service/LearningQuizDirectory.java`, `assessment/service/AssessmentQuizDirectory.java`,
    `QuizAttemptService.java` (extraction), the repository it needs, tests.
  - Size: M. Depends on: none.

- [x] **B2: `AssessmentOverview` in the progress summary (S1)**
  - Acceptance: - `LearningProgressOverview.assessment` is `AssessmentOverview(availability, last, bestScorePercent,
averageScorePercent, passedQuizCount, quizCount)` when the caller's current courses have at least one
    published quiz, and `{ availability: "unavailable" }` otherwise. - The current courses are the `MINE` search's ids, the same set the counts use. - The figures follow plan amendment 2. The average is rounded to two decimals, half up. - `docs/api/LEARNING.md` ("Summary, CSV và thông tin gửi FE") describes it.
  - Verify: `LearningProgressReportServiceTest`:
    - no quiz → `unavailable`;
    - quizzes but no attempt → `available` with `last` null, best and average null, `passedQuizCount` 0;
    - one failed and one passed quiz → right best, average, passed/total and last.
  - Files: `LearningProgressOverview.java`, `LearningProgressReportService.java`, its test, `docs/api/LEARNING.md`.
  - Size: M. Depends on: B1.

- [x] **B3: `bestScorePercent` on `CourseCard` and the CSV column (S2, S3)**
  - Acceptance:
    - `CourseCard.bestScorePercent` is the best graded score of the course's published final exam, or null. It is
      filled on catalog, courses and course-by-id, with one `scores` call per page.
    - `MANAGE` mode leaves it null and does not call the port.
    - The progress CSV gains "Điểm cao nhất" as its **last** column.
    - Docs updated.
  - Verify: a search test (course with a final exam and attempts → the best; without one → null). A CSV header and
    row test. The query plan of the `scores` queries on the demo data is recorded in the commit message.
  - Files: the course search and its row mapping, `LearningDetails.java`, `LearningProgressReportService.java`, tests,
    `docs/api/LEARNING.md`.
  - Size: M. Depends on: B1.

- [x] **B4: `graded=true` on `/me/quiz-attempts` and its export (S4)**
  - Acceptance:
    - With `graded=true`, the list and the export return only `SUBMITTED` and `AUTO_SUBMITTED` attempts.
    - It combines with `quizId` and with `status` by AND.
    - Swagger and `docs/api/ASSESSMENT.md` describe it.
  - Verify: a test with one attempt of each status. `mvn -q test -Dtest=…` green.
  - Files: `LearnerQuizController.java`, `QuizAttemptService.java`, the attempts repository, tests,
    `docs/api/ASSESSMENT.md`.
  - Size: S. Depends on: none.

### Checkpoint A

- [x] `mvn clean test` green in the worktree.
- [x] Stop for the main session. Passed on 2026-11-01: every figure below matched `curl` and the quiz intros. It reviews the diff, restarts the local backend on the branch, and checks with
      `curl` as `hocvien`:
  - the summary;
  - course 1's and course 8's cards;
  - the CSV header;
  - `graded=true`.
- [ ] The backend PR is opened only when the user asks. (Not asked yet; the user approved Phase 2 on 2026-11-01.)

## Phase 2: App

- [ ] **F1: Contracts, captured fixtures and the mock**
  - Acceptance:
    - `AssessmentOverviewSchema`; `LearningProgressOverviewSchema.assessment` is a union on `availability`
      (`"available"` → the overview, else `AvailabilitySchema`).
    - `CourseCardSchema.bestScorePercent: z.number().nullable()`.
    - `MyAttemptsQuerySchema` and the export query gain `graded`.
    - Captured responses from the local backend as `hocvien`.
    - The mock's summary, cards and attempts carry the new fields.
  - Verify: contracts specs parse both union branches and the captured responses. `npx nx test contracts` and
    `npx nx test mocks` green.
  - Files: `libs/contracts/src/lib/learner/learner.schema.ts`, `libs/contracts/src/lib/assessment/learner-quiz.*`,
    captured fixtures, `libs/mocks/src/lib/learning/*`, `libs/mocks/src/lib/assessment/*`.
  - Size: S. Depends on: Checkpoint A.

- [ ] **F2: Learn page score figures and the course card score**
  - Acceptance:
    - With an available overview, two figures follow the counts, in the same label-over-number style, each a link to
      `/progress`:
      - "Điểm kiểm tra gần nhất": `fmtPct` of `last.scorePercent` with "Đạt · {quiz}" or "Chưa đạt · {quiz}", or "—"
        with "Chưa làm bài kiểm tra";
      - "Điểm cao nhất": `fmtPct` of the best, or "—", with "Đạt {passedQuizCount}/{quizCount} bài kiểm tra".
    - With `unavailable`, neither figure is rendered.
    - "Chưa đạt" is the only coloured text.
    - The course card's status line ends with "· Điểm cao nhất {x}%" when `bestScorePercent` is not null.
  - Verify: component specs for available with and without `last`, and for unavailable. Course card spec with and
    without a score. `npx nx test lms` green.
  - Files: a shared `score-figures` component under `shared/learning/`, `learn.html`, the course card in
    `shared/course/`, specs.
  - Size: M. Depends on: F1.

- [ ] **F3: Progress page: average, column and "Lịch sử thi"**
  - Acceptance:
    - "Điểm thi trung bình" (`fmtPct`, or "—") next to the counts when the overview is available.
    - The course table gains "Điểm cao nhất" (`fmtPct`, or "—"), not sortable.
    - "Lịch sử thi":
      - `ProgressStore` loads `myAttempts` with `graded: true`, `sort: 'submittedAt,desc'` and `size: 6`, using
        `serverData`, with its own loading, error-with-retry and empty states;
      - each row shows the quiz title, the submit time (+ "tự nộp" for `AUTO_SUBMITTED`), the score and
        "Đạt"/"Chưa đạt", and links to `/quiz/:quizId/result/:attemptId`;
      - it sits beside the competency card on wide screens and below it on narrow ones.
  - Verify: store and page specs for the three states of the list, the column, and the KPI present and absent.
    `npx nx test lms` green.
  - Files: `features/achievements/progress/*`, specs.
  - Size: M. Depends on: F1.

- [ ] **F4: End-to-end check against the spec**
  - Acceptance: the success criteria below are written here, each with how it was checked.
  - Verify, on the local stack as `hocvien`:
    - the learn figures, the course card scores, the progress KPI, the column and "Lịch sử thi" equal `curl` of the
      summary, the cards and `/me/quiz-attempts?graded=true`;
    - the downloaded CSV has the new last column;
    - check at 1280 px light and 375 px dark, with no horizontal scroll;
    - a learner whose courses have no quiz sees no score figures and no error. Find one with `curl`; if none exists,
      say so and point to the specs and `mockBackend: true`;
    - `npm run check` green.
  - Files: `tasks/todo.md`, `SPEC-learner-scores.md` (status).
  - Size: S. Depends on: F2, F3.

### Checkpoint B

- [ ] Success criteria recorded:
  1. `hocvien` sees "Điểm kiểm tra gần nhất" and "Điểm cao nhất · Đạt x/y bài kiểm tra" on the learn page, equal to
     the backend response.
  2. Progress shows "Điểm thi trung bình", the "Điểm cao nhất" column and "Lịch sử thi"; the CSV has the new column.
  3. A learner with no quiz sees no score figures and no error.
  4. `mvn clean test` and `npm run check` green; the visual-design checklist passes.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan `learning-leaderboard`.
