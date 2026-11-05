# Todo: Final exam inside the course wizard

Spec: [SPEC-course-exam-wizard.md](../SPEC-course-exam-wizard.md) · Plan: [plan.md](plan.md)

Every task also clears the project Definition of Done (AGENTS.md "Done"): focused specs green,
angular.md §14 checklist, visual-design checklist for UI changes. Paths below are relative to
`apps/lms/src/app/features/` unless they start with `libs/`.

---

## Phase 1: Foundation

### T1: Mock parity for final exams
**Description:** The mock refuses a second `FINAL_EXAM` for a course, as the backend does, so the
wizard's create path is tested against the real rule.

**Acceptance criteria:**
- [x] `createQuiz`/`updateQuiz` with `FINAL_EXAM` on a course that already has one is refused with the backend's code and message.
- [x] Existing pool rules (program of the course, ≥ `questionCount` ACTIVE to publish) are covered by a spec.

**Verification:** `npx nx test mocks`

**Dependencies:** None · **Files:** `libs/mocks/src/lib/assessment/authoring.mock.ts`, its spec, `libs/mocks/src/lib/backend-responses.ts` (if a new refusal) · **Scope:** S

### T2: Quiz screen create form without the program select (D7)
**Description:** On `/admin/quizzes/new` the program is shown as text derived from the course;
the list screen keeps its program filter.

**Acceptance criteria:**
- [x] The create form has no program `<select>`; under the course select it reads "Câu hỏi lấy từ ngân hàng của chương trình *X*".
- [x] A deep link with `programId` still narrows the course list; `courseProgramMismatch` still blocks a course from another program.
- [x] Existing quiz-screen specs stay green.

**Verification:** `npx nx test lms -- assessment-screen.spec`; browser check of `/admin/quizzes/new`

**Dependencies:** None · **Files:** `quiz/assessment-screen/assessment-screen.html`, `.../data-access/assessment-screen.store.ts`, `assessment-screen.spec.ts` · **Scope:** S

### T3: Create the course when leaving step 1 (D1)
**Description:** In create mode, "Tiếp tục" on step 1 validates, creates the course with the whole
draft and continues on `/admin/courses/:id/edit?step=1`.

**Acceptance criteria:**
- [x] Valid step 1 + "Tiếp tục" → one `createCourse` call, URL becomes the edit URL with `step=1`, toast "Đã lưu nháp", no leave prompt.
- [x] Taken code → stays on step 1 with the code field error; other refusal → alert, stays; button busy while pending.
- [x] Step 3 no longer contains "Lưu nháp trước để chọn bài kiểm tra".

**Verification:** `npx nx test lms -- course-editor.spec`

**Dependencies:** None · **Files:** `admin-content/course-editor/data-access/course-editor.store.ts`, `course-editor.ts`, `components/course-rules/course-rules.html`, `course-editor.spec.ts` · **Scope:** M

## Checkpoint A
- [x] `npx nx test lms` and `npx nx test mocks` green (lms: only the 4 `target-picker.spec` failures, which also fail on baseline `d7699b4`: `Receiver must be an instance of class URL`)
- [x] F1 (create → step 2) and F6 (quiz create) work on `mockBackend` in the browser
- [ ] Review with human before Phase 2

---

## Phase 2: Exam in step 3

### T4: Step 3 reads the exam and the bank
**Description:** New `CourseExamStore` loads the course's `FINAL_EXAM` (list + detail) and the
active bank count for the course's program; step 3 renders the three states without a form.

**Acceptance criteria:**
- [x] No exam: card shows the bank sentence ("Ngân hàng chương trình *X* có N câu đang dùng") and a "Tạo bài thi cuối khóa" button.
- [x] Wizard-managed exam (`RANDOM_POOL`): title, time, count, pass %, attempts, status; "Sửa" and "Cấu hình nâng cao".
- [x] `FIXED` exam: same summary, only "Cấu hình nâng cao".
- [x] Load errors show an inline alert with retry; the "Không yêu cầu bài thi" choice still works.

**Verification:** `npx nx test lms -- course-exam.store.spec course-editor.spec`

**Dependencies:** T3 · **Files:** `course-editor/data-access/course-exam.store.ts` (+spec), `components/course-rules/course-rules.{ts,html,scss}` · **Scope:** M

### T5: Create the final exam from the short form
**Description:** Short form (title, minutes, question count, pass %, attempts) with D4 defaults;
save = `createQuiz` → `syncPool` → set `finalQuizId` on the draft → save the draft.

**Acceptance criteria:**
- [x] Defaults: 15 / `min(10, bank)` / 70 / 3; other fields per D4; validation messages in Vietnamese.
- [x] After save the draft references the new quiz and the card shows the wizard-managed state.
- [x] Pool write fails after create → quiz kept, card offers "Thử lại" which retries only the pool.
- [x] Pool takes at most 500 ids (newest first) and the card says so when capped.

**Verification:** `npx nx test lms -- course-exam.store.spec course-editor.spec`

**Dependencies:** T4, T1 · **Files:** `components/course-exam-form/*` (new), `course-exam.store.ts`, `course-rules.html`, specs · **Scope:** M

