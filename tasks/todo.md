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

- [x] **F1: Contracts, captured fixtures and the mock**
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

- [x] **F2: Learn page score figures and the course card score**
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

- [x] **F3: Progress page: average, column and "Lịch sử thi"**
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

- [x] **F4: End-to-end check against the spec**
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

- [x] Success criteria recorded, with how each was checked (2026-11-01):
  1. `hocvien` sees "Điểm kiểm tra gần nhất" and "Điểm cao nhất · Đạt x/y bài kiểm tra" on the learn page, equal to
     the backend response.
     - Checked by `curl` of the summary on :8019: last = quiz 1 at 0% failed, best 100, average 42.26, passed 1 of 5.
     - Checked by `learn.spec` and `score-figures.spec` against the mock: both figures with their links, "Chưa đạt"
       as the only coloured text, "—" with "Chưa làm bài kiểm tra", none when unavailable.
     - Main session, in the browser as `hocvien` (one-shot token sign-in): "0% · Chưa đạt · Luyện tập: Tổng quan hệ
       thống Core Banking" and "100% · Đạt 1/5 bài kiểm tra"; course 1's card reads "Đang học · Điểm cao nhất
       12,5%"; one summary call per page; no horizontal scroll at 1280 px light.
  2. Progress shows "Điểm thi trung bình", the "Điểm cao nhất" column and "Lịch sử thi"; the CSV has the new column.
     - Checked by `curl` of `GET /me/learning/courses?size=50`: course 1 = 12.5, course 8 = 100, the others null.
     - Checked by `curl` of the progress export: the header ends with "Điểm cao nhất" and the first row has 12.50.
     - Checked by `curl` of `/me/quiz-attempts?graded=true&sort=submittedAt,desc&size=6&page=0`: 5 graded attempts,
       two `AUTO_SUBMITTED`.
     - Checked by `progress.spec`: the KPI, the last and non-sortable column, the query sent for the history, its
       three states (rows with the result link and "tự nộp", empty, error with retry), and the card sitting after
       the competency card.
     - Main session, in the browser as `hocvien`: "Điểm thi trung bình 42,26%"; the last column "Điểm cao nhất" reads
       12,5% and 100%, "—" elsewhere; "Lịch sử thi" lists the 5 graded attempts newest first, with "tự nộp" on
       attempts 7 and 2, each linking to `/quiz/:quizId/result/:attemptId`; the page sends
       `graded=true&sort=submittedAt,desc&page=0&size=6`. The history sits beside the radar at 1280 px light and below
       it at 375 px dark, with no horizontal scroll at either width.
     - Not checked: downloading the CSV through the page (its column was checked with `curl`).
  3. A learner with no quiz sees no score figures and no error.
     - Checked by specs on both pages with an `unavailable` assessment, and by the mock's `giangvien`.
     - No local learner has an unavailable assessment: `giangvien` is available with null scores on the backend.
     - Main session, in the browser as `giangvien` (quizzes, no attempt): `/learn` shows "—" with "Chưa làm bài kiểm
       tra" and "Đạt 0/4 bài kiểm tra"; `/progress` shows "Điểm thi trung bình —" and "Bạn chưa có bài thi nào được
       chấm."; no error state on either page.
  4. `mvn clean test` and `npm run check` green; the visual-design checklist passes.
     - `mvn clean test` green in the backend worktree after `5f1518c` (356 tests, 42 skipped `CommunityApiIT`).
     - `npm run check` green 14 of 14 after `968b620`, the review fix that stops `app-unavailable-note` from promising
       scores next to the score figures (it now reads only `activity`: "Giờ học sẽ hiển thị khi hệ thống có dữ
       liệu.").
     - Visual-design checklist passed in the browser: label-over-number figures with no cards or icons, "Chưa đạt"
       as the only coloured text, one primary action per page unchanged.
- [x] Spec status set to built.
- [x] Review with the user (2026-11-01, "Sửa rồi đóng"). Next: the PRs when the user asks, then plan
      `learning-leaderboard`.
