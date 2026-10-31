# Spec: `learner-quiz`

Map: [SPEC.md](SPEC.md). Status: **built 2026-10-31** (approved 2026-10-31, amended by the plan, see "Amendments"; success criteria checked in [tasks/todo.md](tasks/todo.md) under T11). Depends on `local-stack`.

Read first: `docs/conventions/contracts-and-mocks.md`; `corebanking-academy/docs/api/ASSESSMENT.md`
("Danh sách API", "Quy tắc chính", "Chưa làm / cần chốt").

## Objective

The learner takes a real quiz end to end on the local backend. Four parts:

1. **Quiz screens on the real API.** Intro, take, result and attempts call `/api/v1/me/quizzes…` and
   `/api/v1/me/quiz-attempts…`. Today they call mock-only paths (`/api/quizzes/{quizId}/intro`,
   `/api/attempts/…`) in `libs/contracts/src/lib/assessment/assessment.endpoints.ts`.
2. **Quizzes of a course.** The course page shows the course's quizzes, with the final exam as its own card, and
   each card shows the caller's status (attempts used / left, best score, passed, why it cannot start). This
   follows the mockup `learner.js` course page and `quiz.js` intro.
3. **Quiz lesson.** A lesson of type `quiz` points to one quiz of the same course. Opening it in the player shows
   the quiz card and "Làm bài" (mockup lesson `quizId`). Passing that quiz completes the lesson, so the course's
   existing rule "all required lessons at 100%" covers quizzes with no new completion rule.
4. **Quiz picker in the course editor.** An author picks the quiz for a quiz lesson. Without this, nothing can
   set `quizId`.

`learner-competency`, `learner-scores`, `catalog-discovery` ("Chưa đạt") and `certificates` all read the data
this module makes real.

## Backend (`corebanking-academy`)

### Endpoints

| #   | Endpoint                                                  | Change                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | `GET /api/v1/me/courses/{courseId}/quizzes`               | **new**: `List<LearnerQuizCard>`. Published, not deleted quizzes of the course, FINAL_EXAM last. Same access rule as `GET /me/quizzes/{id}` (the caller has a valid enrollment or the course is visible to them).                                                                                                                                                            |
| Q2  | course content write (`LearningContentService` save tree) | **changed**: accepts `lessonType = quiz` with `quizId` and no blocks. The quiz must belong to the same course and not be deleted, else `LEARNING-QUIZ_INVALID`. Content lessons keep today's rules.                                                                                                                                                                          |
| Q3  | course content read (`CourseLessonView`)                  | **changed**: adds `quizId` (null for content lessons)                                                                                                                                                                                                                                                                                                                        |
| Q4  | quiz submit (`POST /me/quiz-attempts/{id}/submit`)        | **changed**: when the graded attempt makes `everPassed` true, Learning sets the caller's `lesson_progress` to 100 for each quiz lesson that references this quiz in the caller's current enrollment, then recomputes the enrollment as for any block progress. This goes through a new method on the Learning public adapter; Assessment does not use Learning repositories. |

```java
public record LearnerQuizCard(LearnerQuiz quiz, AttemptSummary summary, Boolean canStart, String blockReason,
                              Instant availableAt, Long lessonId) {
}
```

`lessonId` is the quiz lesson that references the quiz, or null. `LearnerQuiz`, `AttemptSummary` and
`blockReason` are the existing types from `QuizIntro`.

`requireLessonsCompleted` counts only content lessons. Otherwise a required quiz lesson for a quiz that requires
all lessons could never open.

The publish check `LearningContentService:450` (`course_assessments` not empty → `QUIZ_UNAVAILABLE`) stays as it
is. `course_assessments` remains unused.

### DB upgrade `docs/sql/upgrade/2026-11-xx-learner-quiz.sql`

