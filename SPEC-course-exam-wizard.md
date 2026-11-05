# Spec: Final exam inside the course wizard (direction B)

Status: draft, awaiting approval · 2026-11-05

## Objective

Today an instructor needs three screens and two round trips to ship a course with a final exam:
course wizard → (blocked: "save the draft first") → question bank → quiz screen (pick program and
course again, ~15 fields, save, publish separately) → back to the wizard → publish. Publishing the
course fails while the exam is still a draft.

Make the common case — **one course, one final exam** — finish inside the course wizard:

- **US1.** As an instructor creating a course, after step 1 the course is stored as a draft without
  me pressing "Lưu nháp", so step 3 can always attach an exam.
- **US2.** In step 3 "Bài thi & điều kiện" I create the final exam with a short form (title, time,
  question count, pass score, attempts) and see how many questions the bank has, without leaving.
- **US3.** If the bank has too few questions I import them from Excel in a drawer on step 3.
- **US4.** When I publish the course, its final exam is published too, after one confirmation.
- **US5.** On the quiz screen, creating a quiz asks only for the course; the program is shown, not
  chosen.

Users: instructors (`INSTRUCTOR`, often scope OWN/TEAM) and admins (`ADMIN`, `SUPER_ADMIN`).
The "Cấu hình nâng cao" link keeps the full quiz screen for everything else.

## Background facts (verified 2026-11-05)

- **Program** (`training_programs`): a group of courses inside a field (lĩnh vực), owned by one org.
  A course points at a program through its **draft revision** (`revision.programId`), chosen in step 1.
- **Question bank is per program** since backend `56a0db3` (origin/main, 2026-11-04). Writing it
  through `programId` needs ADMIN/INSTRUCTOR with GLOBAL/ORG scope over the program's owner org.
- **Course-sourced questions:** `POST /api/v1/questions` with `courseId` (no `programId`) and the
  Excel import (`POST /api/v1/questions/import?courseId`) only need "manages the course". They are
  stored with `courseId` **and** the course's current `programId`, so they appear in the program
  bank and stay editable by that course's managers.
- **A quiz needs only `courseId`.** The backend derives the program from the course's latest
  revision and rejects pool questions from another program. At most one `FINAL_EXAM` per course.
- **A quiz pool is explicit** even for `RANDOM_POOL`: `PUT /quizzes/{id}/questions` with up to 500
  items. Publishing a quiz needs ≥ `questionCount` ACTIVE questions in the pool.
- **Course final exam on the draft** (`finalQuizId`, `FINAL_EXAM_UNPUBLISHED` on publish) exists
  only on backend branch `feat/course-final-exam` (`1607d18`, `4ab9e1f`). **It is not on
  origin/main or the shared server** (`/v3/api-docs` has no `finalQuizId`). The app's contract
  and mock already have it.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Leaving step 1 in create mode ("Tiếp tục") creates the course, then continues on the edit URL at step 2. | Step 3 always has a `courseId`. Accepted cost: abandoned drafts. |
| D2 | Publishing the course publishes its draft final exam first, inside the same confirmation. | `FINAL_EXAM_UNPUBLISHED` otherwise. Not atomic: see Risks. |
| D3 | The wizard creates questions only as **course-sourced** questions (Excel import with `courseId`). No backend code change; ask backend to document this path as supported, not "legacy". | Instructors with OWN/TEAM scope can add to the bank of their own course's program, which is the case that blocks them today. |
| D4 | The short form uses the quiz screen's defaults: 15 min, 70 %, 3 attempts, `RANDOM_POOL`, shuffle questions and options, review after submit, no open/close dates, `ALL_OR_NOTHING`, `BEST`, 0 grace, retake wait 0. Question count defaults to `min(10, active bank size)`. | One set of defaults across both screens. |
| D5 | The wizard's exam uses the **whole active bank** as its pool, rewritten on every wizard save of the exam and right before the auto-publish. | Random selection over the shared bank is what "lấy ngẫu nhiên" means to users; questions imported later join automatically. |
| D6 | If the exam was customised on the quiz screen (`FIXED` selection), step 3 shows a read-only summary with "Cấu hình nâng cao" and never rewrites its pool. | Protect manual work. |
| D7 | The quiz screen's create form drops the program select; it shows "Câu hỏi lấy từ ngân hàng của chương trình X" once a course is picked. | The program is derived from the course. |

