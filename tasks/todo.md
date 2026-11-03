# Tasks: `course-final-exam`

Spec: [SPEC-course-final-exam.md](../SPEC-course-final-exam.md) · Plan: [plan.md](plan.md).
The previous `course-wizard-create` checklist is in git history at `e838065`.

- **Repositories:**
  - backend: `corebanking-academy`, branch `feat/course-final-exam` from `feat/course-wizard-create` (`b8529eb`),
    in its own worktree `~/my-projects/corebanking-academy-final-exam`;
  - app: this one, branch `feat/course-authoring`.

  Nothing is pushed.

- **Local stack:**
  - The backend on :8019 is the main session's background task. Never run `mvn` in the worktree it runs from, and
    never start another backend. Message the main session for a restart.
  - The app runs on :4200 against `localhost:8019`.
  - Accounts: `quantri` (admin, authoring); `hocvien.tichhop` (learner for the checkpoint).
  - Passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, and are never printed.
  - In the browser, sign in with the one-shot token method, never by typing the password.
  - Local `FINAL_EXAM` quizzes: 2 (course 1), 4 (course 2), 5 (course 8).
- **Never** touch the shared server `103.121.90.119`. No SQL, no DB edits; checkpoint data goes through the API.
- Backend Javadoc and comments in Vietnamese (`DEVELOPMENT_GUIDELINES.md`). Run long commands in the foreground.

## Phase 1: Backend

- [x] **B1: Store and read the final exam**
  - `QuizRef` gains `quizType`, `passPercent`, `maxAttempts` and `allowRetakeAfterPass`; `AssessmentQuizDirectory`
    fills them.
  - `DraftContent` / `DraftRequest` gain `finalQuizId`. On save, a quiz that is missing, deleted, of another
    course or not `FINAL_EXAM` gives `QUIZ_INVALID` (field `finalQuizId`).
  - `applyDraft` replaces the revision's `course_assessments` rows with at most one final row (spec, Backend).
  - `CourseDetail.finalQuizId`; the revision copy carries it.
  - Acceptance: `mvn -o clean test` green.
  - Checked: commit `1607d18` in `corebanking-academy-final-exam`; `mvn -o clean test` 459 run, 0 failed, 42 skipped (`CommunityApiIT`, as before).
- [x] **B2: Publish and completion**
  - `FINAL_EXAM_UNPUBLISHED`; the publish check replaces the `QUIZ_UNAVAILABLE` refusal.
  - `finalExamPassed(enrollment)` in `updateEnrollment`; `completeQuizLessons` recomputes the enrollment when the
    quiz is the final exam, even without quiz lessons, and never throws.
  - Acceptance: `mvn -o clean test` green.
  - Checked: commit `4ab9e1f`; `mvn -o clean test` 459 run, 0 failed, 42 skipped.
- [x] **B3: Tests and docs**
  - Integration tests from the spec's Testing section (save, refusals, clear, copy, publish, completion in both
    orders, no final exam, older revision unaffected).
  - `docs/api/LEARNING.md` and `LEARNING_CURL.md`.
  - Acceptance: `mvn -o clean test` green.
  - Checked: commit `61ff927`; new `CourseFinalExamIT` (11 cases); `mvn -o clean test` 470 run, 0 failed, 42 skipped.

### Checkpoint A

- [x] The main session reviewed the three diffs and restarted :8019 from `~/my-projects/corebanking-academy-final-exam`
      (`61ff927`) on 2026-11-03.
- [x] Plan Decision 9 through the API, no SQL:
  - As `quantri`: `WIZ-FE-01` (course 19, revision 21) created with one required text block; question 19; quiz 6
    (`FINAL_EXAM`, FIXED, 1 question, pass 50%).
  - Save refusals: quiz 1 (`PRACTICE`, course 1) and quiz 2 (`FINAL_EXAM`, course 1) both gave `LEARNING-QUIZ_INVALID`
    on the field `finalQuizId`. A `PRACTICE` quiz of the same course was left to `CourseFinalExamIT`.
  - Quiz 6 saved while still a draft; `GET /courses/19` returns `finalQuizId` 6. Publishing the course then gave
    `LEARNING-FINAL_EXAM_UNPUBLISHED`; after publishing quiz 6, the course published with `finalQuizId` 6.
  - As `hocvien.tichhop`: self-enrolled (enrollment 18 on revision 21), completed block 46: `in_progress` at 100%.
    Then attempt 10 on quiz 6, answered and submitted: `passed` true at 100%, and the enrollment became `completed`
    in the same grading call.
  - The enrollments of courses 1, 2 and 8 (ids 1–6 and 17) read the same before and after.
- [x] `mvn -o clean test` in a temporary worktree at `61ff927`: 470 run, 0 failures, 0 errors, 42 skipped;
      `CourseFinalExamIT` 11/11. The app child starts Phase 2.

## Phase 2: App

- [ ] **F1: Contracts and mock**
  - `SaveDraftCommandSchema.finalQuizId` (optional), the detail's `finalQuizId` (nullable, default null),
    `LEARNING-FINAL_EXAM_UNPUBLISHED` as `refused`.
  - Fixtures captured from the local backend.
  - The mock save and detail keep `finalQuizId`; the mock publish refuses an unpublished final exam.
  - Acceptance: `npx nx test contracts` and `npx nx test mocks` green.
- [ ] **F2: Step 3 and the checklist**
  - `CourseDraftValue.finalQuizId` round-tripped (empty in create mode).
  - `course-rules`: "Bài kiểm tra cuối khóa" (the select with only `FINAL_EXAM` quizzes, status suffix, hint, empty
    case, create-mode line) and "Điều kiện hoàn thành" (read-only lines, then reward points). Two columns from `lg`.
  - `draftChecks`: the optional and the conditional required line, both linking to step 3.
  - Acceptance: specs for each point.
- [ ] **F3: Docs**
  - The spec's implementation notes; the migration entry.
  - Acceptance: `npm run check` green.

### Checkpoint B

- [ ] Main-session review of each commit's diff against angular.md §14 and visual-design.md.
- [ ] `npm run check` green.
- [ ] Browser on the local stack as `quantri`: `WIZ-FE-01`'s step 3 lists only its `FINAL_EXAM` quiz; save, reload,
      the choice is kept; the empty case on a course without one; the create-mode line.
- [ ] 375, 768 and 1280 px, light and dark, keyboard.
- [ ] The spec is marked built.