```sql
BEGIN;
ALTER TABLE learning_hub.course_lessons ADD COLUMN IF NOT EXISTS quiz_id bigint;
COMMENT ON COLUMN learning_hub.course_lessons.quiz_id IS
    'Bài kiểm tra của bài học loại quiz (quizzes.quiz_id, cùng course); NULL với bài nội dung.';
CREATE INDEX IF NOT EXISTS idx_course_lessons_quiz ON learning_hub.course_lessons (quiz_id) WHERE quiz_id IS NOT NULL;
COMMIT;
```

The rollback drops the index and the column. Before it runs, the rollback first checks that no lesson of type
`quiz` exists, and stops otherwise. The baseline `learning_hub_learning.sql` gets the same column, so a new DB
needs no upgrade. `learning_hub_assessment_demo.sql` (from `local-stack`) adds one quiz lesson per demo course
that has a quiz.

### Docs

`docs/api/ASSESSMENT.md`:

- Q1 under "Danh sách API".
- The quiz lesson rule under "Quy tắc chính".
- In "Chưa làm", the sentence about QUIZ lessons is replaced by what remains: `course_assessments` and a
  completion rule that is not tied to a lesson.

`docs/api/LEARNING.md` gets the `quizId` field. Both `docs/sql/README.md` and the upgrade script carry the
`psql` line.

## Amendments

Written in T1 from [tasks/plan.md](tasks/plan.md). Where they differ from the sections above, they win.

1. **Draft and publish rules.** A draft may hold a quiz lesson with no `quizId`. Publishing requires every quiz
   lesson to point to a PUBLISHED, not deleted quiz of the same course; otherwise `LEARNING-QUIZ_LESSON_UNLINKED`.
   Creating a draft from the published version keeps `quizId`. Copying the course to a new course clears it.
   `LEARNING-QUIZ_INVALID` is for a `quizId` of another course or a deleted quiz, on save.
2. **Quiz lookup from Learning.** Learning checks a quiz through a new port, `LearningQuizDirectory`, declared in
   `learning` and implemented in `assessment`, so `learning` imports no Assessment classes.