## Scope

In:
1. Auto-create on leaving step 1 (create mode only).
2. Step 3 rewrite: exam card with three states — none / wizard-managed / customised.
3. Short exam form (create and edit), bank count, pool sync, Excel import drawer reuse.
4. Course publish → exam publish chain, with errors explained.
5. Quiz screen: program select removed from create; program shown.
6. Copy, focus and empty states per `docs/conventions/visual-design.md`.

Out:
- Practice quizzes and quiz lessons inside the outline (unchanged).
- Creating a single question inline in the wizard (Excel only; the full bank screen stays).
- Backend endpoint that publishes course and exam in one transaction (follow-up if D2 misbehaves).
- Changing the data model (direction C).

## Flows

**F1 — create mode, step 1 → 2.** "Tiếp tục" validates step 1 as today, then calls `create()`.
On success: `moveToEditor(created)` with `step=1`, toast "Đã lưu nháp". On a taken code: stay on
step 1 with the existing field error. On another error: alert, stay. While pending: button busy.

**F2 — step 3, no exam.** Card "Bài thi cuối khóa" shows bank count ("Ngân hàng chương trình
*Nền tảng…* có 24 câu đang dùng") and the short form collapsed behind "Tạo bài thi cuối khóa".
"Không yêu cầu bài thi" remains the default (completion = lessons only).

**F3 — save exam.** Create: `createQuiz` (DRAFT, `FINAL_EXAM`, D4 values) → pool = all ACTIVE bank
questions (paged reads, max 500) → set `finalQuizId` on the draft → save draft. Edit: `updateQuiz`
→ pool rewrite (D5). Pool write failure after a create keeps the quiz (receipt pattern from the quiz
screen) and offers "Thử lại".

**F4 — bank too small.** If active bank < question count: inline warning with the numbers,
"Nhập từ Excel" (opens the existing `QuestionImport` drawer, course fixed to this course), and for
users with `QUESTION_BANK`, a link to the bank screen. After an import the count and pool refresh.

**F5 — publish.** Confirmation text adds "Bài thi cuối khóa *X* sẽ được xuất bản cùng khóa học."
Chain: save draft → (exam DRAFT? pool rewrite → `publishQuiz`) → `publish` course.
- Exam publish refused (`ASSESSMENT-QUIZ_NOT_READY` etc.): stop, course stays draft, step 3 shows why.
- Exam published, course refused: toast "Bài thi đã xuất bản, khóa học chưa xuất bản" + the
  course's reason; retry skips the exam step.

**F6 — quiz screen create.** Course select only; program line under it; deep links with
`programId` keep working as a course-list filter.

## Tech Stack

Angular 22 (standalone, zoneless, signals, Signal Forms) · Nx · zod contracts · `@lms/ui` ·
Vitest · in-app mock backend. Node 24. No new dependencies.

## Commands

```bash
nvm use
npm start                                   # app on :4200, shared backend
npx nx test lms                             # app specs
npx nx test contracts && npx nx test mocks
npx nx run-many -t lint typecheck test build check-bundle --parallel=1
npm run check                               # full gate (see AGENTS.md memory notes)
```

Browser checks use `mockBackend: true` in `apps/lms/src/environments/environment.ts`, never committed.

## Project Structure

```
apps/lms/src/app/features/admin-content/course-editor/
  data-access/course-editor.store.ts     → D1 auto-create, D2 publish chain
  data-access/course-exam.store.ts       → NEW: exam state, bank count, pool sync (step 3)
  components/course-rules/               → step 3 UI rewrite
  components/course-exam-form/           → NEW: short exam form
  course-draft.ts                        → checklist: drop "exam published" blocker (D2)
apps/lms/src/app/features/quiz/assessment-screen/
  question-import/                       → reused; accepts a fixed course
  assessment-screen.html / store         → D7
libs/contracts/src/lib/assessment/       → reuse v1 quiz/pool/publish endpoints; course-sourced question import
libs/mocks/src/lib/assessment/           → mock pool rules match backend (program check, ≥ questionCount)
```

## Code Style

Follow `docs/conventions/angular.md` (store shape: `state` → resources → `$` selectors → setters →
commands; `serverData` / `serverMutation`; components render selectors and call commands).

```ts
/** Step 3's exam: the course's final quiz, the program bank's size and the pool the wizard keeps. */
@Injectable()
export class CourseExamStore {
  private readonly state = { formOpen: signal(false) };

  private readonly bankCount = serverData(
    (query: { programId: number; courseId: number }) =>
      this.client.call(api.questions, { query: { ...query, status: 'ACTIVE', page: 0, size: 1 } }),
    { params: () => this.bankQuery(), reloadOn: this.bankChanges },
  );

  readonly activeBank$ = computed(() => this.bankCount.value()?.totalElements);
  readonly isWizardManaged$ = computed(() => this.exam$()?.selectionMode !== 'FIXED');
}
```

UI copy is Vietnamese and follows the visual-design checklist (no icon tiles, no status colour as
decoration, one coloured badge per row at most).

## Testing Strategy

- **Contracts/mocks (Vitest):** mock enforces one FINAL_EXAM per course, pool program check,
  publish needs ≥ `questionCount` ACTIVE.
- **Store specs:** `CourseExamStore` (count, pool paging ≤ 500, receipt on pool failure, FIXED
  untouched); `CourseEditorStore` (auto-create on continue, publish chain incl. both refusals).
- **Screen specs (`course-editor.spec.ts`):** F1–F5 end to end on the mock backend; quiz screen F6.
- **Browser:** one run on `mockBackend` per flow F1–F5, 1440 px and 375 px, light and dark.
- **Real backend:** after the backend prerequisite is deployed, one run of F1–F5 with the
  `giangvien` account (OWN/TEAM scope) on the shared server.

## Boundaries

- **Always:** parse every response with its endpoint schema; keep business rules on the server
  (pool validity, publish readiness are shown, not decided, by the app); run the full check before
  reporting done; keep Vietnamese copy, English code.
- **Ask first:** any backend code change; changing quiz-screen behaviour beyond D7; deleting or
  merging backend branches; changing defaults in D4.
- **Never:** commit `mockBackend: true`; write the program bank through `programId` on behalf of a
  user who lacks scope; rewrite the pool of a `FIXED` quiz; publish a quiz without the course
  publish confirmation.

## Success Criteria

1. Creating a course and pressing "Tiếp tục" on step 1 lands on `/admin/courses/:id/edit?step=1`
   with the draft stored; no "Lưu nháp trước" message exists anywhere in step 3.
2. From step 3 an instructor creates a final exam with ≤ 5 visible fields and the course draft
   references it after save.
3. With fewer bank questions than the exam's count, step 3 states both numbers and offers the
   Excel import; after importing enough, the warning disappears without reloading the page.
4. Publishing a course whose exam is a draft publishes both after one confirmation; each refusal
   (exam, course) leaves a clear message and a retry that does not redo finished steps.
5. A `FIXED` exam is never modified by the wizard.
6. The quiz screen's create form has no program select.
7. `npm run check` (or the run-many fallback) is green; visual-design checklist passes.

## Risks

| Risk | Mitigation |
|---|---|
| Backend prerequisite not deployed → `finalQuizId` silently dropped on the real server | Blocker for real-backend sign-off; build and test on the mock meanwhile. |
| D2 not atomic (exam published, course refused) | Explicit message and retry skipping the exam; escalate to a backend endpoint if seen often. |
| Pool > 500 active questions | Use the first 500 by id desc and say so; ask backend whether `RANDOM_POOL` can mean "whole bank". |
| Abandoned drafts from D1 | Accepted; drafts stay visible in "Quản lý khóa học" filtered by "Nháp". |
| Course-sourced path (D3) removed later by backend | Ask backend to document it as supported before shipping. |

## Open Questions

1. **Backend prerequisite:** who merges and deploys `feat/course-final-exam` (and
   `feat/course-publish-targets`, which it contains) to origin/main and the shared server, and when?
2. **D3 confirmation:** backend agrees the `courseId` question path and Excel import are a supported
   way for course managers to add to their program bank?
3. **Pool size:** is the 500-item pool cap acceptable, or should backend support "whole bank" random
   selection?
4. **Course program change after an exam exists:** block the program select in step 1 once an exam
   is attached (recommended), or warn only?
