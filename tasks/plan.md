# Implementation Plan: `course-wizard-create`

Spec: [SPEC-course-wizard-create.md](../SPEC-course-wizard-create.md) (approved; amended below). Map:
[SPEC-course-authoring.md](../SPEC-course-authoring.md). Tasks: [todo.md](todo.md).

This plan replaces the one for `lesson-player-modes`. That plan is done; its PRs are hmhug19/corebanking-academy#23
and Hienne/lms-vip-pro-max#58, and it is in git history at `0efffaf`.

## Overview

`/admin/courses/new` becomes the course editor in create mode, with the mockup's four steps, and the first
"Lưu nháp" creates the course and its whole draft in one `POST /courses`. The backend accepts an optional `draft` in
that call. No schema change.

## What was checked while planning (2026-11-03)

**Backend (`corebanking-academy`, `origin/main` at `59aa687`)**

- **`LearningContentService.create`** is `@Transactional`:
  1. `requireManage` and the owner team check;
  2. `courseCodeExists`, which gives `DUPLICATE`, under `writeLock`;
  3. save the `Course`, then `newRevision(course, title, actor, 1)`;
  4. audit `COURSE_CREATED`, `flush`, then `detail`.
- **`saveDraft`**:
  - checks the version and `validateCatalog(course, programId, moduleId, false)`, then `validateDraftSize`;
  - checks the cover asset, then `validateLessonInput` / `validateBlockInput` for each lesson and block;
  - then `clearDraftTree`, sets the revision fields, sets the completion rule's `rewardPoints` (line ~152), and
    calls `writeTree(revision, DraftRequest, actor)`.
- **`DraftRequest`** is a flat record whose first field is `expectedVersion` (`@NotNull`). `writeTree` and
  `validateDraftSize` take the whole `DraftRequest`.
- **Course endpoint tests** live in `src/test/java/vn/com/coreacademy/assessment/` (`LearnerCourseIT`,
  `QuizLessonContentIT`, `support/AssessmentFixtures`) and `learning/LearningPointsIT`.

**App (`feat/course-authoring` at `a247bfe`)**

- **`course-new/`** has its own component, its store (`CourseNewStore.create` → `courseEndpoints.createCourse`,
  then navigate with `replaceUrl`) and specs.
- **The editor store** loads with `courseEndpoints.getCourse` by the route's `courseId`. It loads quizzes with
  `courseQuizList` by `courseId`, and kept uploads with `KeptUploads.read(userId, courseId)`.
  - `save` and `publish` take `Omit<SaveDraftCommand, 'expectedVersion'>`.
  - `EDITOR_STEPS` has three steps.
- **`course-draft.ts`**:
  - `toDraftValue(detail)` maps a loaded course to the form value;
  - `toSaveDraftCommand(value, version)` maps it back;
  - `draftChecks` holds the pre-publish checks, and their `step` indexes point at the three steps.
- **Uploads** take `ownerOrgId` (`learning-asset` contracts), not a course.
- **`unsavedChangesGuard`** is on every route.

## Decisions (amendments to the spec)

1. **Open questions answered** (by approval, 2026-11-03): before the first save, a quiz lesson cannot pick a quiz
   and an interrupted upload cannot be resumed; step 4 shows only the checklist and the summary; the course-new screen
   is deleted.
2. **Backend shape.**
   - A new record `LearningRequests.DraftContent` has every `DraftRequest` field except `expectedVersion`, with the
     same constraints.
   - `DraftRequest` keeps its JSON shape (no breaking change) and gains `DraftContent content()`.
   - `CreateCourse` gains `@Valid DraftContent draft`, which may be null.
   - The checks and the tree write of `saveDraft` move into one private `applyDraft(Course, CourseRevision,
DraftContent, actor)`. Both `saveDraft` and `create` call it, so no rule is duplicated.
   - `validateDraftSize` and `writeTree` take `DraftContent`.
3. **Title.** When `draft` is present, the revision title is `draft.title`. When `draft.title` is null, it falls back
   to `CreateCourse.title`.
4. **Response.** The same `CourseDetail`. Its `revision.version` is the value after the tree write, so a publish
   right after a create uses it.