3. **Completion hook (replaces Q4's place).** The hook that completes the quiz lesson sits in `AttemptGrader`, so
   submit, expiry, submit on behalf and regrade are all covered. It runs when the attempt is `passed = true`.
   It is one-way: a regrade that turns a pass into a fail does not lower `lesson_progress` (progress only grows).
4. **Lessons-completed check.** `requiredLessonsCompleted` counts only `content` lessons.
5. **Demo quiz lessons.** A dev-only `learning_hub_learner_quiz_demo.sql` adds a required quiz lesson to the
   published revision of `FE-DEMO-C1` and `FE-DEMO-C2` (publishing a new revision would not work: `hocvien` is
   enrolled on the current one). It replaces the line in "DB upgrade" about the assessment demo.

## App

### Contracts

- **New files:** `libs/contracts/src/lib/assessment/learner-quiz.schema.ts` and `learner-quiz.endpoints.ts`
  (`learnerQuizEndpoints`).
- **Endpoint keys:**

  | Key              | Endpoint                                       |
  | ---------------- | ---------------------------------------------- |
  | `courseQuizzes`  | Q1                                             |
  | `quizIntro`      | `GET /me/quizzes/{quizId}`                     |
  | `startAttempt`   | `POST /me/quizzes/{quizId}/attempts`           |
  | `quizHistory`    | `GET /me/quizzes/{quizId}/attempts`            |
  | `myAttempts`     | `GET /me/quiz-attempts` (paged)                |
  | `exportAttempts` | `GET /me/quiz-attempts/export` (blob)          |
  | `attemptSession` | `GET /me/quiz-attempts/{attemptId}`            |
  | `saveAnswer`     | `PATCH /me/quiz-attempts/{id}/questions/{qid}` |
  | `submitAttempt`  | `POST /me/quiz-attempts/{id}/submit`           |
  | `attemptResult`  | `GET /me/quiz-attempts/{id}/result`            |

- **Schemas:** each one copies its backend record field by field: `QuizIntro`, `AttemptSummary`,
  `AttemptSession`, `AnswerReceipt`, `AttemptResult`, `AttemptHistory`, `MyAttemptRow`, `LearnerQuizCard`.
- **Learning contracts:** `CourseLessonSchema` in the learning contracts gains `quizId: z.number().int().nullable()`.
- **Untouched:** the admin keys in `assessment.endpoints.ts` (questions, quizzes, options) stay as they are,
  since the admin screens are out of scope. Only the learner keys move. A key with no caller left is deleted
  together with its mock handler.

### Screens

| Where                                  | Change                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/quiz/assessment-screen`      | The store switches to `learnerQuizEndpoints`. Routes stay `quiz/:id`, `quiz/:id/take`, `quiz/:id/result/:attemptId` and `quiz/:id/attempts`, where `:id` is the numeric quiz id. Copy follows `blockReason`: one Vietnamese sentence per code (`NOT_OPEN`, `CLOSED`, …), from the mockup where it has one. |
| `features/quiz` hub (`quiz`)           | Lists `myAttempts` grouped by quiz, plus the quizzes of the caller's in-progress courses from `courseQuizzes`                                                                                                                                                                                              |
| `features/learning/course`             | A "Bài kiểm tra" section: the final-exam card (title, pass mark, attempts left, best score, the CTA or the block reason) and the other quizzes as rows                                                                                                                                                     |
| `features/lesson/lesson`               | A quiz lesson renders the quiz card in place of blocks, with "Làm bài" → `quiz/:quizId`. Its outline icon is the quiz icon.                                                                                                                                                                                |
| `features/admin-content/course-editor` | A lesson-type control (Nội dung / Bài kiểm tra). For a quiz lesson, a select of the course's quizzes from the admin quiz list (`GET /api/v1/quizzes?courseId=`), which gets a real endpoint key for this one call.                                                                                         |

### Mock

`libs/mocks/src/lib/assessment` serves the new paths from its seed, keeping `mockBackend: true` working. The old
learner paths are removed.

## Testing

- **Backend:**
  - `LearnerQuizServiceTest`: Q1 returns only published quizzes; another learner's course is refused; FINAL_EXAM
    comes last.
  - `LearningContentServiceTest`: saving a quiz lesson succeeds, and saving one with a quiz from another course
    is refused.
  - A test in which submitting a passing attempt sets the quiz lesson's progress to 100 and completes the
    enrollment when it was the last required lesson.
- **App:**
  - Contract specs parse a real response captured from the local backend.
  - Store specs cover start → answer → submit → result, plus each `blockReason`.
  - The course page spec shows the final-exam card.
  - The lesson spec renders a quiz lesson.
- **Local, as `hocvien`:**
  - Open a demo course, see its quizzes, take one, fail and pass.
  - The quiz lesson turns complete.
  - Course progress reaches 100% when it is the last required lesson.

## Boundaries

- **Always:** the app shows `canStart` and `blockReason` from the server; it does not compute attempts left or
  open/close windows.
- **Ask first:** any rule that makes a course complete without every required lesson, such as a final exam
  outside a lesson.
- **Never:** grade or score on the client; change admin quiz authoring screens beyond the picker.

## Success criteria

1. Every learner quiz call in the network panel goes to `/api/v1/me/…` on `localhost:8019`. No `served: 'mock'`
   is left on a learner quiz key.
2. On the local stack, `hocvien` can take a demo quiz from the course page end to end (intro, take with saved
   answers across a reload, submit, result, attempts).
3. A quiz lesson saved in the course editor shows its quiz in the player. Passing the quiz marks the lesson
   complete and updates course progress, on screen and in `lesson_progress`.
4. Saving a quiz lesson with another course's quiz shows the server's `LEARNING-QUIZ_INVALID` message.
5. `mvn clean test` and `npm run check` green. Both the upgrade script and its rollback apply cleanly on the local
   DB.

## Open questions

1. **Admin screens:** should the admin question and quiz screens also move to the real `/api/v1/questions` and
   `/api/v1/quizzes` in this initiative? Default: no, only the picker.
2. **Quiz lessons with Q4:** there is one more completion path to check. A course whose only required lessons
   are quiz lessons completes when every quiz is passed. Is that the intended rule? Default: yes.
