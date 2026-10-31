# Tasks: `learner-quiz`

Spec: [SPEC-learner-quiz.md](../SPEC-learner-quiz.md) · Plan: [plan.md](plan.md).
The previous `local-stack` checklist and its T7 results are in git history at `55a756f`.

- **Repositories:** the backend is `~/my-projects/corebanking-academy`; the frontend is this repository.
- **Branch:** `feat/learner-mockup-gap` in both. Nothing is pushed.
- **Local stack:**
  - the backend reads `.env.local` (`set -a; . ./.env.local; set +a`);
  - the app runs with the `lms-local` launch config;
  - accounts: `hocvien` as the learner, `quantri` as the editor;
  - passwords come only from environment variables.

Each backend test file is a DB-backed integration test that extends `AssessmentIntegrationTest`.

## Phase 1: Backend

- [x] **T1: `course_lessons.quiz_id` (DB, entity, view) and spec amendments**
  - Acceptance:
    - `docs/sql/upgrade/2026-11-01-learner-quiz.sql` adds the column, its comment and a partial index.
    - `…rollback.sql` stops if a lesson of type `quiz` exists, and otherwise drops the index and the column.
    - `learning_hub_learning.sql` gets the same column. The README gets the `psql` lines.
    - `CourseLesson.quizId` is mapped, and `CourseLessonView` gains `quizId`.
    - `SPEC-learner-quiz.md` gets the five amendments from the plan.
  - Verify:
    - the upgrade and the rollback both apply on the local DB, and the upgrade is applied again afterwards;
    - the backend starts with `ddl-auto=validate`;
    - `mvn -q test` is green.
  - Files: 2 upgrade scripts, `learning_hub_learning.sql`, `docs/sql/README.md`, `CourseLesson.java`,
    `LearningViews.java`, plus the FE spec.
  - Size: S. Depends on: none.

- [x] **T2: Saving and publishing quiz lessons**
  - Acceptance:
    - The `LearningQuizDirectory` port lives in `learning`. Its implementation in `assessment` looks up a quiz
      by id and returns `courseId`, `status` and `deleted`.
    - `LessonInput` gains `quizId`.
    - Saving a draft:
      - a quiz lesson with blocks → `LEARNING-BLOCK_INVALID`;
      - a `quizId` that belongs to another course or is deleted → `LEARNING-QUIZ_INVALID`;
      - a `null` `quizId` is allowed.
    - Publishing: a quiz lesson whose quiz is missing or not PUBLISHED → `LEARNING-QUIZ_LESSON_UNLINKED`.
    - `cloneContent` keeps `quizId` when creating a draft, and clears it when copying to another course.
    - The new codes, with Vietnamese messages, are added to `LearningResponseCode`.
  - Verify: `QuizLessonContentIT` covers:
    - save with a `quizId` from the same course;
    - another course's quiz is refused;
    - publish with no quiz is refused;
    - publish with a PUBLISHED quiz succeeds;
    - the draft keeps `quizId`;
    - the copy clears it.
  - Files: port and implementation, `LearningRequests.java`, `LearningContentService.java`,
    `LearningResponseCode.java`, the new IT.
  - Size: M. Depends on: T1.

- [x] **T3: Passing the quiz completes the quiz lesson**
  - Acceptance:
    - `LearningAssessmentAccess.quizPassed(userId, enrollmentId, quizId)` asks `LearningProgressService` to set
      `lesson_progress = 100` on every quiz lesson of that enrollment's revision that has this `quizId`, then
      runs `updateEnrollment`.
    - `AttemptGrader` calls it after saving an attempt with `passed = true`. This covers submit, expiry,
      submit on behalf and regrade.
    - If the enrollment is missing or withdrawn, the call is logged and skipped, and the grade is kept.
    - `requiredLessonsCompleted` counts only `content` lessons.
  - Verify: `QuizLessonCompletionIT` covers:
    - fail → nothing changes;
    - pass → the lesson is at 100% and the course is complete when it was the last required lesson;
    - an expired attempt that passes completes the lesson the same way;
    - a withdrawn enrollment → the grade is kept and progress is untouched;
    - a quiz with `requireLessonsCompleted` is not blocked by its own quiz lesson.

    `LearnerQuizFlowIT` stays green.

  - Files: `LearningAssessmentAccess.java`, `LearningProgressService.java`, `AttemptGrader.java`, the new IT.
  - Size: M. Depends on: T2.

