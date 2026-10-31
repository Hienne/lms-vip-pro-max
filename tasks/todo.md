# Tasks: `catalog-discovery`

Spec: [SPEC-catalog-discovery.md](../SPEC-catalog-discovery.md) · Plan: [plan.md](plan.md).
The previous `learner-quiz` checklist, with its success criteria and how each was checked, is in git history at
`3da2ff3`.

- **Repositories:** the backend is `~/my-projects/corebanking-academy`; the frontend is this repository.
- **Branch:** `feat/learner-mockup-gap` in both. Nothing is pushed.
- **Local stack:**
  - the backend reads `.env.local` (`set -a; . ./.env.local; set +a`);
  - the app runs with the `lms-local` launch config;
  - accounts: `hocvien` and `hocvien.tichhop` as learners;
  - passwords come only from environment variables.

Each backend test file is a DB-backed integration test in package `assessment` that extends
`AssessmentIntegrationTest`. There is no `learning` test package.

## Phase 0: `learner-quiz` review fixes

The main session reviewed the `learner-quiz` FE diff (`0569c38..3da2ff3`) against angular.md §14 and the
visual-design checklist. The user approved these six fixes on 2026-10-31, to be done before T1. Paths below are
under `apps/lms/src/app/features/quiz/` unless they say otherwise.

- [x] **F1: Learner quiz stores follow angular.md §5.2**
  - Acceptance:
    - `QuizTakeStore`, `QuizAttemptsStore` and `QuizResultStore` hold every writable signal in one
      `private readonly state = {}`. They expose only readonly `x$` selectors (`asReadonly()` / `computed()`),
      and each key is written only by its `setX()` setter. Commands compose the setters. Today `current$`,
      `isSaving$`, `isSubmitting$`, `page$` and `reviewOpen$` are public writable signals, and `failed`, `now`,
      `done`, `choices` and `timing` live outside `state`.
    - The answer saves and the submit keep the one ordered queue. `serverMutation` cancels the run in flight,
      which would drop a save. A comment on the queue states this as the deliberate exception to "every call in
      `serverData` / `serverMutation`". Submit errors keep showing as one toast.
    - `assessment-take.html` no longer calls `q.selectedOptionIds.includes(...)`. The component's `computed`
      view model carries a `selected` flag per option.
  - Verify: the existing take, attempts and result specs stay green. A spec checks that the take store exposes
    no `WritableSignal`. `npx nx test lms` is green.
  - Files: the three stores in `learner-quiz/data-access/`, `components/assessment-take/assessment-take.ts` /
    `.html`, the affected specs.
  - Size: M. Depends on: none.

- [x] **F2: Result screen and server-only numbers**
  - Acceptance:
    - The result of a failed attempt, opened after the learner passed in another attempt
      (`summary.passed`), says the quiz is passed. It no longer says the attempts are used up and an instructor
      will review (seen on `/quiz/4/result/5`).
    - No screen adds `maxAttempts + extraAttempts`. Attempts are shown as "Còn N lượt" from `attemptsLeft`, on
      the intro, the result and `shared/quiz/quiz-card` (which today shows `attemptsLeft/maxAttempts`).
    - The competency bars on the result are one neutral tone. The app does not compare a competency with
      `passPercent`.
    - The hub's attempt groups drop the best score the store computes. The open-quiz rows keep the server's
      `bestScore`.
  - Verify: specs cover the passed-elsewhere message, "Còn N lượt" with extra attempts granted, and the hub
    group without a computed best score.
  - Files: `components/assessment-result/assessment-result.ts` / `.html`, `learner-quiz/quiz-intro/quiz-intro.html`
    and its store, `learner-quiz/data-access/quiz-hub.store.ts`, `quiz-hub.html`,
    `apps/lms/src/app/shared/quiz/quiz-card/*`, their specs.
  - Size: M. Depends on: F1.

- [x] **F3: Visual-design checklist on the quiz screens**
  - Acceptance:
    - One primary button per view:
      - take screen: only "Nộp bài" in the top bar;
      - hub: the row actions are secondary;
      - lesson player, quiz lesson: "Làm bài" is primary and "Bài tiếp theo" secondary;
      - course page: check it has a single primary with the "Bài kiểm tra" section shown.
    - The take screen's small "Bài kiểm tra" label above the quiz title is removed; "Chọn TẤT CẢ" becomes
      "Chọn tất cả".
    - The intro's "Chưa có lần thi nào" inside the card uses `ui-empty` `variant="inline"`.
  - Verify: component specs for the button variants. Screenshots of the hub, intro, take, result, course page
    and quiz lesson at 1280 and 375 px, light and dark, checked against the `visual-design.md` checklist.
  - Files: the hub, intro, take and result templates, `shared/quiz/quiz-card/*`,
    `apps/lms/src/app/features/lesson/lesson/lesson.html`, their specs.
  - Size: S–M. Depends on: F2.

