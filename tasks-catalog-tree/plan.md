# Implementation Plan: `catalog-tree` (fields & programs screen)

Spec: `SPEC.md` (approved). Module `catalog-tree`; `remove-modules` is planned later in its own spec.
Tasks are tracked in `tasks-catalog-tree/todo.md`.

## Overview

Add the "Lĩnh vực & chương trình" entry to the sidebar for admin and instructor, and rebuild
`/admin/catalog` as the mockup's tree (Lĩnh vực → Chương trình → Khóa học) with a detail panel.
Backend gets a tree endpoint, a copy-program endpoint, delete for empty fields and programs, and
the new `TRAINING_CATALOG` function. Backend repo: `~/my-projects/corebanking-academy`.

## Findings that shape the plan

- **No new state endpoint for fields and programs.** `saveField` / `saveProgram` already take
  `status` (`draft|published|paused|archived`) in the PUT body, guarded by `expectedVersion`.
  Publish, pause and "Khóa/Lưu trữ" (= `archived`) are therefore a PUT with the full item and the
  new status. The tree endpoint must return everything that PUT needs: `ownerOrgId`, `fieldId`,
  `code`, `name`, `description`, `status`, `sortNo`, `rowVersion`. This removes the "state
  endpoint" row of the spec's gap table.
- **Courses already have `PATCH /courses/{id}/state` (active/paused/archived) and
  `POST /courses/{id}/copy`.** Publishing a course goes through a revision publish in the course
  editor, not the tree: for a course node the tree offers edit (link), copy, pause/resume and
  archive, and no "Xuất bản".
- `saveProgram` refuses to move a program to another field and `saveField` refuses a duplicate code;
  the form already handles these server errors.
- The sidebar is `/me` functions only (`menu-catalog.ts`), so the function row in
  `docs/sql/learning_hub_identity.sql` is what makes the entry appear. A deployed database also
  needs the same insert as a one-off script.
- The existing screen uses modules; the new one does not. The contract and mock for modules stay
  (the course editor still uses them) until `remove-modules`.

## Dependency graph

```
BE function row ──────────────────────────────┐
BE tree ── contracts ── mocks ── store ── tree UI ── detail + actions ── cleanup/verify
BE copy-program ──┘                       └─ item form
BE delete ────────┘
screens.ts group + menu spec  (needs only the function code)
```

BE tasks 1-4 are independent of each other; contracts need the BE shapes (tasks 2-4); the sidebar
task needs only task 1. Vertical slices are used where possible: tree → copy → delete each go
BE + contract + mock + UI action as one path would be larger than ~5 files, so BE comes first and
the UI actions follow once the endpoints exist.

## Phases

1. **Backend** (T1-T4), then checkpoint.
2. **Contracts, mocks, sidebar** (T5-T7), then checkpoint.
3. **Screen** (T8-T11), then checkpoint.
4. **Cleanup and verification** (T12).

## Risks and mitigations

| Risk                                                                                                  | Impact | Mitigation                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Moving the route from `COURSE_MANAGEMENT` to a new function breaks users whose role lacks the new row | High   | T1 grants admin and instructor; T7 spec asserts both; deploy script documented in T1                                    |
| Tree endpoint returns many courses for a big org                                                      | Med    | Bound it (only id, code, name, status per course), org-scoped; add a size cap and test                                  |
| Delete races with a course being added                                                                | Low    | Server re-checks children inside the transaction; UI shows the 409 message                                              |
| PUT-for-status overwrites a concurrent edit                                                           | Med    | `expectedVersion` from the tree row; on conflict show the message and reload the tree                                   |
| Accessible tree widget is heavy                                                                       | Med    | Use the `@angular/aria` / CDK tree if present in `ui`; check `docs/conventions/ui-library.md` before building a new one |
| `mockBackend` drifts from the real backend                                                            | Med    | Mock handlers get the same specs as the contract shapes; verify once against the real backend in T12                    |

## Definition of done per task

Focused tests pass; backend `mvn test` for BE tasks; `npx nx test <project>` for FE; no `any`,
tokens only, Vietnamese copy from the mockup. The whole module ends with `npm run check`, the
angular.md §14 checklist, the visual-design checklist and the migration verify step (T12).

## Open questions

None.
