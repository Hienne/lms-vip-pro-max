# Implementation Plan: `course-final-exam`

Spec: [SPEC-course-final-exam.md](../SPEC-course-final-exam.md) (approved; amended below). Map:
[SPEC-course-authoring.md](../SPEC-course-authoring.md). Tasks: [todo.md](todo.md).

This plan replaces the one for `course-wizard-create`. That plan is done; it is in git history at `e838065`.

## Overview

Step 3 of the course editor gets the "Bài kiểm tra cuối khóa" select (the course's `FINAL_EXAM` quiz or none). The
backend stores the choice as one `course_assessments` row per revision, validates it on save and on publish, and
requires passing it for completion. No DB change.

## What was checked while planning (2026-11-03)

**Backend (`feat/course-wizard-create` at `b8529eb`, not merged yet)**

- **`course_assessments`** exists in the learning baseline with every column the row needs. The local DB has no row.
- **Publish** throws `QUIZ_UNAVAILABLE` when the revision has any row (`LearningContentService` ~562). Quiz lessons
  are checked at publish with `QUIZ_LESSON_UNLINKED` (~544), and on save with `QUIZ_INVALID` (~402, ~413).
- **Completion** is decided in `LearningProgressService.updateEnrollment`: every required lesson at 100% and
  `repository.assessments(revisionId).isEmpty()`.
- **`completeQuizLessons(userId, enrollmentId, quizId)`** is the passing hook, called by `LearningAssessmentAccess`
  (line 189) from the grading transaction. It returns early when no quiz lesson of the revision points at the quiz.
- **`LearningQuizDirectory`**:
  - `QuizRef(quizId, courseId, status, deleted)` has no type or pass data;
  - `scores(userId, courseIds)` returns `passed` per quiz, following its `scoreMethod`;
  - it is implemented by `assessment/service/AssessmentQuizDirectory`.
- **`CourseAssessmentView`** and the mapper exist, but the course detail does not return assessments.
- `applyDraft` (from `course-wizard-create`) is the one place that writes a draft's tree, for both save and create.

**Local data**

- `FINAL_EXAM` quizzes:
  - quiz 2 on `FE-DEMO-C1` (course 1), pass 70%, 2 attempts;
  - quiz 4 on `FE-DEMO-C2` (course 2), which requires the lessons to be completed;
  - quiz 5 on `QZ-E2E-01` (course 8).

  All three are published.

- Courses 1, 2 and 8 each have learners enrolled on their published revisions (rule 3 keeps them unaffected).

**App (`feat/course-authoring` at `e838065`)**

- The editor store already loads `courseQuizList` by course (not in create mode). Quiz summaries carry `quizType`
  and `status`.
- `course-rules` (step 3) holds the reward points. `draftChecks` holds the step 4 lines.

## Decisions (amendments to the spec)

1. **Open questions** (by approval, 2026-11-03): no pass score in the completion line; no change on the learner's
   course page.
2. **Detail shape.** `CourseDetail` gains a top-level `finalQuizId` (nullable), read from the revision's final row.
   No assessments list is exposed.
3. **One row per revision.** `applyDraft` deletes the revision's rows, then writes at most one. `placement` is the
   string `final`, a constant in `CourseAssessment` or a small enum, documented in `LEARNING.md`.
4. **`QuizRef`** gains `quizType`, `passPercent`, `maxAttempts` and `allowRetakeAfterPass`. Every existing
   constructor call is updated. No behaviour changes for quiz lessons.
5. **Completion check.** A private `finalExamPassed(enrollment)` returns true when the revision has no final row.
   Otherwise it asks `quizzes.scores(userId, List.of(courseId))` for the row's quiz and reads `passed`.
   `updateEnrollment` uses it in place of `assessments(...).isEmpty()`.
6. **Passing hook.** `completeQuizLessons` marks the quiz lessons as today. When the quiz is the revision's final
   exam, it then calls `updateEnrollment` even with no quiz lesson, and returns true.
7. **New code** `FINAL_EXAM_UNPUBLISHED("LEARNING-FINAL_EXAM_UNPUBLISHED", …)`, refused kind. `QUIZ_UNAVAILABLE`
   stays in the enum but is no longer thrown by publish.
8. **Branches.**
   - The backend builds on `course-wizard-create`: branch `feat/course-final-exam` from `feat/course-wizard-create`
     (`b8529eb`), in a new worktree `~/my-projects/corebanking-academy-final-exam`. Its PR waits for the wizard PR.
   - The app stays on `feat/course-authoring`.
9. **Checkpoint data** is made through the API only. As `quantri`:
   1. create `WIZ-FE-01` (optional, one required text lesson) with the wizard's create;
   2. author and publish a `FINAL_EXAM` quiz for it with the assessment API, plus enough questions;
   3. save `finalQuizId`, then publish.

   Then `hocvien.tichhop` enrolls from the catalog, completes the lesson, then takes and passes the exam through the
   learner quiz API. No SQL.

## Phases

### Phase 1: Backend (child session, worktree `~/my-projects/corebanking-academy-final-exam`) → Checkpoint A

- **B1. Store and read the final exam.**
  - `QuizRef` fields;
  - `DraftContent` / `DraftRequest.finalQuizId`;
  - the save validation (`QUIZ_INVALID`, field `finalQuizId`);
  - the row written in `applyDraft`;
  - `CourseDetail.finalQuizId`;
  - the revision copy.
- **B2. Publish and completion.** `FINAL_EXAM_UNPUBLISHED`, the publish check replacing the blanket refusal,
  `finalExamPassed`, and the passing hook.
- **B3. Tests and docs.** The spec's integration tests; `LEARNING.md` and `LEARNING_CURL.md`.
- **Checkpoint A (main session):**
  - restart :8019 from the new worktree;
  - run Decision 9 with `curl`: the in-progress state before the exam, completed after it;
  - check the refusals (a `PRACTICE` quiz, an unpublished final exam);
  - check that course 1's existing enrollments are unchanged;
  - `mvn -o clean test` green, in a temporary worktree.

### Phase 2: App (child session, this checkout) → Checkpoint B

- **F1. Contracts and mock.** `finalQuizId` on the save command and the detail; the new message code; fixtures
  captured from the local backend; the mock save, detail and publish.
- **F2. Step 3 and the checklist.** Mapping round trip; the two sections in `course-rules`; the `draftChecks` lines.
- **F3. Docs.** The spec's implementation notes and the migration entry.
- **Checkpoint B (main session):**
  - review each diff, then run `npm run check`;
  - in the browser as `quantri`, on `WIZ-FE-01`'s draft: the select lists only the `FINAL_EXAM` quiz; save; reload
    and see the choice; publish;
  - on a course without a `FINAL_EXAM` quiz, the empty-case line;
  - in create mode, the "Lưu nháp trước" line;
  - 375, 768 and 1280 px, light and dark, keyboard.

## Before merging (the user)

- No SQL.
- Merge order:
  1. the `course-wizard-create` backend PR;
  2. this backend PR;
  3. wait for the deploy;
  4. the app PR.

  The app branch carries both modules.

## Risks

- **Older clients that save the tree** without `finalQuizId` clear the final exam. The app's editor is the only
  client in this repo; `LEARNING.md` says so.
- **Grading transaction.** `completeQuizLessons` runs inside grading. The extra `scores` query is one more read in
  that transaction, and a failure there must not lose the grade. Keep the call's current "return false, never
  throw" contract.
- **`require_lessons_completed`** on a quiz is independent of this rule. Both can apply, and no change is needed.