- [x] **T4: `GET /api/v1/me/courses/{courseId}/quizzes`**
  - Acceptance:
    - Returns `List<LearnerQuizCard{ quiz, summary, canStart, blockReason, availableAt, lessonId }>`.
    - Only PUBLISHED quizzes that are not deleted are listed, with FINAL_EXAM last.
    - It uses the same access rule as the intro, and reuses the intro's summary and block code.
    - `lessonId` is the quiz lesson in the caller's revision, read through the Learning adapter.
    - The endpoint has `@Operation` and `@ApiResponse`.
  - Verify: `LearnerCourseQuizzesIT` covers:
    - order and status;
    - a DRAFT quiz is hidden;
    - another course the caller cannot access is refused;
    - `lessonId` is filled.
  - Files: `LearnerQuizController.java`, `QuizAttemptService.java` (or a new `LearnerQuizListService`),
    `AssessmentViews.java`, `LearningAssessmentAccess.java`, the new IT.
  - Size: M. Depends on: T3.

- [x] **T5: Demo quiz lessons (dev SQL) and backend docs**
  - Acceptance:
    - `docs/sql/learning_hub_learner_quiz_demo.sql`:
      - dev and test only, with the same header style and run-once guard as the other demos;
      - adds a required quiz lesson to the published revision of `FE-DEMO-C1` and `FE-DEMO-C2`, linked to that
        course's FINAL_EXAM;
      - is added to `local-db-init.sh` after the assessment demo.
    - `docs/api/ASSESSMENT.md`: the new endpoint, the quiz lesson rule, the one-way regrade, and an updated
      "Chưa làm" list.
    - `docs/api/LEARNING.md`: `quizId` and the two new error codes.
  - Verify:
    - run the SQL on the local DB;
    - as `hocvien`, `curl` the new endpoint and see `lessonId`;
    - a second run of the SQL stops without changing anything.
  - Files: the demo SQL, `local-db-init.sh`, `docs/sql/README.md`, `ASSESSMENT.md`, `LEARNING.md`.
  - Size: S. Depends on: T4.

### Checkpoint A

- [x] `mvn clean verify` green (310 tests, 42 skipped `CommunityApiIT` as before).
- [x] As `hocvien`, with `curl`:
  - list the quizzes of `FE-DEMO-C1`;
  - start and submit the final exam with wrong answers, then with right ones;
  - the quiz lesson is at 100% and, once the course's other required lessons are done, the enrollment is
    `completed`.
  - Run on a throwaway copy of the DB (`flow_check`, backend on :8039) using `FE-DEMO-C2`, because its final exam is
    the one that needs the other lessons done first; `FE-DEMO-C1` was only listed (lessonId filled).
- [ ] Show the backend diff to the user before Phase 2.

## Phase 2: App

- [x] **T6: Learner quiz contracts and mocks**
  - Acceptance:
    - `libs/contracts/src/lib/assessment/learner-quiz.schema.ts` and `learner-quiz.endpoints.ts`
      (`learnerQuizEndpoints`) hold the 10 keys from the spec plus `myCompetency`. Each schema mirrors its
      backend record field by field.
    - The course contracts gain `quizId` on the lesson and on the lesson input.
    - There is a real key for the admin quiz list (`GET /api/v1/quizzes`).
    - `libs/mocks/src/lib/assessment` serves the new paths from its seed.
  - Verify: `npx nx test contracts` covers:
    - parsing a response captured from the local backend for each key (saved as a fixture);
    - a wrong shape is refused.

    `npx nx test mocks` is green.

  - Files: 2 new contract files plus a spec, the course schema, the assessment mock.
  - Size: M. Depends on: Checkpoint A.

- [x] **T7: Learner quiz, part 1: store, hub, intro, attempts**
  - Acceptance:
    - `features/quiz/learner-quiz/` has `learner-quiz.store.ts` (`serverData` / `serverMutation`) and the hub,
      intro and attempts views.
    - The intro shows `canStart`, or one Vietnamese sentence per `blockReason` (copy from the mockup where it has
      one).
    - The routes `quiz`, `quiz/:id` and `quiz/:id/attempts` point to it.
    - The `QUIZ_TAKING` group `requires` the new keys.
  - Verify: store and component specs cover:
    - each `blockReason`;
    - the hub groups attempts by quiz;
    - the attempts table and the CSV.

    `npx nx test lms` is green.

  - Files: store plus spec, the hub, intro and attempts components, `screens.ts`.
  - Size: M. Depends on: T6.

