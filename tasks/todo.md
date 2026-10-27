# Tasks: org tree and import from file ("Cây đơn vị & Nhập từ tệp")

Spec: [SPEC.md](../SPEC.md) · Plan: [plan.md](plan.md). Frontend only, this worktree, branch
`claude/agent-skills-be-fe-integration-fb8624`. Backend `corebanking-academy` (`main`, `eef62e5`) is not changed.
One commit per task; stop at each checkpoint. Paths: `app/` = `apps/lms/src/app/`, `contracts/` =
`libs/contracts/src/lib/`, `mocks/` = `libs/mocks/src/lib/`, `org/` = `app/features/admin-org/org/`.

Every task's verification includes the focused tests named and `npx nx test <project>` for the projects it
touches; every checkpoint runs `npm run check`. Screen tasks also run the browser pass of
`docs/migration/mockup-to-angular.md` → Verify (375/768/1280, light/dark, keyboard, error states).

## Phase 1: foundation

### T1: Contracts for the four endpoints (S)

Add `OrganizationTreeNodeSchema`, `OrgTreeQuerySchema` (`parentId?`, `page`, `size` 1–100),
`OrganizationContentsSchema` (`organization`, `administrators` from the existing schemas, `teams:
PageSchema(TeamInfoSchema)`), `OrganizationImportResultSchema`, `ORG_IMPORT_LIMITS` (`maxBytes: 5 MiB`,
`extension: '.xlsx'`) and the endpoints `orgTree`, `orgContents`, `orgImportTemplate` (`responseType: 'blob'`),
`importOrgs` (`bodyEncoding: 'multipart'`, body `{ file: File }`, query `{ dryRun: boolean }`), each with a doc
comment.

- [x] Each schema parses the IDENTITY.md examples (tree page, contents, import result).
- [x] `importOrgs` declares multipart with part `file` and `dryRun` as a query param.
- [x] Existing `listOrgs`, `getOrg`, `listTeams` unchanged.

Verify: `npx nx test contracts`. Files: `contracts/organization/organization.schema.ts`,
`organization.endpoints.ts`, `organization.endpoints.spec.ts`. Depends on: none.

### T2: Mock handlers and fixtures (M)

`fake-backend.ts` answers `orgTree` (roots in the caller's scope or the children of `parentId`, sorted by `sortNo`
then id, paged, `hasChildren` from visible children), `orgContents` (the existing detail + teams logic, one reply),
`orgImportTemplate` (a small placeholder `.xlsx` `Blob`), `importOrgs` (success with counts from the request's
`dryRun`; a file name containing `loi` answers an `ORGANIZATION-IMPORT_INVALID` `ERROR` envelope).

- [x] Tree: roots, children, `hasChildren` false on a leaf UNIT, paging past one page.
- [x] Contents matches `getOrg` + `listTeams` for the same org; out of scope answers `CORE-RESOURCE_NOT_FOUND`.
- [x] Import success and refusal fixtures parse with the T1 schemas.

Verify: `npx nx test mocks`. Files: `mocks/backend/fake-backend.ts`, its spec, an org fixtures file if one exists.
Depends on: T1.

### Checkpoint A

- [x] `npx nx test contracts mocks` and `npm run check` green. Commit T1, T2. Stop for review.

## Phase 2: tree and panel

### T3: Tree reads `/orgs/tree` with `hasChildren` (M)

`OrgTreeStore` calls `orgTree` (no `parentId` for roots) instead of `listOrgs`; levels hold
`OrganizationTreeNode`; the "Đang tải…" placeholder and the expand control appear only when `hasChildren`.
`units$` and `selected$` keep working with the node type; `OrgStore` / `org-form` compile against it.

- [x] Root call has no `parentId`; opening a node sends `parentId`; "Xem thêm…" reads the next page.
- [x] A node with `hasChildren: false` has no children and no placeholder, whatever its `orgType`.
- [x] Reload on the change token rereads loaded levels; a reload during a pending level does not duplicate items.

Verify: `npx nx test lms -- org-tree.store`, `npx nx test lms -- org`. Files: `org/data-access/org-tree.store.ts`,
`org-tree.store.spec.ts`, `org/components/org-form/org-form.ts` (type only, if needed). Depends on: T2.

### T4: Panel reads `/orgs/{id}/contents` (M)

