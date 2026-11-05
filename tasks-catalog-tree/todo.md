# Tasks: `catalog-tree`

Backend = `~/my-projects/corebanking-academy` (B). Frontend = this repo (F).
Run `nvm use` before any F command.

## Phase 1: Backend

- [x] **T1 (B): `TRAINING_CATALOG` function, admin and instructor**
  - Acceptance: function row ("Lĩnh vực & chương trình", `/admin/catalog`, section/sort next to `COURSE_MANAGEMENT`) in `docs/sql/learning_hub_identity.sql`, granted to the admin and instructor roles; a one-off SQL for existing databases next to it; `/me` returns it for both roles and not for a learner.
  - Verify: IT on `/me` for admin, instructor, learner; `mvn test` for that class.
  - Files: `docs/sql/learning_hub_identity.sql`, a migration/one-off script, one IT. Scope: S.
- [x] **T2 (B): `GET /api/v1/training-catalog/tree?ownerOrgId=`**
  - Acceptance: fields → programs → courses, each field/program with `id, ownerOrgId, fieldId, code, name, description, status, sortNo, rowVersion`; each course with `id, code, title, status`; cut to the caller's scope (`access.requireManage`); ordered by `sortNo`, `id`; fields without programs and programs without courses are present with empty children.
  - Verify: IT: scoping (other org 403), empty children, ordering, a learner is refused; `mvn test`.
  - Files: `LearningCatalogController`, `LearningCatalogService`, `LearningViews`, repository, IT. Scope: M.
- [x] **T3 (B): `POST /training-catalog/programs/{id}/copy`**
  - Acceptance: new program in the same field, status `draft`, code `<code>-COPY` (unique-suffixed on a clash), name `<name> (bản sao)`, `copiedFromProgramId` set; every course of the source copied as a draft into it (reuse the course copy logic), no learners, assignments or shares; audit entry; returns the new program view.
  - Verify: IT: copy with 2 courses, code clash, other-org refusal; `mvn test`.
  - Files: controller, `LearningCatalogService`, `LearningContentService` (reuse), `AuditAction` if needed, IT. Scope: M.
- [x] **T4 (B): `DELETE` for fields and programs (empty only)**
  - Acceptance: `DELETE /training-catalog/fields/{id}` and `/programs/{id}` remove the row only when it has no children (a field with no programs; a program with no course revisions); otherwise `409` with a Vietnamese message that says to archive instead; audit entry; scope-checked.
  - Verify: IT: delete empty, blocked with children (409), other-org refusal, gone from the tree; `mvn test`.
  - Files: controller, service, repository, `LearningResponseCode` if needed, IT. Scope: M.

### Checkpoint: Backend
- [x] `mvn test` green; the four endpoints work against a local run (curl or the ITs)
- [ ] Review with the human before the frontend phase

## Phase 2: Contracts, mocks, sidebar

- [ ] **T5 (F): contracts for tree, copy-program, delete**
  - Acceptance: zod schemas and `defineEndpoint`s `trainingCatalogEndpoints.tree / copyProgram / deleteField / deleteProgram` matching T2-T4; `TrainingCatalogTree` types exported from `index.ts`.
  - Verify: `npx nx test contracts`; typecheck.
  - Files: `training-catalog.schema.ts`, `training-catalog.endpoints.ts`, its spec, `index.ts`. Scope: S.
  - Depends on: T2-T4.
- [ ] **T6 (F): in-app mock for tree, copy, delete and the PUT status change**
  - Acceptance: handlers answer the new endpoints with the same rules as the backend (scoped, copy as draft, delete 409 when not empty); the tree reflects creates, edits and status changes; fixtures include a field with programs and courses, and an empty field.
  - Verify: `npx nx test mocks`.
  - Files: handler + fixtures under `libs/mocks/src/lib/learning/` (or a new `catalog` folder), spec. Scope: M.
  - Depends on: T5.