- [x] **F4: Question code on the take screen (BE + FE)**
  - Acceptance:
    - Backend: the attempt session's question view gains `code` (`questions.code`, nullable). An IT extending
      `AssessmentIntegrationTest` checks it is present for a question with a code and null without one.
      `docs/api/ASSESSMENT.md` gets the field.
    - App: `SessionQuestionSchema` gains `code: z.string().nullable()`; the captured fixture is refreshed from the
      local backend. The take screen shows the code after "Câu n / N" when present (mockup `quizTake`), styled
      with `ui.mono`. The "backend does not send one" comment is removed.
  - Verify: the new IT; `npx nx test contracts`; the take spec renders the code and its absence.
  - Files: the Assessment view and service, the new IT, `ASSESSMENT.md`; `learner-quiz.schema.ts`, the captured
    fixture, the mock, `assessment-take.*`.
  - Size: S–M. Depends on: F3. One commit in each repository.

- [x] **F5: Route stores and components in their route folders (angular.md §4)**
  - Acceptance:
    - Each learner quiz store used by one route moves to that route's `data-access/`. Only shared code
      (`route-id.ts`, the testing helpers) stays in `learner-quiz/data-access/`.
    - `components/assessment-take` moves under `learner-quiz/quiz-take/components/`, and
      `components/assessment-result` under `learner-quiz/quiz-result/components/`.
    - Moves and import changes only, with no change in behaviour.
  - Verify: `npx nx test lms` and `npx nx lint lms` are green, and `git diff -M` shows renames.
  - Files: the moved files and their importers.
  - Size: S. Depends on: F4.

- [x] **F6: Flaky `course-new.spec.ts`**
  - Acceptance: the cause of the 11-second timeout when the whole suite runs is found and fixed at the root, for
    example a real timer, an unflushed request, or a heavy render. The test timeout is not simply raised. The
    commit body states the cause.
  - Verify: `npx nx test lms` three times in a row, and `npm run check`, all green.
  - Files: `course-new.spec.ts`, and its component or store if the cause is there.
  - Size: S. Depends on: none.

### Checkpoint 0

- [x] `npm run check` and `mvn clean verify` green.
- [x] On `lms-local`, as `hocvien.tichhop`:
  - take the practice quiz (it allows 20 attempts), so no final-exam attempt is spent;
  - open an old failed result after a pass;
  - see the hub.
- [x] Stop for the main session's review of the Phase 0 diff before T1.

## Phase 1: Backend

- [x] **T1: `failed` through the quiz port, and the D3 card fields**
  - Acceptance:
    - `LearningQuizDirectory.failedFinalExamCourseIds(String userId)` returns the courses whose PUBLISHED,
      not deleted FINAL_EXAM the user attempted (at least one graded `SUBMITTED` or `AUTO_SUBMITTED` attempt)
      and never passed. The Assessment implementation is one query.
    - `CourseCard` gains, at the end: `fieldId`, `fieldName`, `programName`, `moduleName`, `failed`.
      `business_modules` is joined for the module name. A missing programme or module gives `null` names.
    - In `MINE` and `CATALOG` mode, `failed` is `c.course_id in (:failedIds)` (bind `-1` for an empty set). In
      `MANAGE` mode the port is not called and `failed` is false.
  - Verify: `CatalogCardIT` covers:
    - the names on a demo course;
    - `failed` is true after a failed final exam, false after a later pass, and false for a course with no
      final exam;
    - the instructor list still works and has `failed` false.

    The existing export IT stays green and the CSV header is unchanged. `EXPLAIN (ANALYZE, BUFFERS)` of the
    port query on the demo DB is pasted into the commit body.

  - Files: `LearningQuizDirectory.java` and its Assessment implementation, `LearningDetails.java`,
    `CourseRepositoryCustom.java`, `CourseRepositoryCustomImpl.java`, `LearningSearchService.java`, the new IT.
  - Size: M. Depends on: none.

