# Spec: Fields & programs screen (`/admin/catalog`) — sidebar entry, mockup parity, drop "phân hệ"

Status: DRAFT v2, waiting for approval. No code is written until approved.

## Decisions (from review)

1. Drop "phân hệ" (business modules) from the screen, and remove the concept from the backend if
   the audit allows it (audit below).
2. Add a tree endpoint to the backend.
3. Delete for real when a node is empty; otherwise set it to `archived`.
4. Admin **and instructor** may use the screen (revised: instructors keep access, as today).
5. `ownerOrgId` = the signed-in user's org, no org picker.

## Capability map

The request bundles two independently testable capabilities, so it is split.

| Module id        | Responsibility                                                                              | Depends on                                                    |
| ---------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `catalog-tree`   | Sidebar entry, tree endpoint, state/copy/delete endpoints, tree + detail screen (BE + FE)   | —                                                             |
| `remove-modules` | Remove phân hệ end to end (DB, BE, contracts, mocks, course editor, learner catalog filter) | `catalog-tree` (the screen must already stop showing modules) |

Build order: `catalog-tree` → `remove-modules`. Files: this `SPEC.md` is the map and the spec of
`catalog-tree`; `remove-modules` gets `SPEC-remove-modules.md` once its open questions are answered.
The screen in `catalog-tree` simply never shows modules, so it ships without waiting for the removal.

## Audit: can "phân hệ" be removed from the backend?

Technically yes, but it is not isolated to the catalog screen. Findings
(backend repo `~/my-projects/corebanking-academy`, frontend repo this worktree):

- **Data:** table `learning_hub.business_modules` and column `course_revisions.module_id`
  (`docs/sql/learning_hub_learning.sql`, demo seed `…_demo.sql`, `scripts/local-seed-media.sh`).
  Dropping the column loses the module of every existing course; needs a migration decision.
- **Backend code, ~25 files:** entity `BusinessModule`, repository, `LearningCatalogService`
  (`saveModule`, `modules`), controller (`GET/POST/PUT /training-catalog/modules`), mapper, views,
  `AuditAction.MODULE_SAVED`, `LearningContentService.validateCatalog` (a draft or publish checks the
  module), `CourseRevision.moduleId`, course copy (`setModuleId`).
- **Learner-facing API, a breaking change:** `moduleId` is a filter on the learner catalog
  (`/learner/…` search), the instructor course search, the progress report export, and a facet list
  (`CourseRepositoryCustomImpl` facets, `LearningAnalyticsRepository`). `CourseCard` carries
  `moduleId`/`moduleName`.
- **Tests and docs:** `LearnerFacetsIT`, `CatalogCardIT`, `QuizLessonContentIT`, `AssessmentFixtures`,
  `docs/api/LEARNING.md`, `LEARNING_CURL.md`, Postman collection.
- **Frontend, 24 files:** contracts (`course.schema.ts`, `learner.schema.ts`, training-catalog
  schema and endpoints, captured fixtures), mocks (`learning.backend.ts`, fixtures), course editor
  ("Phân hệ" select in course info + `course-draft`), learner catalog (module filter and
  `catalog.store`), the training-catalog screen.
- **Mockup conflict:** the mockup keeps "Phân hệ" as a plain text attribute of a course: a filter in
  the learner catalog (`learner.js:67`) and a column "Phân hệ / mức độ" in the course list. It is
  not a managed entity there. Removing it fully makes those screens differ from the mockup.

Recommendation: do `catalog-tree` first (module disappears from this screen only). For
`remove-modules`, choose one (Open Question 1): (A) remove everything including the learner filter
and the course-editor field; (B) keep a free-text "phân hệ" on the course, as in the mockup, and drop
only the managed table, its endpoints and the field→module relation.

## `catalog-tree` — Objective

Admins manage **Lĩnh vực → Chương trình → Khóa học** in one screen, as the mockup `adminCatalog`
(`lms-mockup/src/pages/admin-content.js:22`). Today the route exists but has **no sidebar entry**
(the sidebar is built from the backend `/me` functions, one entry per function code, and
`admin/catalog` sits outside any function group, `screens.ts:570`), and the screen is two flat
tabs (fields, modules) with add/edit only.

Success: an admin opens "Lĩnh vực & chương trình" from the sidebar, sees the 3-level tree, picks a
node and can add, edit, copy, publish, pause, lock and delete or archive it, as in the mockup.

### Assumptions

1. New backend function `TRAINING_CATALOG` ("Lĩnh vực & chương trình", `/admin/catalog`), granted to
   the **admin and instructor roles** (`docs/sql/learning_hub_identity.sql`, next to
   `COURSE_MANAGEMENT` at sort 50; the same roles that hold it), and the screen moves into a
   `TRAINING_CATALOG` group in `screens.ts`, section "Nội dung". Route access changes from
   `COURSE_MANAGEMENT` to `TRAINING_CATALOG`; nobody who has the screen today loses it.
2. Course-level actions in the tree reuse existing endpoints (`/courses/{id}/copy`, `PATCH
/courses/{id}/state`); "Thêm khóa học" links to `/admin/courses/new?program=…`.
3. Business rules (delete blocking, publish preconditions, copy) stay on the server; the UI renders
   results and server errors.
