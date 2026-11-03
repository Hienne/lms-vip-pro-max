# Spec: `course-final-exam`

Map: [SPEC-course-authoring.md](SPEC-course-authoring.md). Status: **approved 2026-11-03** (open questions answered in `tasks/plan.md` Decision 1).
Depends on `course-wizard-create` (built), which owns the four-step editor.

## Objective

An admin can make passing the course's final exam a completion rule, from step 3 "Bài thi & điều kiện" of the course
editor. That is the mockup's `courseWizard` step 3 (`lms-mockup/src/pages/admin-content.js`, lines 220–227). The
backend enforces it: a learner on a revision with a final exam completes the course only when every required lesson
is done **and** the exam is passed.

**Decisions taken (2026-11-03, the user):**

1. **Which quiz.** Only the course's `FINAL_EXAM` quiz can be picked. A course has at most one, and the learner's
   course page already shows it as "Bài thi cuối khóa". `PRACTICE` quizzes are not offered.
2. **Storage.** `learning_hub.course_assessments` is used as it is. `assessment_revision_id` holds the quiz id
   (quizzes have no revisions), and `docs/api/LEARNING.md` says so. **No DB change**, and no SQL on the shared DB.
3. **Scope in time.** The rule belongs to a revision. Learners enrolled on an earlier published revision keep its
   rule. Only enrollments on a revision published with the final exam need to pass it.

### Step 3 in the app

Two sections side by side from `lg`, stacked below. Card radius, no icon tiles.

- **"Bài kiểm tra cuối khóa"**
  - A select labelled "Bài kiểm tra dùng để xét hoàn thành". Its options are "Không yêu cầu bài kiểm tra" and the
    course's `FINAL_EXAM` quiz, by title, with its status when it is not published ("· Nháp" or "· Đã đóng").
  - The hint reads "Cấu hình thời gian, số câu, điểm đạt, số lần thi tại màn Bài kiểm tra."
  - When the course has no `FINAL_EXAM` quiz, the select shows only "Không yêu cầu bài kiểm tra" and an info line
    reads "Khóa học chưa có bài thi cuối khóa. Tạo bài kiểm tra loại Thi cuối khóa ở màn Bài kiểm tra."
  - In create mode, the select is replaced by "Lưu nháp trước để chọn bài kiểm tra", as for quiz lessons.
- **"Điều kiện hoàn thành"**
  - Read-only lines with a check or a dash: "Hoàn thành mọi bài học bắt buộc"; "Đạt bài kiểm tra cuối khóa", or
    "Đạt bài kiểm tra cuối khóa (chưa chọn)" when none is chosen.
  - Then the reward points as today.
- **Step 4 checklist** gains "Đã cấu hình bài kiểm tra cuối khóa (khuyến nghị)". It is optional and links to step 3. When a quiz is chosen but not published, a required line "Bài kiểm tra cuối khóa đã xuất bản" appears, also
  linking to step 3. The server still decides on publish.
- **Learner side:** no change. The course page already shows the `FINAL_EXAM` quiz.

## Backend (`corebanking-academy`, module `learning`, plus the `assessment` implementation of the directory)

**Draft and read**

- `DraftContent` and `DraftRequest` gain `Long finalQuizId` (nullable). An old client that omits it clears the final
  exam, like every other tree field, and `docs/api/LEARNING.md` says so.
- **On save**, when `finalQuizId` is set, it must:
  - exist and not be deleted;
  - belong to the course;
  - have `quiz_type` `FINAL_EXAM`.

  Otherwise the save fails with `LEARNING-QUIZ_INVALID`, field `finalQuizId`. The quiz may still be a draft at save
  time, as for quiz lessons.

- **`applyDraft`** deletes the revision's `course_assessments` rows and, when `finalQuizId` is set, writes one row:
  - `placement` `final`, `assessment_revision_id` = quiz id, `lesson_id` null, `is_required` true;
  - `pass_score_percent` = the quiz's `pass_percent` at save time, for display only (passing is judged by the quiz);
  - `max_attempts` and `allow_retake` from the quiz, `opens_at` and `closes_at` null, `sort_no` 0.
- **The course detail** (`CourseDetail.revision`, or a new `finalQuizId` field on the detail) returns `finalQuizId`.
  It is additive.
- **The revision copy** (opening a draft from a published revision) carries `finalQuizId`.
- **`LearningQuizDirectory.QuizRef`** gains `quizType`, `passPercent`, `maxAttempts` and `allowRetakeAfterPass`.
  `AssessmentQuizDirectory` fills them.

**Publish**