- [x] **T2: `assigned`, `failed` and `overdue` filters on both lists and the export**
  - Acceptance:
    - `/me/learning/courses` and `/me/learning/catalog` take optional `assigned` and `failed` booleans;
      `/catalog` also takes `overdue`. `/progress/export` takes the same filters as `/courses`.
    - `assigned=true` is `coalesce(obligations.assigned, false)`, the same expression as the card.
    - `failed=true` / `false` uses the T1 set.
    - The learner visibility condition is moved into one private method of `CourseRepositoryCustomImpl`, with no
      change in behaviour.
    - `@Parameter` describes each new filter.
  - Verify: `CatalogFilterIT` covers:
    - each filter on each list returns the expected demo courses;
    - `failed` and `assigned` combine with `learningStatus`;
    - the export with `failed=true` lists the same courses as the list.
  - Files: `LearningLearnerController.java`, `LearningSearchService.java`, `CourseRepositoryCustom(Impl).java`,
    `docs/api/LEARNING.md`, the new IT.
  - Size: M. Depends on: T1.

- [x] **T3: `GET /api/v1/me/learning/facets`**
  - Acceptance:
    - Returns `LearnerFacets { fields[], programs[], modules[] }`, each item `{ id, code, name }`; programs and
      modules also have `fieldId`.
    - Only values used by at least one course visible in the caller's catalogue (the T2 visibility method),
      sorted by `sort_no`, then name.
    - `@Operation` and `@ApiResponse` as on the other learner endpoints.
  - Verify: `LearnerFacetsIT` covers:
    - a field, programme or module with no visible course is left out;
    - a course shared to the caller's org brings its values in;
    - the order.
  - Files: `LearningLearnerController.java`, `LearningSearchService.java` (or a small `LearnerFacetsService` if
    the search service passes 300 lines), `CourseRepositoryCustom(Impl).java`, the DTO, `docs/api/LEARNING.md`,
    the new IT.
  - Size: S–M. Depends on: T2.

- [x] **T4: `GET /api/v1/me/learning/courses/{courseId}`**
  - Acceptance:
    - Returns `LearnerCourse { card, content }`. `card` comes from the `CATALOG` search with a `courseId`
      filter. `content` is `LearningContentService.detail` of the card's revision.
    - A course the caller cannot see is refused with Learning's course-not-found code. Check
      `LearningResponseCode` first. If none exists, add `LEARNING-COURSE_NOT_FOUND` with a Vietnamese message.
    - Before enrolment, `content` keeps chapters and lessons and empties every lesson's `blocks` (plan
      amendment 6).
  - Verify: `LearnerCourseIT` covers:
    - an enrolled course returns the enrolled revision, also after a newer revision is published;
    - a visible, not-enrolled course returns the published revision with empty block lists;
    - a course outside the caller's scope is refused.
  - Files: `LearningLearnerController.java`, `LearningSearchService.java`, `CourseRepositoryCustom(Impl).java`,
    `LearningDetails.java`, maybe `LearningResponseCode.java`, `docs/api/LEARNING.md`, the new IT.
  - Size: M. Depends on: T2.

- [x] **T5: `assigned` and `mandatory` counts in the progress summary**
  - Acceptance:
    - `LearningProgressOverview.Counts` gains `assigned` and `mandatory`.
    - Each is the total of the `MINE` search with `assigned=true` or `requirement=mandatory` (plan amendment 3).
  - Verify: `ProgressSummaryCountsIT` checks that both counts equal the `totalElements` of the matching list
    call for `hocvien`. `docs/api/LEARNING.md` gets D5 and the `failed` rule.
  - Files: `LearningProgressOverview.java`, the summary service, `docs/api/LEARNING.md`, the new IT.
  - Size: S. Depends on: T2.

### Checkpoint A

- [x] `mvn clean verify` green (as before: 42 `CommunityApiIT` tests skipped; 333 tests).
- [x] As `hocvien`, with `curl` on `:8019` (checked by this session and by the main session):
  - `facets` lists names;
  - each of `assigned`, `failed`, `overdue` on `catalog` and `courses`;
  - `courses/{id}` for an enrolled course, a visible one and a hidden one;
  - `progress/summary` counts agree with the lists.
- [x] Show the backend diff to the user before Phase 2.

## Phase 2: App