5. **App create mode** is chosen by the route: `admin/courses/new` loads `CourseEditor` with the route data
   `{ mode: 'create' }`. The store reads that mode and has no `getCourse` call in it.
   - The form starts from `emptyDraftValue()`.
   - `code` is a field of the create form only, and `ownerOrgId` comes from the session.
6. **App save in create mode:**
   - It calls `createCourse` with `toCreateCourseCommand(value, code, ownerOrgId)`.
   - On success it marks the form clean, then navigates to `['/admin/courses', id, 'edit']` with `replaceUrl` and
     the query param `step` set to the current step. The edit screen reads `step` once.
   - Publish in create mode is: create, then `publish` with the returned revision and its version.
7. **`DUPLICATE`.** The store maps the server's `DUPLICATE` error to the code field ("Mã khóa học đã tồn tại.") and
   goes to step 1. Other errors use the existing alert.
8. **Steps.** `EDITOR_STEPS` becomes four steps, with labels and subtitles from the spec. `course-finish` is split
   into `course-rules` (step 3: completion rules and reward points) and `course-review` (step 4: checklist and
   summary). `draftChecks`' `step` indexes are updated to match.
9. **Quiz picker before the first save** shows "Lưu nháp trước để chọn bài kiểm tra" and makes no call.

## Phases

### Phase 1: Backend (child session, new worktree `~/my-projects/corebanking-academy-wizard`, branch `feat/course-wizard-create` from `origin/main` `59aa687`) → Checkpoint A

- **B1. Refactor.** Add `DraftContent` and `applyDraft`, and route `saveDraft` through them. No change in behaviour;
  the existing tests stay green.
- **B2. Create with a draft.** `CreateCourse.draft`, and `create` calls `applyDraft` after `newRevision`.
  Integration tests and `docs/api/LEARNING.md`.
- **Checkpoint A (main session):**
  - stop `bext44911`, then start :8019 from the new worktree;
  - `curl` as `quantri`:
    - a create with a two-chapter draft, read back with `GET /courses/{id}`;
    - a create without a draft;
    - a duplicate code;
    - a draft with an invalid block, after which no course exists (`courseCodeExists` by listing);
  - `mvn -o clean test` green.

### Phase 2: App (child session, this checkout, branch `feat/course-authoring`) → Checkpoint B

- **F1. Contracts and mock.** `CreateCourseCommandSchema.draft`; the fixture captured from the local backend; the
  mock create handler stores the tree.
- **F2. Draft mapping.** `emptyDraftValue()` and `toCreateCourseCommand` in `course-draft.ts`, sharing the tree
  mapping with `toSaveDraftCommand`.
- **F3. Four steps.** `EDITOR_STEPS`, `course-rules`, `course-review`, `draftChecks` indexes, and the footer buttons
  (Hủy/Quay lại · Lưu nháp · Tiếp tục/Xuất bản khóa học).
- **F4. Create mode.** Route data, the store's create mode, the code field, save and publish, `DUPLICATE`, the
  `step` query param, and the quiz picker note.
- **F5. Remove course-new and write the docs.**
  - Delete `features/admin-content/course-new/`.
  - Point the route at the editor.
  - Add the migration entry for `courseWizard` and the spec's implementation notes.
- **Checkpoint B (main session):**
  - review each diff, then run `npm run check`;
  - in the browser as `quantri`: create a course with two chapters and a lesson in one save, check the URL and the
    history, reload and see the tree;
  - try a duplicate code and leaving with unsaved input;
  - 375, 768 and 1280 px, light and dark, keyboard only, beside the mockup on :4320.

## Before merging (the user)

- No SQL. Merge the backend PR first and wait for its deploy, then the app PR. The app's create call sends `draft`,
  which an old backend would reject or ignore.

## Risks

- **An old backend ignores `draft`.** Spring ignores unknown fields by default, so with the app merged first,
  creates would lose their content silently. Hence the merge order. F4's spec asserts that the response tree is
  non-empty when the draft had chapters; it is a test, not a runtime guard.
- **The editor store is 822 lines.** Create mode adds branches to it. F4 keeps them to the load, save and publish
  paths; if it grows past about 100 lines, split a `course-create` helper.
- **Splitting `course-finish`** may move specs; F3 keeps the existing assertions under the new components.
