# Tasks: `course-wizard-create`

Spec: [SPEC-course-wizard-create.md](../SPEC-course-wizard-create.md) · Plan: [plan.md](plan.md).
The previous `lesson-player-modes` checklist is in git history at `0efffaf`.

- **Repositories:**
  - backend: `corebanking-academy`, branch `feat/course-wizard-create` from `origin/main` (`59aa687`), in its own
    worktree `~/my-projects/corebanking-academy-wizard`;
  - app: this one, branch `feat/course-authoring` (spec and map at `a247bfe`).

  Nothing is pushed.

- **Local stack:**
  - The backend on :8019 is the main session's background task. Never run `mvn` in the worktree it runs from, and
    never start another backend. Message the main session for a restart.
  - The app runs on :4200 against `localhost:8019`.
  - Account: `quantri`, the admin who creates and saves courses.
  - Passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, and are never printed.
  - In the browser, sign in with the one-shot token method, never by typing the password.
  - Courses created while testing use codes starting with `WIZ-`.
- **Never** touch the shared server `103.121.90.119`. No seeding users, and no direct DB edits. No SQL in this module.
- Backend Javadoc and comments in Vietnamese (`DEVELOPMENT_GUIDELINES.md`). Run long commands in the foreground.

## Phase 1: Backend

- [x] **B1: Refactor the draft write**
  - `LearningRequests.DraftContent`: every `DraftRequest` field but `expectedVersion`, same constraints;
    `DraftRequest.content()`.
  - `LearningContentService.applyDraft(Course, CourseRevision, DraftContent, actor)`:
    - the catalog, size, cover, lesson and block checks;
    - `clearDraftTree`, the revision fields, the reward points, `writeTree`.
  - `saveDraft` keeps its lock and version check, then calls `applyDraft`.
  - Acceptance: no behaviour change; `mvn -o clean test` green.
  - Checked: commit f110b53 on `feat/course-wizard-create`; `mvn -o clean test` 453 run, 0 failed, 42 skipped.
- [x] **B2: Create with a draft**
  - `CreateCourse` gains `@Valid DraftContent draft` (nullable). `create` calls `applyDraft` after `newRevision`
    when it is present; the title rule is plan Decision 3.
  - Integration tests:
    - a create with a draft reads back its tree, objectives, reward points and version;
    - a create without one is unchanged;
    - a `DUPLICATE` code;
    - an invalid block leaves no course;
    - a caller without manage rights is refused.
  - `docs/api/LEARNING.md` and `LEARNING_CURL.md` document `draft`.
  - Acceptance: `mvn -o clean test` green.
  - Checked: commit b8529eb; 6 new tests in `CourseCreateWithDraftIT`; `mvn -o clean test` 459 run, 0 failed, 42 skipped.
    The title fallback needed `DraftContent.withTitle`, because `applyDraft` writes `draft.title` (null) over it.

### Checkpoint A

- [x] The main session reviewed both diffs and restarted :8019 from `~/my-projects/corebanking-academy-wizard`
      (`b8529eb`) on 2026-11-03.
- [x] `curl` as `quantri` (org 1):
  - `WIZ-CB-01` with a two-chapter draft: course 10, revision 12, title "Khóa thử wizard" (the draft title over
    `title`), objectives and 40 reward points; `GET /courses/10` reads back "Chương 1" → "Bài 1" and
    "Chương 2" → "Bài 2".
  - `WIZ-CB-02` without a draft: course 11, title "Không nháp", no chapters.
  - `WIZ-CB-01` again: `LEARNING-DUPLICATE`.
  - An unknown `programId` in the draft fails in the service with `LEARNING-NOT_FOUND`, and the code `WIZ-CB-04` was
    free afterwards (a later create took it). A bad `blockType` fails earlier, at bean validation, with the field
    `draft.chapters[0]…`.
  - `WIZ-CB-06` with a program, module, level and a required text block: created at `rowVersion` 1, then published
    with that version (`state` published). The response version is usable for a publish right after a create.
  - Note for the app: publishing needs a `level`; `draftChecks` does not list it today.
  - The test courses (`WIZ-CB-*`, ids 10 to 16) stay on the local DB.
- [x] `mvn -o clean test` in a temporary worktree at `b8529eb` (not the one :8019 runs from): exit 0;
      `CourseCreateWithDraftIT` 6 tests. The app child starts Phase 2.

## Phase 2: App

- [x] **F1: Contracts and mock**
  - `CreateCourseCommandSchema.draft` is `SaveDraftCommandSchema.omit({ expectedVersion: true })`, optional.
  - A fixture for a create with a draft, captured from the local backend.
  - The mock create handler stores the tree as its `saveDraft` does.
  - Acceptance: `npx nx test contracts` and `npx nx test mocks` green.
  - Checked: `capturedCourseCreate` (`WIZ-APP-01`, course 17, two chapters, revision `rowVersion` 1) parses with the
    create and detail schemas; `contracts` 251 tests, `mocks` 302 tests (4 new in `course-create.backend.spec.ts`).
    `LEARNING-DUPLICATE` is added to `MESSAGE_CODE_KIND` (`refused`) and to the mock's refusals, because the backend
    answers a taken code with it and F4 branches on it. The mock's `saveDraft` and create share `writeDraft`.
- [ ] **F2: Draft mapping**
  - `emptyDraftValue()` and `toCreateCourseCommand(value, code, ownerOrgId)` in `course-draft.ts`, sharing the tree
    mapping with `toSaveDraftCommand`.
  - Acceptance: `course-draft.spec.ts` covers both.
- [ ] **F3: Four steps**
  - `EDITOR_STEPS` with the spec's labels.
  - `course-finish` is split into `course-rules` (step 3) and `course-review` (step 4).
  - `draftChecks` step indexes are updated.
  - Footer: Hủy/Quay lại · Lưu nháp · Tiếp tục/Xuất bản khóa học, with one primary button.
  - Acceptance: editor specs for the steps, the footer and the checks' links.
- [ ] **F4: Create mode**
  - Route data `{ mode: 'create' }` on `admin/courses/new`, pointing at `CourseEditor`.
  - Store create mode: no `getCourse`, `courseQuizList` or kept-uploads read; the code field; save → `createCourse`
    → navigate with `replaceUrl` and `?step=`; publish → create, then `publish`.
  - `DUPLICATE` goes to the code field and step 1.
  - The quiz picker shows "Lưu nháp trước để chọn bài kiểm tra".
  - The leave guard asks with input and not after the save.
  - Acceptance: store and component specs for each point; no request before the save.
- [ ] **F5: Remove course-new and docs**
  - Delete `features/admin-content/course-new/`.
  - The migration entry for `courseWizard`.
  - The spec's implementation notes.
  - Acceptance: `npm run check` green.

### Checkpoint B

- [ ] Main-session review of each commit's diff against angular.md §14 and visual-design.md.
- [ ] `npm run check` green.
- [ ] Browser on the local stack, token sign-in as `quantri`:
  - create `WIZ-01` with two chapters and a lesson in one "Lưu nháp";
  - the URL is `/admin/courses/{id}/edit`, and Back does not return to `/new`;
  - a reload shows the tree;
  - a duplicate code shows the field error;
  - leaving with input asks first.
- [ ] 375, 768 and 1280 px, light and dark, keyboard only, beside the mockup on :4320.
- [ ] The spec is marked built.