- [x] **T8: Learner quiz, part 2: take and result; trim `AssessmentScreen`**
  - Acceptance:
    - `assessment-take` and `assessment-result` move to `features/quiz/components/` and take the new schemas.
    - Take screen:
      - the countdown comes from the server's `deadlineAt` and `serverTime`;
      - each answer is saved with `PATCH`, with "Thử lại" when the save fails;
      - a reload restores the attempt from the session;
      - the question code is shown, as in the mockup.
    - Result screen:
      - the primary action is "Về khóa học";
      - the review is collapsed;
      - the per-competency breakdown is shown.
    - The routes `quiz/:id/take` and `quiz/:id/result/:attemptId` point to the new feature.
    - The learner branches, keys and mock handlers are removed from `AssessmentScreen`, its store,
      `assessment.endpoints.ts` and the mocks.
  - Verify:
    - specs cover answer → save, a failed save → retry, submit → result, and the countdown with a skewed
      `serverTime`;
    - the existing admin specs stay green;
    - `npm run check` is green.
  - Files: the two moved components, the learner store, `assessment-screen.store.ts`, `assessment.endpoints.ts`.
    The mock file and `screens.ts` are touched in the same commit; keep it at 7 files at most.
  - Size: M–L (split again if it grows past 7 files). Depends on: T7.

### Checkpoint B

- [x] `npm run check` green (fourth run, commit `febc7c4`).
- [x] On `lms-local` as `hocvien` (checked 2026-10-31; `quantri` sees the admin menu and no quiz menu):
  - the "Làm bài kiểm tra" menu shows;
  - the final exam of `FE-DEMO-C1` can be taken end to end, including a reload in the middle;
  - the network panel shows only `/api/v1/me/…` calls for quizzes.
- [x] On `mockBackend: true` as an admin, the admin question and quiz screens still work.

## Phase 3: Course, player, editor

- [x] **T9: The course page "Bài kiểm tra" section and the quiz lesson in the player**
  - Acceptance:
    - The course store loads `courseQuizzes`.
    - The page shows a final-exam card with the pass mark, attempts left, best score, and either the
      "Làm bài" button or the block reason, and lists the other quizzes as rows.
    - In the player, a quiz lesson shows its quiz card, with "Làm bài" linking to `quiz/:quizId`, instead of
      "Bài kiểm tra chưa mở.".
    - The outline uses the quiz icon for quiz lessons.
  - Verify: specs cover the course page with and without a final exam, and the player's quiz lesson.
  - Files: `course.store.ts`, `course.html` / `.ts`, `lesson.store.ts`, `lesson.html`.
  - Size: M. Depends on: Checkpoint B.

- [x] **T10: The quiz picker in the course editor**
  - Acceptance:
    - For a quiz lesson, a "Bài kiểm tra" select lists the course's quizzes from the admin list (title, type,
      status; non-PUBLISHED ones are marked).
    - `course-draft.ts` sends `quizId`.
    - The server's `LEARNING-QUIZ_INVALID` and `LEARNING-QUIZ_LESSON_UNLINKED` messages appear on save and on
      publish.
  - Verify: specs cover the select, the draft mapping both ways, and the server error shown.
  - Files: `lesson-form.ts` / `.html`, `course-draft.ts`, the editor store.
  - Size: S–M. Depends on: T9.

- [ ] **T11: End-to-end check against the spec**
  - Acceptance: the spec's success criteria 1–5 are written here, each with how it was checked.
  - Verify, as `quantri` in the browser:
    - add a quiz lesson to a draft and pick the final exam;
    - publish, then try publishing with another course's quiz (the error must show).

    Then, as `hocvien`:
    - fail and then pass the quiz from the course page;
    - the lesson and the course are complete.

    Finally, `mvn clean verify` and `npm run check` are green.

  - Files: `tasks/todo.md`, `SPEC-learner-quiz.md` (status).
  - Size: S. Depends on: T10.

### Checkpoint C

- [ ] Criteria 1–5 recorded.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan `catalog-discovery`.
