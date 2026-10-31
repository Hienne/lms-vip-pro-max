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
- [x] Show the backend diff to the user before Phase 2 (approved 2026-10-31: "Duyệt, làm Phase 2").

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

- [x] **T11: End-to-end check against the spec**
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

  **Results (2026-10-31).** Checked on the local stack: `lms-local` on :4200, backend on :8019, DB `core_academy`.
  The learner part ran as `hocvien.tichhop` on `FE-DEMO-C2` instead of `hocvien`, because `hocvien` had already passed
  `QZ-E2E-01` and had one attempt left on `FE-DEMO-C1`; this kept that demo state. The right answers were read from
  `question_options` of the local DB, since the app does not show them before a pass.
  1. **Every learner quiz call goes to `/api/v1/me/…`, none is `served: 'mock'`.** The browser network panel for the
     whole learner run (course page, intro, start, save, submit, result) lists only `GET /me/courses/2/quizzes`,
     `GET /me/quizzes/4`, `POST /me/quizzes/4/attempts`, `PATCH /me/quiz-attempts/{id}/questions/{qid}`,
     `POST /me/quiz-attempts/{id}/submit` and `GET /me/quiz-attempts/{id}/result`, all `200`. In `libs/contracts`
     `learner-quiz.endpoints.ts` has no `served` key; the `served: 'mock'` keys left in `assessment.endpoints.ts` are
     all `/api/admin/…` (question bank and quiz authoring, out of scope).
  2. **A learner takes a quiz from the course page end to end.** The course page shows the final-exam card with its
     block reason ("Hoàn thành các bài học nội dung… để mở") until the content lessons are done, then "Làm bài".
     Intro → start → answer one question → full reload on `/quiz/4/take`: the answer and "1/6 đã trả lời" came back
     and the clock continued (14:39) → submit → result "Chưa đạt 0%", one attempt left, answers locked. Second
     attempt: all 6 answered (single and multiple choice) → result "Đạt 100%", with the per-competency breakdown.
     The attempts table (`quiz_attempts`) holds attempt 1 at 0% and attempt 2 at 100% passed.
  3. **A quiz lesson saved in the editor shows its quiz in the player; passing completes the lesson and the course.**
     As `quantri`: opened a draft of `QZ-E2E-01`, added a lesson, set its type to "Bài kiểm tra", picked "Thi E2E · Thi
     cuối khóa" (the picker lists only that course's quizzes), saved the draft (`course_lessons.quiz_id = 5` in the
     draft revision) and published (`published_revision_id` moved to the new revision, both quiz lessons keep
     `quiz_id = 5`). As the learner: the quiz lesson in the player (`/lesson/2/19`) shows the quiz card and "Làm bài".
     After the pass, `lesson_progress` for lesson 19 is `completed` at 100.000 with `completed_at` set, and
     `course_enrollments` 4 went from `in_progress` 75.000 to `completed` 100.000. On screen the course page shows
     4/4 required lessons done, the quiz lesson ticked, the final-exam card "Đã đạt · Cao nhất 100%" and
     "Hoàn thành 31/10/2026". A failed attempt changed nothing (lesson 19 had no row, enrollment stayed at 75).
  4. **The server's quiz errors show in the editor.**
     - A quiz lesson with no quiz chosen on publish: the editor shows "Chưa thể xuất bản: Có bài học loại kiểm tra chưa
       chọn bài kiểm tra đã xuất bản của khóa học." (`LEARNING-QUIZ_LESSON_UNLINKED`). The client checklist warns but
       does not block, so the request reaches the server.
     - Another course's quiz: the picker cannot offer one, so the draft save request was edited in the page
       (`quizId: 5`, a quiz of course 8, on the lesson of course 9). The editor shows "Bài kiểm tra chưa hợp lệ: Bài
       kiểm tra không tồn tại, đã bị xóa hoặc không thuộc khóa học này." (`LEARNING-QUIZ_INVALID`). The retry fix
       (`547c229`) held: after each refusal the next publish went out with no data-conflict message.
  5. **Both builds are green and the SQL applies.**
     - `npm run check`: the first run failed on one timeout in `course-new.spec.ts` (11 s under load; it passes alone in
       5.5 s and does not touch this module). The rerun is green (14 tasks, 0 failures).
     - `mvn clean verify` in the backend: `BUILD SUCCESS`, 310 tests, 0 failures, 42 skipped (`CommunityApiIT`, as before).
     - Upgrade and rollback were run with the README `psql` command on `flow_check`, a throwaway copy of
       `core_academy` (dropped afterwards; `core_academy` untouched): rollback with 6 quiz lessons present → refused,
       exit 3, column and index unchanged; after deleting those lessons in the copy → rollback applied, column and index
       gone; upgrade applied; upgrade a second time applied with only a "relation already exists, skipping" notice; the
       column comment is in place.

  **Left in the local DB by this check:** course `QZ-E2E-01` has a second published revision (two quiz lessons);
  course `QZ-E2E-02` (a draft) has a chapter and one quiz lesson with no quiz; `hocvien.tichhop` has passed
  `FE-DEMO-C2` (enrollment 4 `completed`, quiz attempts 5 and 6). `hocvien` is untouched.

### Checkpoint C

- [x] Criteria 1–5 recorded.
- [x] Spec status set to built.
- [ ] Review with the user, then plan `catalog-discovery`.