- [x] **T6: Contracts and mocks**
  - Acceptance:
    - `learnerEndpoints.facets` (D1) and `learnerEndpoints.course` (D4), with `LearnerFacetsSchema` and
      `LearnerCourseSchema` mirroring the backend records field by field.
    - The list query schemas gain `assigned`, `failed`, `overdue`; `CourseCardSchema` gains the D3 fields;
      `LearningProgressOverviewSchema.counts` gains `assigned` and `mandatory`.
    - `libs/mocks/src/lib/learning` serves the two keys, the new filters and fields from its seed.
  - Verify: `npx nx test contracts` parses responses captured from the local backend for each new or changed
    key and refuses a wrong shape; `npx nx test mocks` is green.
  - Files: `learner.schema.ts`, `learner.endpoints.ts`, the course card schema, a captured fixture file, the
    learning mock and its spec.
  - Size: M. Depends on: Checkpoint A.

- [x] **T7: Catalogue on facets and the new status filters**
  - Acceptance:
    - `catalog.store.ts` reads fields, programmes and modules from one `facets` call. The programme and module
      selects list only entries of the chosen field. No `trainingCatalogEndpoints` import is left in the store.
    - "Trạng thái" options are the mockup's `STATUS_OPTS`: Chưa bắt đầu, Đang học, Đã hoàn thành, Chưa đạt,
      Quá hạn, Được giao. `failed` → `failed: true`, `overdue` → `overdue: true`, `assigned` →
      `assigned: true`, the rest → `learningStatus`.
    - The "Được giao" scope lists `catalog` with `assigned: true`.
    - "Xóa n bộ lọc" counts the status choice; the URL round trip keeps every filter.
    - The card's programme name comes from `programName`.
  - Verify: store specs map each status option to its query, cover the URL round trip and the field → module
    narrowing; the page spec renders the selects from facets. `npx nx test lms` is green.
  - Files: `catalog.store.ts`, `catalog.html` / `.ts`, `catalog.spec.ts`, `course-card-view.ts`.
  - Size: M. Depends on: T6.

### Checkpoint B

- [x] `npm run check` green.
- [x] On `lms-local` as `hocvien`: the three selects list real names and each narrows the list; each status
      option and each sort changes the list; "Xóa n bộ lọc" shows the right n and clears; the network panel
      shows no `/api/v1/training-catalog` call.

## Phase 3: Course, lesson and learn pages

- [x] **T8: Course and lesson pages on D4, with the programme breadcrumb**
  - Acceptance:
    - `course.store.ts` and `lesson.store.ts` load `learnerEndpoints.course` once; the course page uses its
      `content` instead of a second enrollment read where the content is enough.
    - Breadcrumb: Danh mục khóa học › {programName} › {title}. The meta line starts with "{fieldName} ·
      {moduleName}"; a null name is left out, never shown as "—".
    - `core/learning/learner-course.ts` and its spec are deleted.
  - Verify: specs cover the breadcrumb with and without names, the not-enrolled course, and a refused course;
    the lesson spec loads through D4.
  - Files: `course.store.ts`, `course.html` / `.ts`, `course.spec.ts`, `lesson.store.ts`, `lesson.spec.ts`,
    `learner-course.ts` (+ spec, deleted).
  - Size: M. Depends on: Checkpoint B.

- [x] **T9: Learn page tabs and counts; "Chưa đạt" and "Quá hạn" on the course card**
  - Acceptance:
    - Tabs: Đang học, Chưa bắt đầu, Đã hoàn thành, Bắt buộc, Được giao, each with the summary's count. "Được
      giao" lists `myCourses` with `assigned: true`.
    - `learn.store.ts` no longer reads `trainingCatalogEndpoints`; the programme name comes from the card.
    - The course card shows one status label: "Chưa đạt" when `failed`, "Quá hạn" when `deadlineStatus` is
      overdue, as status tones (`visual-design.md`: at most one coloured badge per card).
  - Verify: `learn.store.spec.ts` covers the five tabs, their queries and counts; `course-card.spec.ts` covers
    both labels and their precedence.
  - Files: `learn.store.ts` (+ spec), `learn.html`, `shared/course/course-card*.ts|html`, `course-labels.ts`.
  - Size: S–M. Depends on: T8.