- [ ] **T7 (F): sidebar entry**
  - Acceptance: `admin/catalog` moves into a `TRAINING_CATALOG` group (`nav: { icon: 'layers' or similar, section: 'Nội dung' }`, `search: {}`), access `TRAINING_CATALOG`; the mock `/me` for admin and instructor contains the function and a learner's does not; menu order places it above "Quản lý khóa học".
  - Verify: `npx nx test lms` for `menu-catalog.spec`, `app.spec`, `app-shell.spec`, `login.spec` (they reference the route).
  - Files: `screens.ts`, `menu-catalog.spec.ts`, shell/app specs, the mock `/me` fixture. Scope: M.
  - Depends on: T1.

### Checkpoint: Contracts, mocks, sidebar
- [ ] `npx nx run-many -t lint typecheck test --projects=contracts,mocks,lms`
- [ ] With `mockBackend: true` (not committed) the entry shows for admin/instructor and opens the old screen

## Phase 3: Screen

- [ ] **T8 (F): store: tree, selection, search, commands**
  - Acceptance: state from the tree endpoint; selected node id, expanded ids, search text; computed visible tree filtered by search (keeps ancestors of a match); commands `select`, `toggle`, `search`, `save` (create or update through the existing endpoints), `setStatus` (PUT with the full item and new status), `copy`, `remove`, `reload`; server errors exposed as signals; no module code.
  - Verify: `npx nx test lms` for the store spec: build, filter, each command success and error (409, version conflict, duplicate code).
  - Files: `training-catalog.store.ts`, its spec. Scope: S-M.
  - Depends on: T5, T6.
- [ ] **T9 (F): page shell and tree component**
  - Acceptance: two-column layout (tree card + detail card), tree with expand/collapse, status shown once per node, search field "Tìm trong cây…", keyboard navigation and roles per the `ui` tree pattern, header with "Thêm lĩnh vực"; loading, error and empty states; tabs and module UI removed.
  - Verify: component spec (ARIA roles, arrow keys, filter); preview with the mock at desktop and 375px.
  - Files: `training-catalog.{ts,html,scss}`, `components/catalog-tree/*`, spec. Scope: M.
  - Depends on: T8.
- [ ] **T10 (F): detail panel and actions**
  - Acceptance: for the selected node: title, code, status, description, child list; actions per type as in the mockup (field: add program, edit, publish/pause, archive, delete; program: add course (link to `/admin/courses/new?program=<id>`), edit, copy, publish/pause, archive, delete; course: edit (link), copy, pause/resume, archive); confirm dialogs use the mockup's titles and messages; delete is offered when the node has no children, "Lưu trữ" when it has; toasts on success; server messages on failure.
  - Verify: component spec for each node type/status; preview click-through with the mock.
  - Files: `components/catalog-detail/*`, store wiring, spec. Scope: M.
  - Depends on: T9.
- [ ] **T11 (F): item form for field and program**
  - Acceptance: drawer form (Mã, Tên, Mô tả for programs and fields) drops the module kind and the field-select for modules; a new program is created under the selected field; code and name limits from `CATALOG_LIMITS`; duplicate-code error shown on the code field.
  - Verify: form spec; preview add/edit for both kinds.
  - Files: `components/catalog-item-form/*`, spec. Scope: S.
  - Depends on: T8.

### Checkpoint: Screen
- [ ] `npx nx run-many -t lint typecheck test --projects=lms`
- [ ] Full flow works on the mock: add field, add program, copy, pause, archive, delete empty
- [ ] Review with the human

## Phase 4: Cleanup and verification

- [ ] **T12 (F+B): cleanup and end-to-end verification**
  - Acceptance: dead code from the tabs/modules UI removed from this screen (not the shared module contract); `docs/migration` mapping/board updated if it tracks screens; against a local backend (T1-T4 build) the sidebar entry, tree, copy, status change, delete and 409 work for admin and instructor, and a learner gets the 403 page; `npm run check` green (follow the memory notes in `AGENTS.md`); angular.md §14 and visual-design checklists pass; report of what was verified.
  - Verify: `npm run format:check` then `npx nx run-many -t lint typecheck test build check-bundle --parallel=1`; browser walk-through with screenshots.
  - Files: assorted. Scope: S.
  - Depends on: T1-T11.

### Checkpoint: Complete
- [ ] All spec success criteria met
- [ ] Nothing committed with `mockBackend: true`
- [ ] Ready for review; `remove-modules` spec is next