- The blanket refusal `QUIZ_UNAVAILABLE` for any assessment row is removed.
- With a final row, the quiz must be `PUBLISHED`, not deleted, of the course and `FINAL_EXAM`. Otherwise the publish
  fails with a new code `LEARNING-FINAL_EXAM_UNPUBLISHED` ("Bài kiểm tra cuối khóa chưa xuất bản hoặc không còn
  hợp lệ."), in the same family as `QUIZ_LESSON_UNLINKED`.
- `QUIZ_UNAVAILABLE` is kept in the enum (other callers or clients may know it) but is no longer thrown here.

**Completion** (`LearningProgressService`)

- `updateEnrollment` calls a revision complete when every required lesson is at 100% **and**, if the revision has a
  final row, the learner has passed that quiz (`quizzes.scores(userId, [courseId])`, `passed` for that quiz id,
  following the quiz's `scoreMethod`).
- `completeQuizLessons(userId, enrollmentId, quizId)` is called when a quiz is passed. When `quizId` is the
  enrollment revision's final exam, it recomputes the enrollment even if no quiz lesson points at that quiz (today it
  returns early when there is none).
- Completion stays monotonic. A later regrade that fails does not undo a completion, as today.
- The certificate, points and reports follow the completion as they do now. No change there.

**Docs:** `docs/api/LEARNING.md` (the field, the column use, the publish code, the completion rule) and
`LEARNING_CURL.md`. Javadoc and comments in Vietnamese.

## App

- **Contracts:** `SaveDraftCommandSchema` gains `finalQuizId` (optional). The course detail schema gains `finalQuizId`
  (nullable, default null). `LEARNING-FINAL_EXAM_UNPUBLISHED` joins the message-code kinds as `refused`. The fixtures
  are captured from the local backend.
- **Mock:** the tree save stores `finalQuizId` and the detail returns it. Publish refuses an unpublished final exam
  with the new code.
- **Editor:**
  - `CourseDraftValue.finalQuizId` (a select value, `''` for none), round-tripped by `toDraftValue`,
    `toSaveDraftCommand` and `toCreateCourseCommand` (always empty in create mode).
  - `course-rules` gets the two sections above. The quiz options come from the store's existing `courseQuizList`,
    filtered to `quizType` `FINAL_EXAM`.
  - `draftChecks` gains the two lines above.

## Testing

- **Backend:** integration tests for:
  - save with a final exam, then read back;
  - save refused for a `PRACTICE` quiz, another course's quiz, a deleted quiz;
  - an old client's save clears it;
  - the revision copy keeps it;
  - publish refused while the quiz is a draft, accepted once it is published;
  - completion: lessons done without the exam stays in progress; passing the exam then completes it; passing the
    exam first, then the lessons, completes on the last lesson;
  - a revision without a final exam completes as before;
  - an enrollment on an older revision is not affected by a newer revision's final exam.

  `mvn -o clean test` green.

- **App:** specs for the mapping round trip, the select options (only `FINAL_EXAM`, status suffix, the empty case,
  create mode), the completion lines, and the checklist lines. `npm run check` green.
- **Local stack (Checkpoints):**
  - Set the final exam on a local course that has a `FINAL_EXAM` quiz (from the assessment demo data) and publish
    it as `quantri`.
  - As a learner enrolled on that revision: finish the lessons and see the course still in progress, then pass the
    exam through the learner quiz flow and see it completed.
  - No direct DB edits to progress, attempts or enrollments.

## Boundaries

- **Always:** the rule is decided by the server; the app only displays it. Every response is parsed by its schema.
  Vietnamese copy from the mockup. One commit per task. The local stack only.
- **Ask first:** any schema change, including a column comment; a new dependency; changing an existing response in a
  way that is not additive.
- **Never:**
  - touch the shared server `103.121.90.119`;
  - edit enrollments, progress or attempts directly;
  - offer `PRACTICE` quizzes as the final exam;
  - push, merge or open a PR without the user's request.

## Success criteria

1. Step 3 lists only the course's `FINAL_EXAM` quiz and "Không yêu cầu bài kiểm tra", and the choice is saved and
   read back.
2. Publishing with an unpublished final exam is refused with `LEARNING-FINAL_EXAM_UNPUBLISHED`. With a published one,
   the publish succeeds (no more `QUIZ_UNAVAILABLE`).
3. A learner on that revision completes only after passing the exam and finishing the required lessons, in either
   order.
4. Learners on older revisions and courses without a final exam behave exactly as before (tests prove it).
5. No DB change. `mvn -o clean test` and `npm run check` green.

## Open questions

1. **Pass score shown in step 3.** Should the completion line show the quiz's pass score, as in "Đạt bài kiểm tra
   cuối khóa (≥ 70%)"? It would come from the stored snapshot. The default in this spec is no, since the quiz screen
   owns it and the snapshot can go stale.
2. **Learner course page.** Should the course page tell learners "Cần đạt bài thi cuối khóa để hoàn thành" when the
   revision has a final exam? The default is no change in this module; it can be a small follow-up.
