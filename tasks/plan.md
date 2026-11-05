# Implementation Plan: Final exam inside the course wizard

Spec: [SPEC-course-exam-wizard.md](../SPEC-course-exam-wizard.md) (approved 2026-11-05).
Tasks: [todo.md](todo.md).

## Overview

Move the common "one course, one final exam" path into the course wizard: the course is created
when leaving step 1, step 3 creates and edits the final exam with a short form over the program's
whole active bank, too-small banks are filled through the existing Excel import drawer, and
publishing the course publishes its draft exam first. The quiz screen stops asking for a program.

## Architecture Decisions

- **New `CourseExamStore`** (provided by the course-rules component) owns step 3's exam: the
  course's final quiz, the bank count, the pool sync and the exam mutations. `CourseEditorStore`
  keeps the draft, auto-create and the publish chain; it only reads the exam id/status it needs.
- **Pool sync is one function** (`syncPool(quizId)`): page `GET /questions?programId&courseId&status=ACTIVE`
  (size 100, max 5 pages = 500 ids) then `PUT /quizzes/{id}/questions`. Used by exam save and by the
  publish chain, never for a `FIXED` quiz.
- **Import drawer is decoupled from the quiz screen** through an injection token
  (`QUESTION_IMPORT_HOST`: `programId$`, optional `fixedCourseId$`, `finishImport()`, `closeImport()`),
  provided by `AssessmentScreenStore` and by `CourseExamStore`.
- **Publish chain stays in `CourseEditorStore.publishMutation`**: save draft → (exam is DRAFT and
  wizard-managed: sync pool → `publishQuiz`) → publish course. A finished exam publish is remembered
  so a retry skips it.
- **Auto-create reuses `create()` + `moveToEditor()`**: `continue()` in create mode on step 0
  creates instead of moving, and `moveToEditor` lands on step 1.
- **Endpoints:** reuse `assessmentV1Endpoints` (`createQuiz`, `updateQuiz`, `replacePool`,
  `publishQuiz`, `courseQuizList`, `quiz`) and `programAssessmentEndpoints.questions`. No new
  contracts beyond what exists, except mock parity.

## Dependency Graph

```
T1 mock parity ─────────────┐
T3 auto-create ─────────────┼─► T4 exam read side ─► T5 create exam ─► T6 edit / FIXED
T2 quiz screen D7 (indep.)  │                         │
                            └─► T7 import host token ─┴─► T8 bank-too-small in step 3
                                                          T5 ─► T9 publish chain ─► T10 program lock*
                                                                                   ─► T11 polish + verify
```
`*` T10 only if open question 4 is answered "lock".

## Task List

### Phase 1: Foundation
- [x] T1: Mock parity for final exams
- [x] T2: Quiz screen create form without the program select (D7)
- [x] T3: Create the course when leaving step 1 (D1)

### Checkpoint A
- [ ] `nx test lms mocks` green; F1 and F6 work on the mock in the browser; review with human

### Phase 2: Exam in step 3
- [x] T4: Step 3 reads the exam and the bank (three states, no form yet)
- [x] T5: Create the final exam from the short form
- [x] T6: Edit a wizard-managed exam; read-only summary for a FIXED one
- [x] T7: Decouple the import drawer behind `QUESTION_IMPORT_HOST`
- [x] T8: Bank too small: warning and import in step 3

### Checkpoint B
- [ ] F2–F4 work end to end on the mock; full run-many check green; review with human

### Phase 3: Publish and finish
- [x] T9: Publishing the course publishes its draft exam (D2)
- [ ] T10: Lock the program once an exam is attached (conditional on open question 4)
- [ ] T11: Visual-design pass, browser matrix, full check

### Checkpoint C (done)
- [ ] All spec success criteria 1–7 met on the mock
- [ ] Real-backend run of F1–F5 with `giangvien` once the backend prerequisite is deployed

## Parallelization

- T1, T2 and T3 touch disjoint files and can run in parallel.
- T7 can run in parallel with T4–T6 (it touches only `question-import/` and the quiz screen store).
- T9 waits for T5; T8 waits for T4 and T7.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Backend `feat/course-final-exam` not on the shared server | High: `finalQuizId` dropped on the real backend | Build and verify on the mock; real-backend sign-off is a separate checkpoint item |
| Publish chain not atomic | Med | Remember the finished exam publish; explicit message; retry skips it |
| Pool cap 500 | Low | Take the newest 500 ACTIVE and say so in step 3 |
| Auto-create hits a taken code | Low | Existing `takenCode` path: stay on step 1 with the field error |
| `CourseEditorStore` (1300+ lines) grows further | Med | Exam logic goes to `CourseExamStore`; editor store gets only the chain hook |
| Import drawer refactor breaks the quiz screen | Med | T7 keeps the quiz screen's import specs unchanged and green |

## Open Questions (from the spec)

1. Who merges/deploys backend `feat/course-final-exam`, and when? (blocks Checkpoint C's last item)
2. Backend confirms the `courseId` question path / Excel import as supported? (affects T8 copy only)
3. Is the 500-question pool cap acceptable?
4. Lock the program select once an exam is attached? (decides T10)