### T6: Edit a wizard-managed exam; FIXED stays read-only
**Description:** "Sửa" opens the short form filled from the quiz; save = `updateQuiz` (with
`expectedVersion`) → `syncPool`.

**Acceptance criteria:**
- [x] Edited values persist; a version conflict shows the server message and reloads the quiz.
- [x] A `FIXED` quiz never gets `updateQuiz`/`replacePool` from the wizard (spec asserts no call).
- [x] "Cấu hình nâng cao" links to `/admin/quizzes/:id?courseId=…`.

**Verification:** `npx nx test lms -- course-exam.store.spec`

**Dependencies:** T5 · **Files:** `course-exam.store.ts`, `course-exam-form/*`, specs · **Scope:** S

### T7: Decouple the import drawer behind `QUESTION_IMPORT_HOST`
**Description:** `QuestionImportStore` stops injecting `AssessmentScreenStore` and uses a host token;
an optional fixed course hides the course select.

**Acceptance criteria:**
- [x] Quiz screen provides the host; its four import specs pass unchanged.
- [x] With `fixedCourseId$` set, the drawer shows the course name as text and imports into it.

**Verification:** `npx nx test lms -- assessment-screen.spec`

**Dependencies:** None (parallel with T4–T6) · **Files:** moved to `shared/quiz/question-import/` (so the course editor can use it without importing a feature's internals), with new `data-access/question-import.host.ts`; `quiz/assessment-screen/assessment-screen.ts` provides the host · **Scope:** M

### T8: Bank too small: warning and import in step 3
**Description:** When active bank < question count, step 3 states both numbers and offers the
import drawer (course fixed) and, for `QUESTION_BANK` users, a bank link.

**Acceptance criteria:**
- [x] Warning shows "Ngân hàng có N câu đang dùng, bài thi cần M câu."; disappears after an import that fills the gap, without reload.
- [x] After import the count reloads and a wizard-managed exam's pool is re-synced.
- [x] Users without `QUESTION_BANK` see no bank link.

**Verification:** `npx nx test lms -- course-editor.spec`

**Dependencies:** T4, T7 · **Files:** `course-exam.store.ts`, `course-rules.html`, `course-editor.spec.ts` · **Scope:** S

## Checkpoint B
- [x] F2–F4 work end to end on `mockBackend` (create, edit, too-small-bank warning checked in the browser; the Excel drawer itself is covered by specs)
- [ ] `npx nx run-many -t lint typecheck test build check-bundle --parallel=1` green (only the 4 `target-picker` specs fail, same on the base commit; build and check-bundle pass)
- [ ] Review with human before Phase 3

---

## Phase 3: Publish and finish

### T9: Publishing the course publishes its draft exam (D2)
**Description:** The confirmation names the exam; the chain is save draft → (DRAFT and
wizard-managed: `syncPool` → `publishQuiz`) → publish course; the checklist no longer blocks on an
unpublished exam that the chain will publish.

**Acceptance criteria:**
- [x] One confirmation publishes both; success toast as today.
- [x] Exam refused (e.g. `ASSESSMENT-QUIZ_NOT_READY`) → course not published, step 3 shows the reason.
- [x] Exam published, course refused → toast "Bài thi đã xuất bản, khóa học chưa xuất bản" + reason; retry does not call `publishQuiz` again.
- [x] A `CLOSED` or `FIXED`-and-draft exam still blocks on the checklist with a link to the quiz screen.

**Verification:** `npx nx test lms -- course-editor.spec course-draft.spec`

**Dependencies:** T5 · **Files:** `course-editor/data-access/course-editor.store.ts`, `course-draft.ts`, `components/course-review/*` (confirmation text), specs · **Scope:** M

### T10: Lock the program once an exam is attached *(only if open question 4 = lock)*

> **Skipped (not built):** open question 4 is undecided, so this task stays unchecked. Until it is decided, changing the program in step 1 after an exam exists is not blocked.
**Acceptance criteria:**
- [ ] With `finalQuizId` set, step 1's program select is disabled with the hint "Gỡ bài thi cuối khóa để đổi chương trình."

**Verification:** `npx nx test lms -- course-editor.spec`

**Dependencies:** T5 · **Files:** `components/course-info/course-info.{ts,html}`, spec · **Scope:** XS

### T11: Visual-design pass, browser matrix, full check
**Acceptance criteria:**
- [ ] visual-design.md checklist passes for step 3, the short form and the drawer.
- [ ] F1–F5 checked on `mockBackend` at 1440 px and 375 px, light and dark (F1–F4 and F6 seen; F5's publish click not run in the browser because the test course has no lessons, covered by specs)
- [ ] Full check green; `mockBackend` reverted.

**Verification:** run-many check (background, output to file); browser screenshots

**Dependencies:** T1–T10 · **Files:** styles only if fixes are needed · **Scope:** S

## Checkpoint C (done)
- [ ] Spec success criteria 1–7 met on the mock
- [ ] Real-backend run of F1–F5 with `giangvien` after backend `feat/course-final-exam` is deployed