- [x] **T10: End-to-end check against the spec**
  - Acceptance: the spec's success criteria 1–5 are written here, each with how it was checked.
  - Verify, as `hocvien` on the local stack in the browser:
    - the catalogue filters and sorts, and "Xóa n bộ lọc";
    - "Chưa đạt" lists a course whose final exam the learner failed (check the data first; see the plan's risk
      table);
    - the five learn tabs and their counts against `progress/summary`;
    - the course page and the lesson page each make one D4 call, with the programme breadcrumb.

    Then each changed screen at 1280 and 375 px, light and dark, against the `visual-design.md` checklist.
    Finally, `mvn clean verify` and `npm run check` are green.

  - Files: `tasks/todo.md`, `SPEC-catalog-discovery.md` (status).
  - Size: S. Depends on: T9.
  - Result (2026-11-01, as `hocvien` on the local stack, backend `:8019` on the T1–T5 code, app on `:4200` with
    `LMS_API_TARGET=http://localhost:8019`; every list below was read back with `curl` using the same query): 1. **Selects and no training-catalog call: met.** The field, programme and module selects list the 4
  - **1. Selects and no training-catalog call: met.** The field, programme and module selects list the 4
    fields, 4 programmes and 6 modules of `GET /me/learning/facets`, in the server's order. Picking field 2
    narrows modules to Quản lý thay đổi and Vận hành EOD and programmes to one; a new field clears the old
    module and programme. Each choice narrows the list and matches `curl` (field 2 → 2 courses; + module 3 →
    1; + programme 2 → 1; field 1 + overdue → 0; programme 3 → 1). The network panel on `/catalog` and
    `/learn` shows `facets` once and no `/api/v1/training-catalog` request.
  - **2. Each status option matches the backend rule: met.** Chưa bắt đầu 3, Đang học 2, Đã hoàn thành 2, Chưa
    đạt 1 (`failed=true`), Quá hạn 1 (`overdue=true`), Được giao 5 (`assigned=true`); the three sorts (hạn
    gần nhất, tiến độ, tên) return the order `curl` returns. "Chưa đạt" lists FE-DEMO-C1, whose
    `/me/quiz-attempts` rows for course 1 are all `passed: false`; course 8, with one passed attempt, is not
    listed. "Xóa n bộ lọc" showed 1, 2, 3 and 4 as filters were added, counted the status, and cleared to
    the default URL. The scope tab "Được giao" and the status option "Được giao" both stay, as decided.
  - **3. Five learn tabs match `progress/summary`: met.** The tabs read Đang học 2, Chưa bắt đầu 3, Đã hoàn thành
    2, Bắt buộc 5, Được giao 5 and `counts` is `{inProgress 2, notStarted 3, completed 2, mandatory 5,
assigned 5}`. Each tab's grid equals `courses` with the same query. The cards show one badge at most:
    "Chưa đạt" on FE-DEMO-C1, "Quá hạn" on FE-DEMO-C3, "Hoàn thành" on completed ones.
  - **4. One course call per page: met.** `/course/1` makes `GET /me/learning/courses/1`, then the enrolment
    and quiz reads, and no list read; the breadcrumb is Danh mục khóa học / Nền tảng nghiệp vụ Core Banking /
    Tổng quan hệ thống Core Banking and the meta line starts "Nghiệp vụ Core Banking · Tổng quan · FE-DEMO-C1".
    `/lesson/1/2` makes the same single course call and plays the lesson. `/course/6` (unpublished) answers
    `LEARNING-NOT_FOUND` and the page says "Không tìm thấy khóa học". The not-enrolled course and the null
    names are covered by specs, since `hocvien` is enrolled in every course he can see.
  - **5. Both suites green: met, with one note.** `npm run check` is green (format, lint, typecheck, test, build,
    bundle guard). `mvn clean verify` was green at Checkpoint A (333 tests) and the backend has not changed
    since (HEAD `7503c4b`, clean tree); it was not run again because `:8019` serves from that checkout's
    `target/`. - Screens at 1280 and 375 px, light and dark: catalogue, learn, course (lesson only at 1280 light for
    playing). No horizontal page scroll; the checklist holds. One finding: the five learn tabs need 708 px and
    the main column at 1280 px gives 624 px, so "Được giao" is partly clipped until the strip scrolls (the
    `ui-tabs` strip scrolls by design, as in the mockup). Open for a decision.

### Checkpoint C

- [x] Criteria 1–5 recorded.
- [x] Spec status set to built.
- [ ] Review with the user, then plan the next module.
