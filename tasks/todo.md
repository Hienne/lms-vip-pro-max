# Tasks: `course-publish-targets`

Spec: [SPEC-course-publish-targets.md](../SPEC-course-publish-targets.md) · Plan: [plan.md](plan.md).
The previous `course-final-exam` checklist is in git history at `2c91339`.

- **Repositories:**
  - backend: `corebanking-academy`, branch `feat/course-publish-targets` from `feat/course-final-exam` (`61ff927`),
    in its own worktree `~/my-projects/corebanking-academy-publish-targets`;
  - app: this one, branch `feat/course-authoring`.

  Nothing is pushed.

- **Local stack:**
  - The backend on :8019 is the main session's background task. Never run `mvn` in the worktree it runs from, and
    never start another backend. Message the main session for a restart.
  - The app runs on :4200 against `localhost:8019`.
  - Accounts: `quantri` (admin, authoring); `hocvien` (learner for the checkpoint row).
  - Passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, and are never printed.
  - In the browser, sign in with the one-shot token method, never by typing the password.
  - Course 19 (`WIZ-FE-01`) has an open draft revision; published revision 21.
- **Never** touch the shared server `103.121.90.119`. No SQL, no DB edits; checkpoint data goes through the API.
- Backend Javadoc and comments in Vietnamese (`DEVELOPMENT_GUIDELINES.md`). Run long commands in the foreground.

## Phase 1: Backend

- [x] **B1: Request and shares**
  - `PublishRequest` and `PublishAssignment` (plan Decision 2); the publish endpoint takes `PublishRequest`.
  - One transaction: publish, then shares (Decision 3, 5). Active shares skipped; a refusal becomes
    `CORE-VALIDATION_FAILED` on `shareOrgIds[j]` (Decision 4).
  - Acceptance: `{expectedVersion}` alone unchanged; `mvn -o clean test` green.
  - Checked: d197119 — mvn -o clean test: 470 run, 0 failed, 42 skipped.
- [x] **B2: Assignments**
  - Each row through `assign` with the values of Decision 6; a `BusinessException` or `AccessDeniedException` becomes
    `CORE-VALIDATION_FAILED` on `assignments[i]` and rolls everything back.
  - Acceptance: `mvn -o clean test` green.
  - Checked: 1e4d10e — mvn -o clean test (run with the B3 IT present): 477 run, 0 failed, 42 skipped. Lock: `pg_advisory_xact_lock` is re-entrant in one session, so nested `acquire` is safe.
- [x] **B3: Tests and docs**
  - `CoursePublishTargetsIT` with the spec's Testing cases (two rows and a share; no extras; empty target rolls back;
    owner share refused; existing share unchanged; due before start; retry refused by version).
  - `docs/api/LEARNING.md` and `LEARNING_CURL.md`.
  - Acceptance: `mvn -o clean test` green.
  - Checked: 0b4b9f8 — mvn -o clean test: 477 run, 0 failed, 42 skipped (CoursePublishTargetsIT: 7 run, 0 failed).

### Checkpoint A

- [x] The main session reviewed the three diffs and restarted :8019 from
      `~/my-projects/corebanking-academy-publish-targets` (`0b4b9f8`) on 2026-11-03. `LearningPublishService` runs the
      publish, the shares and the rows in one transaction; the nested `LearningWriteLock.acquire` is a
      `pg_advisory_xact_lock`, which the same transaction can take again.
- [x] Plan Decision 11 through the API, on course 19's draft revision 22 (`rowVersion` 3), as `quantri`:
  - Only one local org exists (org 1, the owner), so a successful share could not be made without seeding; it is
    left to `CoursePublishTargetsIT`.
  - Refused, each leaving revision 22 a draft with no assignment and no share:
    - a valid row for `hocvien` plus `shareOrgIds` [1] gave `CORE-VALIDATION_FAILED` on `shareOrgIds[0]`
      (`LEARNING-INVALID_REFERENCE`);
    - rows for `hocvien` and team 2 (no member) gave `assignments[1]` (`LEARNING-EMPTY_TARGET`), so row 0 was rolled
      back too;
    - a due date before the start gave `assignments[0]` (`OUT_OF_RANGE`).
  - A publish with one row for `hocvien` (start 2026-11-04, due 2026-12-04, reminder 3 days) succeeded (published
    revision 22) in under 0.1 s. Assignment 8 has revision 22, requirement `optional` (the revision default),
    `continue`, idempotency key `publish-22-0`; its recipient is `000004` on the new enrollment 20 (revision 22).
    The learning report shows enrollment 20 with `assigned` false until the start date, as for any future
    assignment.
  - The same body again gave `LEARNING-CONFLICT` (version check); still one assignment.
  - Counts read through the API and one read-only psql query on localhost; no write outside the API.
- [x] `mvn -o clean test` in a temporary worktree at `0b4b9f8`: 477 run, 0 failures, 0 errors, 42 skipped;
      `CoursePublishTargetsIT` 7/7. The app child starts Phase 2.

## Phase 2: App

- [x] **F1: Contracts and mock**
  - `PublishCourseCommandSchema` (reusing the assignment `TargetInput` schema); the publish endpoint body.
  - Fixtures captured from the local backend.
  - The mock publish applies rows and shares through its assignment and share logic and refuses an empty target on
    `assignments[i]`.
  - Acceptance: `npx nx test contracts` and `npx nx test mocks` green.
  - Checked: contracts, mocks and lms (envelope, error mapping and the full suite) tests, lint and typecheck green. Also
    added to the envelope: `errors[]` is now read (`FieldError`, `ApiError.fieldErrors`, `AppError.fieldErrors`),
    because the row mapping needs it; the mock refuses with the same shape.
- [ ] **F2: Shared picker**
  - `shared/assignment-target/`: `TargetPicker` and `TargetOptionsStore` (Decision 7); `assign-form` uses them.
  - Acceptance: the assignments specs pass; `lms` lint (module boundaries) and typecheck clean.
- [ ] **F3: Step 4**
  - Store state, loads and commands (Decision 9); "Giao khóa học" (picker, rows, reminder switch, "Đã giao trước
    đó", empty line) and "Chia sẻ cho đơn vị khác" (owner and shared units locked); the confirmation counts; the row
    error mapping; create mode.
  - Acceptance: specs for rows (add, delete, form checks), the switch, the share list, the publish command in edit
    and create mode, and a row error mapped back.
- [ ] **F4: Docs**
  - The spec's implementation notes; the migration entry.
  - Acceptance: `npm run check` green.

### Checkpoint B

- [ ] Main-session review of the four diffs against angular.md §14 and visual-design.md.
- [ ] `npm run check` green.
- [ ] Browser on the local stack, token sign-in as `quantri`: publish with a row and a share; the learner sees the
      course; a refused row is marked; "Giao học & hạn" still assigns.
- [ ] 375 px dark, 768 px light, 1280 px light; keyboard.
- [ ] The spec is marked built.