4. Backend changes are verified against a local run; everything else uses the shared backend.

### Backend work (gap)

| Mockup action             | Backend today                                                                           | Needed                                                                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tree                      | `GET fields`, `GET programs` paged per `ownerOrgId`                                     | **New** `GET /training-catalog/tree?ownerOrgId=` returning fields → programs → courses (id, code, name, status), scoped by caller; no pagination, bounded                                                                   |
| Add / edit field, program | `POST/PUT` with `expectedVersion`                                                       | none                                                                                                                                                                                                                        |
| Publish / pause / lock    | `PUT` already takes `status` (`draft/published/paused/archived`) with `expectedVersion` | none: status changes are a PUT with the full item (the tree returns what it needs); "Khóa" = `archived`; courses use `PATCH /courses/{id}/state`                                                                            |
| Copy                      | Courses: yes. Programs: no                                                              | **New** `POST /programs/{id}/copy` (copies courses as drafts, sets `copiedFromProgramId`, code `-COPY`, name "(bản sao)", status draft)                                                                                     |
| Delete                    | none                                                                                    | **New** `DELETE` for field and program: removed only when it has no children, otherwise `409` with the mockup's message and the UI offers "Lưu trữ" (archive). Courses are never deleted here (the course screens own that) |

### Scope

In: sidebar function + route move; the endpoints above with tests; zod contracts + mock endpoints
for each; the screen as tree + detail panel (a11y tree, search, node form drawer with code, name,
description, confirm dialogs using the mockup's copy); the screens/menu specs.
Out: course editor, learner catalog, assignments, bulk import, removing modules (next module).

### Commands

```
nvm use
npm start                                         # :4200, proxy to the shared backend
npx nx test lms | contracts | mocks | ui          # one project
npm run format:check && npx nx run-many -t lint typecheck test build check-bundle --parallel=1
cd ~/my-projects/corebanking-academy && ./mvnw test   # confirm exact command in its AGENTS.md
```

### Project structure

```
libs/contracts/src/lib/training-catalog/    schemas + endpoints (tree, setState, copyProgram, delete)
libs/mocks/src/lib/                         handlers + fixtures for them
apps/lms/src/app/core/routing/screens.ts    admin/catalog → TRAINING_CATALOG group
apps/lms/src/app/core/menu/                 menu-catalog + spec
apps/lms/src/app/features/admin-content/training-catalog/
  training-catalog.{ts,html,scss,spec.ts}
  data-access/training-catalog.store.ts
  components/{catalog-tree,catalog-detail,catalog-item-form}
corebanking-academy/docs/sql/…              function code + admin grant
corebanking-academy/src/main/java/…/learning/   controller, service, ITs
```

### Code style

Per `docs/conventions/angular.md`: standalone, zoneless, signals, `$`-suffixed store selectors,
directive first, tokens-only SCSS through `ui`, Vietnamese UI copy from the mockup, English code.
Visual design per `docs/conventions/visual-design.md` (no eyebrow even though the mockup header
has one; status shown once, not as badge soup).

### Testing strategy

Vitest: store (tree build from the endpoint, selection, search, each command and its error path
incl. delete→409→archive), component specs (tree ARIA and keyboard, actions per node type/status,
confirm flow), menu-catalog spec (entry, section order, admin and instructor only), contracts and mocks specs.
Backend ITs: tree scoping, state change, copy program, delete empty vs non-empty, function grant,
learner 403. Browser check in preview: tree, each action, learner gets 403, mobile width.

### Boundaries

- Always: rules on the server; parse every response with its zod schema; tokens only; run the Done
  checklist (`npm run check`, angular.md §14, visual-design, migration verify step).
- Ask first: backend migration beyond the function row, new dependencies, role grants beyond admin and instructor.
- Never: commit `mockBackend: true`; start a local backend except to verify the backend changes;
  weaken or delete existing specs.

### Success criteria

1. Admin and instructor see "Lĩnh vực & chương trình" in the sidebar under "Nội dung"; a learner
   does not and gets the 403 page on the URL.
2. The tree (from the new endpoint) shows fields → programs → courses, expands and collapses,
   filters by search, and is keyboard navigable; selecting a node shows its detail and children.
3. Actions per node type as in the mockup: add field / program / course (link), edit, copy
   (program, course), publish ↔ pause, lock, delete (empty) or archive (non-empty).
4. Server rejections (duplicate code, delete blocked, version conflict) are shown, never silent.
5. `mockBackend: true` renders the same screen; `npm run check` is green; backend tests pass.

## Resolved questions

1. `remove-modules` = option B: drop the managed table, its endpoints and the field→module relation;
   keep a free-text "phân hệ" on the course as in the mockup; existing `module_id` values are
   converted to the module's name. Detail goes in `SPEC-remove-modules.md` later.
2. "Khóa" and "Lưu trữ" are one status, `archived`.
3. Instructors keep access to the screen (decision 4 revised accordingly).

## Open questions

None for `catalog-tree`.