Replace `detailData` + `teamsData` in `OrgStore` with one `serverData` on `orgContents` keyed by
`{ orgId, page }` (`size` 6, `sort: 'name,asc'`). Add `org$` (from `contents.organization`); the panel's code,
status, counts, administrators and the edit drawer read it instead of the tree node.

- [x] Selecting a node sends one request; counts, administrators and teams render from it.
- [x] Changing node resets the team page to 1 and ignores a late answer for the previous node.
- [x] Not found shows the panel error state with retry; edit and pause still work and reload the panel.

Verify: `npx nx test lms -- org`; on the backend (global admin, then an ADMIN ORG account) open nodes and page
teams. Files: `org/data-access/org.store.ts`, `org/org.html`, `org/org.spec.ts`. Depends on: T3.

### Checkpoint B

- [x] `npm run check` green (browser and backend pass done after T6, see T8); tree and panel checked on the backend for both roles; browser pass. Commit T3, T4.
      Stop for review.

## Phase 3: import

### T5: `OrgImportStore` (S)

New store: `downloadTemplate()` (calls `orgImportTemplate`, saves `organization-import-template.xlsx` with
`FileSaver`, toast on refusal), `pick(file)` (rejects non-`.xlsx` or > 5 MiB with an inline message, no request;
clears any previous result), `check()` (`dryRun=true`), `import()` (`dryRun=false`, only after a successful check
of the current file). Both calls `errors: 'toast'`; success of `import()` invalidates the org change token passed
in and emits `done`.

- [x] Wrong type or size: message, no request. A new file clears the check result.
- [x] `canImport$` is false until a successful check and while either call is pending; a refused import clears
      the check result.
- [x] Import success bumps the token once; template refusal (JSON envelope on the blob) is a toast, not a file.

Verify: `npx nx test lms -- org-import.store`. Files: `org/data-access/org-import.store.ts`,
`org-import.store.spec.ts`. Depends on: T2.

### T6: "Nhập từ tệp" drawer on `/admin/org` (M)

The page header button opens a `uiDrawer` (no more `routerLink` to `/admin/import`). Content: "Tải mẫu Excel"
button, short rules (`.xlsx`, ≤ 5 MiB, ≤ 1000 dòng; ADMIN ORG line when not global), file input, the selected
node's code with a copy button, check result "Hợp lệ: N đơn vị/phòng, M nhóm". Footer: "Kiểm tra", "Nhập dữ
liệu" (disabled per `canImport$`), "Hủy". Success closes the drawer; tree and panel reload.

- [x] Full flow on `mockBackend: true`: template downloads, check shows counts, import closes and reloads; a
      `loi` file toasts and leaves "Nhập dữ liệu" disabled.
- [x] Keyboard: open, pick a file, check, import, Esc closes; focus returns to the button.
- [x] Visual-design checklist: no icon tiles, badges or status colours for decoration.

Verify: `npx nx test lms -- org`; browser pass; on the local backend import a file with one UNIT, one DEPARTMENT
and one team, and see them in the tree. Files: `org/components/org-import/org-import.{ts,html,scss}`,
`org/org.html`, `org/org.ts`, `org/org.spec.ts`. Depends on: T4, T5.

### T7: Hide "Nhập danh sách" on `/admin/users` (XS)

Remove the link to `/admin/import?type=users`.

- [ ] The users page header has only "Thêm người dùng"; no other screen links to `/admin/import?type=users`.

Verify: `npx nx test lms -- users`. Files: `app/features/admin-org/users/users.html`, `users.spec.ts` if it
asserts the link. Depends on: none.

### T8: Docs and final verification (S)

Update `docs/conventions/contracts-and-mocks.md` (paging line: the tree reads `/orgs/tree` with `hasChildren`;
import endpoints listed), and the org entry in `migration-entries.data.ts` if it names the import route.

- [ ] Every SPEC.md success criterion checked and reported with how it was verified.

Verify: `npm run check`. Files: `docs/conventions/contracts-and-mocks.md`,
`app/features/design-system/data-access/migration-entries.data.ts`. Depends on: T6, T7.

### Checkpoint C (done)

- [ ] `npm run check` green; angular.md §14 and the visual-design checklist pass; SPEC.md success criteria 1–8
      met on the backend and on the mock. Commit T5–T8. Stop for review before a PR.
