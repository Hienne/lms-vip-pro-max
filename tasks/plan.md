# Implementation Plan: `catalog-discovery`

Spec: [SPEC-catalog-discovery.md](../SPEC-catalog-discovery.md) (approved 2026-10-31, amended below). Map:
[SPEC.md](../SPEC.md). Tasks: [todo.md](todo.md).

This plan replaces the one for `learner-quiz`. That plan is done, and it is in git history at `3da2ff3`.

## Overview

The goal is that a learner can find a course the way the mockup's `catalog` and `learn` pages describe, on the
real backend.

- **Backend (`corebanking-academy`):**
  - A learner can read the field, programme and module names of the catalogue (D1).
  - The course lists take the `assigned`, `failed` and `overdue` filters (D2), and each card carries the names
    and the `failed` flag (D3).
  - One call returns a learner's course by id (D4).
  - The progress summary counts assigned and mandatory courses (D5).
- **App:**
  - The catalogue's selects and status filter run on the new endpoints.
  - The learn page shows five tabs with counts.
  - The course page and the lesson page read the course with one call and show the programme breadcrumb.

No schema change, so no upgrade script.

## What was checked while planning (2026-10-31)

**Backend**

- **The course lists.** `LearningLearnerController` serves `/me/learning/courses` (mode `MINE`) and
  `/me/learning/catalog` (mode `CATALOG`) through `LearningSearchService.search` and
  `CourseRepositoryCustomImpl.search`. `LearningInstructorController` uses the same query in mode `MANAGE`.
  - `overdue` already exists as a filter, but only `/courses` passes it.
  - The card already has `assigned` (an active assignment on the current enrollment) and `overdue`. D2's
    `assigned` filter is that same expression.
  - The query already joins `training_programs p` and `training_fields f`. Modules live in
    `learning_hub.business_modules` (with `field_id`), which is not joined yet.
- **Visibility.** The learner rule (enrolled, or active, published course in a published programme and field,
  owned by the caller's org or shared to it) is written inline in `search`. D1 needs the same rule.
- **Course content.** `LearningContentService.detail(course, revision)` builds a `CourseDetail`. The enrolled
  revision is the card's `revisionId` (`coalesce(e.revision_id, c.published_revision_id)`).
- **Progress summary.** `CourseRepositoryCustomImpl.summary` counts by enrollment status and overdue. It has no
  requirement or assignment counts.
- **Quiz data for `failed`.** `quiz_attempts` has `user_id`, `status`, `passed` and `graded_at`. There is one
  FINAL_EXAM per course (`ux_asm_quizzes_final`). `everPassed` is computed in `QuizAttemptService` as "some
  graded attempt passed". Learning already reaches Assessment through the `LearningQuizDirectory` port.
- **Not found.** No `LEARNING-COURSE_NOT_FOUND` code was found. T4 checks `LearningResponseCode` for an existing
  course-not-found code before adding one.

**App**

- `features/learning/catalog/data-access/catalog.store.ts` already has the filters in the URL, the sort select
  and the clear count. It reads fields, programmes and modules from `trainingCatalogEndpoints`, which a learner
  is refused. It sends `learningStatus=failed|overdue`, which the backend does not know. Its "Được giao" scope
  lists `myCourses`.
- `features/learning/learn/data-access/learn.store.ts` has four tabs. It reads programme names from
  `trainingCatalogEndpoints.listPrograms`.
- `core/learning/learner-course.ts` (`findLearnerCourse`) pages through `myCourses`, then `catalog`. It is used
  by `course.store.ts` and `lesson.store.ts`.
- The admin stores (course editor, training catalogue, courses) keep `trainingCatalogEndpoints`; they are out of
  scope.

## Spec amendments (written into the spec with this plan)

1. **`failed` goes through the quiz port.** `LearningQuizDirectory` gains
   `failedFinalExamCourseIds(userId)`, implemented in `assessment`. A course is in the set when its FINAL_EXAM
   is PUBLISHED and not deleted, the caller has at least one graded attempt (`SUBMITTED` or `AUTO_SUBMITTED`,
   `graded_at` set), and none of their graded attempts passed. The search binds the set as
   `c.course_id in (:failedIds)`, both as the D2 filter and as the D3 flag. Learning reads no Assessment table.
   This is the spec's second option, chosen because it keeps the module boundary and the set is small (one row
   per course the learner took a final exam in). `MANAGE` mode does not call the port, and its `failed` is
   always false. T1 records `EXPLAIN (ANALYZE, BUFFERS)` of the port query on the demo data; no index is added
   unless that plan shows a sequential scan on `quiz_attempts`.
2. **One visibility rule.** The learner visibility condition moves into one private method of
   `CourseRepositoryCustomImpl`, used by both `search` and the new facets query, so the two cannot drift.
3. **Counts reuse the list.** D5's `assigned` and `mandatory` are the totals of the `MINE` search with
   `assigned=true` and `requirement=mandatory`, so the tabs always agree with the lists (spec testing line
   "D5 counts agree with D2 totals").
4. **The status filter is one choice.** The app sends at most one of `learningStatus`, `failed=true`,
   `overdue=true` or `assigned=true`, following the mockup's single "Trạng thái" select.
