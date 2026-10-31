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

## Phase 1: Backend

- [ ] **T1: `failed` through the quiz port, and the D3 card fields**
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

- [ ] **T2: `assigned`, `failed` and `overdue` filters on both lists and the export**
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

- [ ] **T3: `GET /api/v1/me/learning/facets`**
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

- [ ] **T4: `GET /api/v1/me/learning/courses/{courseId}`**
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

- [ ] **T5: `assigned` and `mandatory` counts in the progress summary**
  - Acceptance:
    - `LearningProgressOverview.Counts` gains `assigned` and `mandatory`.
    - Each is the total of the `MINE` search with `assigned=true` or `requirement=mandatory` (plan amendment 3).
  - Verify: `ProgressSummaryCountsIT` checks that both counts equal the `totalElements` of the matching list
    call for `hocvien`. `docs/api/LEARNING.md` gets D5 and the `failed` rule.
  - Files: `LearningProgressOverview.java`, the summary service, `docs/api/LEARNING.md`, the new IT.
  - Size: S. Depends on: T2.

### Checkpoint A

- [ ] `mvn clean verify` green (as before: 42 `CommunityApiIT` tests skipped).
- [ ] As `hocvien`, with `curl` on `:8019`:
  - `facets` lists names;
  - each of `assigned`, `failed`, `overdue` on `catalog` and `courses`;
  - `courses/{id}` for an enrolled course, a visible one and a hidden one;
  - `progress/summary` counts agree with the lists.
- [ ] Show the backend diff to the user before Phase 2.

## Phase 2: App

- [ ] **T6: Contracts and mocks**
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

- [ ] **T7: Catalogue on facets and the new status filters**
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

- [ ] `npm run check` green.
- [ ] On `lms-local` as `hocvien`: the three selects list real names and each narrows the list; each status
      option and each sort changes the list; "Xóa n bộ lọc" shows the right n and clears; the network panel
      shows no `/api/v1/training-catalog` call.

## Phase 3: Course, lesson and learn pages

- [ ] **T8: Course and lesson pages on D4, with the programme breadcrumb**
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

- [ ] **T9: Learn page tabs and counts; "Chưa đạt" and "Quá hạn" on the course card**
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

- [ ] **T10: End-to-end check against the spec**
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

### Checkpoint C

- [ ] Criteria 1–5 recorded.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan the next module.
