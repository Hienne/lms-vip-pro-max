# Implementation Plan: `learner-quiz`

Spec: [SPEC-learner-quiz.md](../SPEC-learner-quiz.md) (approved 2026-10-31, amended below). Map: [SPEC.md](../SPEC.md).
Tasks: [todo.md](todo.md).

This plan replaces the one for `local-stack`. That plan is done, and it is in git history at `55a756f`.

## Overview

The goal is that a learner can take a real quiz from start to finish on the local stack.

- **Backend (`corebanking-academy`):**
  - Quiz lessons can be saved and published.
  - Passing a lesson's quiz completes that lesson.
  - A new endpoint lists a course's quizzes for the signed-in learner.
- **App:**
  - The learner quiz routes move to a new feature that calls the real `/api/v1/me/…` endpoints.
  - The course page and the lesson player show the course's quizzes.
  - The course editor gets a quiz picker.

The admin question and quiz screens stay on mock (the spec's open question 1, at its default).

## What was checked while planning (2026-10-31)

**Backend**

- **Learner quiz API.** `LearnerQuizController` (`/api/v1/me`) with `QuizAttemptService` already covers:
  - intro, start, session, answer, submit and result;
  - history, my attempts, export and competency.

  `LearnerQuizFlowIT` tests this flow against a real database.

- **How Assessment reaches Learning.** Only through `LearningAssessmentAccess`:
  - `requireStudyingLearner(courseId)` returns `enrollmentId` and `revisionId`;
  - `requiredLessonsCompleted(enrollmentId, revisionId)` implements `requireLessonsCompleted`.

  Learning does not depend on Assessment.

- **Saving lessons.**
  - `LessonInput` (`LearningRequests:86`) has no `quizId`.
  - `LearningContentService:127-131` refuses any lesson that is not `content`.
  - `replaceTree` (`:490-508`) builds the lessons.
  - Both the draft and the copy go through `cloneContent` (`:203`, `:235`), starting from the published detail.
- **Course completion.** `LearningProgressService.updateEnrollment` (`:321`) completes a course when every
  required lesson is at 100%. A quiz lesson set to 100% fits this rule unchanged.
- **Grading paths.** All of these end in `AttemptGrader`:
  - the learner submits (`QuizAttemptService:183`);
  - the time runs out (`:106`, `QuizAutoSubmitJob`);
  - an admin submits on the learner's behalf (`submitOnBehalf`);
  - a regrade (`RegradeService`).
- **Admin quiz list.** `GET /api/v1/quizzes?courseId=&status=&quizType=` returns `Page<QuizSummary>` and needs
  the right to manage the course.
- **Where tests live.** There is no `src/test/java/.../learning`. Database-backed tests live in `assessment`,
  extending `AssessmentIntegrationTest`, which loads Identity, Learning, media, Knowledge, Assessment and
  Community.

**App**

- **Current quiz screen.** `features/quiz/assessment-screen` is one component with a 773-line store, serving
  8 routes: the admin question bank and quiz settings, plus the learner hub, intro, take, attempts and result.
  The learner routes all call mock keys.
- **Hidden menu.** The `QUIZ_TAKING` menu group `requires` `quizIntro` and `startAttempt`. While those endpoints
  are mock, `menu-catalog.ts:48` hides the group when running on the real backend.
- **Course editor.** It already has "Loại bài" with "Bài kiểm tra" (`lesson-form.html:20-41`), and it sends no
  blocks for a quiz lesson. What is missing: choosing the quiz, and the `quizId` field.
- **Lesson player.** It has a `quiz` case (`lesson.html:67`) that shows "Bài kiểm tra chưa mở."
- **Endpoint helper.** Endpoints are declared with `defineEndpoint`.

## Spec amendments (written into the spec in T1)

1. **Draft and publish rules.**
   - A draft may contain a quiz lesson with no `quizId`.
   - Publishing requires every quiz lesson to point to a PUBLISHED quiz of the same course that is not deleted.
     Otherwise the backend returns `LEARNING-QUIZ_LESSON_UNLINKED`.
   - Creating a draft from the published version keeps `quizId`.
   - Copying the course to a new course clears `quizId`.
2. **Quiz lookup from Learning.** Learning checks a quiz through a new port, `LearningQuizDirectory`. The port is
   declared in `learning` and implemented in `assessment`, so `learning` still imports no Assessment classes.
3. **Completion hook.** The hook that completes the quiz lesson sits in `AttemptGrader`, so all four grading
   paths are covered. It runs when the attempt is `passed = true`.
   - The hook is one-way. If a regrade turns a pass into a fail, `lesson_progress` is not lowered, because
     progress only ever increases (`max`).
   - This is written down in `ASSESSMENT.md`.
4. **Lessons-completed check.** `requiredLessonsCompleted` counts only `content` lessons.
5. **Demo quiz lessons.** They come from a dev-only SQL file, `learning_hub_learner_quiz_demo.sql`, which adds a
   required quiz lesson to the published revision of `FE-DEMO-C1` and `FE-DEMO-C2`. Publishing a new revision
   would not work here, because `hocvien` is enrolled on the current one.

## Architecture decisions

- **New learner feature.** `features/quiz/learner-quiz/` takes over the routes `quiz`, `quiz/:id`,
  `quiz/:id/take`, `quiz/:id/attempts` and `quiz/:id/result/:attemptId`, with its own store.
  - `assessment-take` and `assessment-result` move to `features/quiz/components/` and take the new schemas.
  - `AssessmentScreen` keeps only the admin routes.
  - The old learner code, keys and mocks are deleted.
- **Countdown.** It is computed from the server's `deadlineAt` and `serverTime`, so a wrong client clock does not
  change it.
- **Saving answers.**
  - Each answer is saved with `PATCH` as soon as it is chosen.
  - If saving fails, the screen shows "Thử lại".
  - Reloading the page restores the attempt from `GET /me/quiz-attempts/{id}`.
- **Server state.** `canStart`, `blockReason` and `availableAt` come from the server. The app shows them and does
  not compute them.
- **Commits.**
  - One commit per task, in each repository the task touched, on `feat/learner-mockup-gap`.
  - Nothing is pushed.
  - The user's uncommitted `.claude/launch.json` and `docs/reports/…html` are never staged.

## Task list

### Phase 1: Backend

- [x] T1: `course_lessons.quiz_id` (DB, entity, view) and the spec amendments
- [x] T2: Saving and publishing quiz lessons (port, validation, copy)
- [x] T3: Passing the quiz completes the quiz lesson
- [x] T4: `GET /me/courses/{courseId}/quizzes`
- [x] T5: Demo quiz lessons (dev SQL) and backend docs

### Checkpoint A

- [x] `mvn clean verify` green.
- [x] A `curl` run as `hocvien` works end to end: list quizzes, take the final exam, pass, and the lesson and the
      course become complete.

### Phase 2: App

- [x] T6: Learner quiz contracts and mocks
- [x] T7: Learner quiz, part 1: store, hub, intro, attempts
- [ ] T8: Learner quiz, part 2: take and result; remove the learner code from `AssessmentScreen`

### Checkpoint B

- [ ] `npm run check` green.
- [ ] On `lms-local`, the quiz menu shows and a quiz can be taken end to end in the browser.

### Phase 3: Course, player, editor

- [ ] T9: The course page "Bài kiểm tra" section and the quiz lesson in the player
- [ ] T10: The quiz picker in the course editor
- [ ] T11: End-to-end check against the spec

### Checkpoint C

- [ ] Success criteria 1–5 recorded.
- [ ] Spec status set to built.
- [ ] Review with you before `catalog-discovery`.

## Risks and mitigations

| Risk                                                                 | Impact | Mitigation                                                                                                                                           |
| -------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Learning error inside the grading transaction rolls back the grade | High   | The hook catches `BusinessException` (enrollment missing or withdrawn), logs it, and keeps the grade. An IT covers this.                             |
| The automatic submit job runs without a signed-in user               | Med    | The hook uses the attempt's `userId` as the actor. An IT covers time running out → pass → lesson completed.                                          |
| Splitting `AssessmentScreen` breaks the admin screens                | Med    | Remove only the learner branches. The admin specs must stay green, and the admin screens are clicked through on `mockBackend: true` at Checkpoint B. |
| Once the menu is real, it shows to the wrong roles                   | Low    | The menu still follows the function code; check as both `quantri` and `hocvien`.                                                                     |
| The demo SQL edits a published revision                              | Low    | Dev and test only, with a run-once guard, like the existing demos.                                                                                   |

## Open questions

None blocking. Both open questions in the spec take their defaults.