5. **Open questions take their defaults.** "Được giao" means "has an active assignment". D1 covers the whole
   visible catalogue, self-enrol courses included.

6. **D4 before enrolment** (decided by the user on 2026-10-31: "Duyệt, ẩn blocks"). The spec said `content` is
   the published revision when the caller is not enrolled, but `CourseDetail` includes every block, so a learner
   could read a course's lessons without enrolling, and the course page needs only the outline. For a caller who
   is not enrolled, `content` keeps the chapters and lessons and every lesson's `blocks` list is empty. An
   enrolled caller gets the full revision. Media access is unchanged.

## Architecture decisions

- **Backend.**
  - The new filters extend `CourseSearch` and `LearningSearchService.search`.
  - `CourseCard` grows by `fieldId`, `fieldName`, `programName`, `moduleName` and `failed`, at the end of the
    record so the projection order stays readable. The instructor list gets the same fields, with `failed`
    false.
  - D1 is a new method on `CourseRepositoryCustom`, returning three lists in one call.
  - D4 is a new method on `LearningSearchService`: it finds the card through `search` with a `courseId` filter
    in `CATALOG` mode, then builds `content` with `LearningContentService.detail`.
  - The CSV export goes through `CourseCard` too. T1 checks that its columns do not change.
- **App.**
  - Contracts change in `libs/contracts/src/lib/learner` and the course card schema. The new keys are
    `learnerEndpoints.facets` and `learnerEndpoints.course`.
  - `catalog.store.ts` maps one "Trạng thái" choice to one query flag. The "Được giao" scope becomes `catalog`
    with `assigned: true`.
  - `findLearnerCourse` and its spec are deleted. `course.store.ts` and `lesson.store.ts` call D4.
  - The programme name on a card comes from `programName`, so the learn and catalogue stores stop reading
    `trainingCatalogEndpoints`.
  - The in-app mock (`libs/mocks/src/lib/learning`) serves every new key, filter and field, so
    `mockBackend: true` keeps working.
- **Commits.**
  - One commit per task, in each repository the task touched, on `feat/learner-mockup-gap`.
  - Nothing is pushed.
  - The user's uncommitted `.claude/launch.json` and `docs/reports/…html` are never staged.

## Task list

### Phase 0: `learner-quiz` review fixes (approved 2026-10-31)

- [ ] F1: Learner quiz stores follow angular.md §5.2
- [ ] F2: Result screen and server-only numbers
- [ ] F3: Visual-design checklist on the quiz screens
- [ ] F4: Question code on the take screen (BE + FE)
- [ ] F5: Route stores and components in their route folders
- [ ] F6: Flaky `course-new.spec.ts`

### Checkpoint 0

- [ ] `npm run check` and `mvn clean verify` green; the quiz screens checked on `lms-local`.
- [ ] Main session reviews the Phase 0 diff before T1.

### Phase 1: Backend

- [ ] T1: `failed` through the quiz port, and the D3 card fields
- [ ] T2: `assigned`, `failed` and `overdue` filters on both lists and the export
- [ ] T3: `GET /me/learning/facets`
- [ ] T4: `GET /me/learning/courses/{courseId}`
- [ ] T5: `assigned` and `mandatory` counts in the progress summary

### Checkpoint A

- [ ] `mvn clean verify` green.
- [ ] `curl` as `hocvien` for each new endpoint and filter.
- [ ] Show the backend diff to the user before Phase 2.

### Phase 2: App

- [ ] T6: Contracts and mocks
- [ ] T7: Catalogue on facets and the new status filters

### Checkpoint B

- [ ] `npm run check` green.
- [ ] On `lms-local`, the catalogue's selects and every status option work.

### Phase 3: Course, lesson and learn pages

- [ ] T8: Course and lesson pages on D4, with the programme breadcrumb
- [ ] T9: Learn page tabs and counts; "Chưa đạt" and "Quá hạn" on the course card
- [ ] T10: End-to-end check against the spec

### Checkpoint C

- [ ] Success criteria 1–5 recorded.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan the next module.

## Risks and mitigations

| Risk                                                                  | Impact | Mitigation                                                                                                                                                                  |
| --------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The facets and the list disagree about which courses are visible      | High   | One private visibility method used by both queries; an IT checks that every facet value has a visible course behind it.                                                     |
| Adding columns to `CourseCard` changes the instructor list or the CSV | Med    | Fields are added at the end; T1 runs the existing instructor and export ITs, and checks the CSV header is unchanged.                                                        |
| D5 counts drift from the tab lists                                    | Med    | The counts are the totals of the same search (amendment 3); an IT compares them.                                                                                            |
| The `failed` set costs a query on every list call                     | Low    | One indexed query per call for one user; `EXPLAIN` on the demo data in T1.                                                                                                  |
| Demo data no longer has a failed final exam for `hocvien`             | Low    | T10 checks the data first. If no such course exists, it uses `hocvien.tichhop` or a failed attempt made through the app, and says which. It never edits attempts in the DB. |
| The UI polish branch also touches the learn tabs and the catalogue    | Low    | This plan builds on `feat/learner-mockup-gap` only; if the polish branch merges first, these screens are rebased onto it (SPEC.md → Branches).                              |

## Open questions

None. The D4 question is decided (amendment 6), and the spec's two open questions take their defaults.
