# Implementation plan: org tree and import from file

Spec: [SPEC.md](../SPEC.md) (approved 2026-10-27). Tasks: [todo.md](todo.md). Replaces the plan of the learner and
lesson APIs initiative (all tasks done, shipped in PR #44; it is in git history).

## Overview

Wire four existing backend endpoints into `/admin/org`: the tree reads `GET /orgs/tree` (`hasChildren`), the
panel reads `GET /orgs/{id}/contents` in one call, and a new "Nhập từ tệp" drawer downloads the template and runs
`POST /orgs/import` as check (`dryRun=true`) then import (`dryRun=false`). Refusals are the current toast. The
users screen loses its "Nhập danh sách" link. Frontend only; the backend is not changed.

## Architecture decisions

- **Contracts first, all four endpoints in one task.** They share one schema file and the mock needs them all;
  splitting them buys nothing.
- **The tree keeps its own store and its subscription model.** Only the endpoint, the item type
  (`OrganizationTreeNode`) and the openable rule (`hasChildren`, not `orgType === 'UNIT'`) change. `units$` keeps
  its shape for the org form (`id`, `code`, `name`, `orgType`).
- **The panel's org comes from `/contents`, not the tree.** Tree nodes have no `memberCount` / `teamCount`, so
  `OrgStore` exposes `org$` from `contents.organization`; the tree node is only the selection.
- **Import is its own store (`OrgImportStore`)**, provided by the drawer component, with `serverMutation` for the
  check and the import (`errors: 'toast'`) and `serverMutation`-style one-shot for the template download through
  `FileSaver`. It invalidates the org change token that `OrgStore` already owns, which reloads tree and panel.
- **Mock uses fixtures for import.** `fake-backend.ts` does not parse Excel: a file whose name contains `loi`
  answers `ORGANIZATION-IMPORT_INVALID`, any other answers success. Tree and contents are computed from the
  seeded orgs.

## Dependency graph

```
T1 contracts (schemas + endpoints)
 ├── T2 mock handlers (tree, contents, template, import)
 │     ├── T3 tree on /orgs/tree ──┐
 │     ├── T4 panel on /contents ──┤ (T3 and T4 both touch org.store.ts / org.spec.ts → sequential)
 │     └── T5 import store ────────┴── T6 import drawer on the org screen
 └── T7 hide users import (independent, XS)
```

## Task list

### Phase 1: foundation

- [x] T1: Contracts for the four endpoints
- [ ] T2: Mock handlers and fixtures

### Checkpoint A

- [ ] `npx nx test contracts mocks` green; `npm run check` green

### Phase 2: tree and panel

- [ ] T3: Tree reads `/orgs/tree` with `hasChildren`
- [ ] T4: Panel reads `/orgs/{id}/contents`

### Checkpoint B

- [ ] `npm run check` green; on the backend the tree and panel work for a global admin and an ADMIN ORG; browser
      pass (375/768/1280, light/dark, keyboard)

### Phase 3: import

- [ ] T5: `OrgImportStore` (template, check, import)
- [ ] T6: "Nhập từ tệp" drawer on `/admin/org`
- [ ] T7: Hide "Nhập danh sách" on `/admin/users`
- [ ] T8: Docs and final verification

### Checkpoint C (done)

- [ ] Every SPEC.md success criterion checked on the backend and on `mockBackend: true`; `npm run check` green;
      angular.md §14 and the visual-design checklist pass

## Risks and mitigations

| Risk                                                                                     | Impact | Mitigation                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared backend data differs from the local seed; import writes real rows there           | Med    | Verify import on a local backend (`LMS_API_TARGET=http://localhost:8019`); on the shared one use check (`dryRun=true`) only, unless you say otherwise |
| `EndpointClient` multipart with a query param (`dryRun`) not covered by an existing spec | Low    | T1 adds an endpoint spec asserting the URL query and the `file` part                                                                                  |
| Blob refusal (template download by a non-admin) saved as a file                          | Low    | `envelopeInterceptor` already reads a JSON envelope on a `blob` endpoint (`learner-progress`); T5 tests it                                            |
| `/orgs/tree` levels arrive after a reload and overwrite fresh data                       | Low    | T3 keeps the `inFlight` guard and adds a test for a reload during a pending level                                                                     |
| Panel flashes empty between nodes now that counts come from `/contents`                  | Low    | T4 keeps the last org while the new one loads only if it is the same id; otherwise shows the spinner, as the teams list does today                    |

## Open questions

None blocking. Where import is verified with real writes (local backend vs. shared) is noted under Risks.
