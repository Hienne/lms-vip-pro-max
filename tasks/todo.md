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

- [ ] **B1: Request and shares**
  - `PublishRequest` and `PublishAssignment` (plan Decision 2); the publish endpoint takes `PublishRequest`.
  - One transaction: publish, then shares (Decision 3, 5). Active shares skipped; a refusal becomes
    `CORE-VALIDATION_FAILED` on `shareOrgIds[j]` (Decision 4).
  - Acceptance: `{expectedVersion}` alone unchanged; `mvn -o clean test` green.
- [ ] **B2: Assignments**
  - Each row through `assign` with the values of Decision 6; a `BusinessException` or `AccessDeniedException` becomes
    `CORE-VALIDATION_FAILED` on `assignments[i]` and rolls everything back.
  - Acceptance: `mvn -o clean test` green.
- [ ] **B3: Tests and docs**
  - `CoursePublishTargetsIT` with the spec's Testing cases (two rows and a share; no extras; empty target rolls back;
    owner share refused; existing share unchanged; due before start; retry refused by version).
  - `docs/api/LEARNING.md` and `LEARNING_CURL.md`.
  - Acceptance: `mvn -o clean test` green.

### Checkpoint A

- [ ] The main session reviews the three diffs and restarts :8019 from
      `~/my-projects/corebanking-academy-publish-targets`.
- [ ] Plan Decision 11 through the API, no SQL.
- [ ] `mvn -o clean test` in a temporary worktree.

## Phase 2: App

- [ ] **F1: Contracts and mock**
  - `PublishCourseCommandSchema` (reusing the assignment `TargetInput` schema); the publish endpoint body.
  - Fixtures captured from the local backend.
  - The mock publish applies rows and shares through its assignment and share logic and refuses an empty target on
    `assignments[i]`.
  - Acceptance: `npx nx test contracts` and `npx nx test mocks` green.
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
