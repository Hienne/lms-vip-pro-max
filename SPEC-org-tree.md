# Spec: org tree and import from file ("Cây đơn vị & Nhập từ tệp")

Status: **approved 2026-10-27; plan in git history (`tasks/plan.md` at `d9fe5a3`). Built on branch
`claude/agent-skills-be-fe-integration-fb8624` (T1–T8); not merged.**

Replaces the map of the learner and lesson APIs initiative (shipped in PR #44; that map is in git history). Its
module specs (`SPEC-lesson-player.md` and the rest) stay beside this file as the reference for shipped modules.

Backend reference: `corebanking-academy/docs/api/IDENTITY.md` §3 "Cây tổ chức và nhóm" and "Nhập đơn vị/phòng và
nhóm bằng Excel", §5 rows O1–O4, §6 item 6. Controllers: `OrganizationController` (`tree`, `contents`) and
`OrganizationImportController`. All four endpoints are on `corebanking-academy` `main` (`eef62e5`) and answer on
the shared backend (`/v3/api-docs`, checked 2026-10-27).

## Objective

The org screen (`/admin/org`) builds its tree from `GET /orgs` (`rootOnly`, then `parentId`) and guesses which
nodes can open: every UNIT gets a "Đang tải…" placeholder, even one with no children. Its panel needs two calls
(`/orgs/{id}` and `/orgs/{id}/teams`). The "Nhập từ tệp" button links to `/admin/import?type=org`, a route with no
screen. The backend now has the endpoints made for this screen; this spec wires them:

1. **Tree** — `GET /orgs/tree` loads one level at a time and says `hasChildren`, so only nodes with children in
   the caller's scope show an expand control.
2. **Panel** — `GET /orgs/{id}/contents` returns the node, its direct administrators and one page of its teams in
   one call.
3. **Import** — download the Excel template, pick a `.xlsx`, check it (`dryRun=true`), read the counts, confirm,
   import (`dryRun=false`), then reload the tree and the panel. A refusal is a toast, as on every other screen;
   the per-row `errors[]` are not shown in this spec.

Users: global administrators (orgs and teams) and ADMIN ORG (teams only, inside their active branch). Who may do
what is decided by the server; the app only hides "Thêm đơn vị / phòng" as today (`canManageOrgs$`).

Not a capability map: the three parts land on one screen and one store, and the import's success path reloads the
tree and the panel, so they ship as one module in three commits.

## The four endpoints

| #   | Endpoint                            | In contracts today | Response                                                                                              |
| --- | ----------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| O1  | `GET /api/v1/orgs/tree`             | no                 | `Page<OrganizationTreeNode>`; query `parentId?`, `page`, `size` (1–100, def. 20)                      |
| O2  | `GET /api/v1/orgs/{orgId}/contents` | no                 | `{ organization, administrators, teams: Page<TeamInfo> }`; `page`, `size`, `sort`                     |
| O3  | `GET /api/v1/orgs/import-template`  | no                 | `.xlsx` binary, no envelope (`blob` endpoint); a refusal is a JSON envelope                           |
| O4  | `POST /api/v1/orgs/import?dryRun=`  | no                 | multipart part `file`; `{ dryRun, organizationCount, teamCount, createdOrganizations, createdTeams }` |

`OrganizationTreeNode` = `{ id, parentId, orgType, code, name, status, sortNo, hasChildren }`, no counts.
`organization` and `administrators` in O2 have the same schema as `GET /orgs/{id}` (`OrganizationDetailSchema`).

An invalid file is HTTP 200, `status: ERROR`, `messageCode: ORGANIZATION-IMPORT_INVALID`, `data: null` and up to
200 `errors[]` of `{ field, code, message }`, where `field` is `Sheet[excelRow].column` (`Organizations[3].code`,
`Teams[5].orgCode`) or `file` for file/header/limit errors. Nothing is written when there is any error. The app
does not read `errors[]` yet: the toast shows the envelope's `messageTitle` and `message`, as for any refusal.
An ADMIN ORG file with rows in Organizations is HTTP 403 `CORE-ACCESS_DENIED`, also a toast.

## What changes in the app

### 1. Contracts (`libs/contracts/src/lib/organization`)

- `OrganizationTreeNodeSchema`, `OrgTreeQuerySchema` (`parentId?`, `page`, `size ≤ 100`),
  `OrganizationContentsSchema`, `OrganizationImportResultSchema`, `ORG_IMPORT_LIMITS` (5 MiB, `.xlsx` only, 1000
  rows) and the endpoints `orgTree`, `orgContents`, `orgImportTemplate` (`responseType: 'blob'`) and `importOrgs`
  (multipart body `{ file: File }`, query `{ dryRun: boolean }`) in `organizationEndpoints`.
- No envelope or error-model change: `errors[]` stays unread, `ORGANIZATION-IMPORT_INVALID` is not added to
  `MESSAGE_CODE_KIND`, and both import calls use `errors: 'toast'`.
- `listOrgs`, `getOrg`, `listTeams` stay: the user form, the assignment picker and course sharing use `/orgs`.

### 2. Tree (`org-tree.store.ts`)

- Each level reads `orgTree` (`parentId` absent for the roots) instead of `listOrgs`. Page size 50 stays.
- A node shows the expand control and the "Đang tải…" placeholder only when `hasChildren` is true. A node with
  `hasChildren: false` is a leaf, whatever its `orgType`.
- A root whose `parentId` is outside the scope is shown as a root; the app never loads its parent.
- The store keeps `OrganizationTreeNode`s, not `OrganizationInfo`s. `units$` (the parent picker of the org form)
  reads `{ id, code, name, orgType }` from them, which the form already uses.
- Ignore a stale answer: a level reply for a key that is no longer wanted (the tree was reloaded) is dropped.

### 3. Panel (`org.store.ts`, `org.html`)

- `detailData` + `teamsData` become one `serverData` on `orgContents` keyed by `{ orgId, page }`, `size` 6,
  `sort: 'name,asc'`. The team page resets to 0 when the node changes (the `linkedSignal` stays).
- The panel's name, code, status, `memberCount`, `teamCount` and administrators come from
  `contents.organization` / `contents.administrators`, not from the tree node (tree nodes carry no counts). The
  edit drawer opens with `contents.organization`.
- `serverData` already drops the answer for a node the user has left; the spec adds a test for it.
- Not found or out of scope (`CORE-RESOURCE_NOT_FOUND`) shows the panel's error state with retry, as today.

### 4. Import from file (new drawer on the org screen)

"Nhập từ tệp" opens a drawer on `/admin/org` instead of linking to `/admin/import?type=org` (the backend's flow
calls it a dialog on this screen; `/admin/import` stays unbuilt for questions and users — see Open questions).

Flow, matching IDENTITY.md "Luồng FE":

1. **Tải mẫu Excel** — calls O3 and saves `organization-import-template.xlsx` through `core/files/file-saver`.
2. **Chọn tệp** — one `<input type="file" accept=".xlsx">`. The app checks extension and size (≤ 5 MiB) before
   sending; everything else is the server's check. Picking another file clears the previous result.
3. **Kiểm tra** — O4 with `dryRun=true`. Success shows "Hợp lệ: N đơn vị/phòng, M nhóm". Any failure
   (`ORGANIZATION-IMPORT_INVALID`, 403, 500, offline) is the usual toast and the file stays picked, so the user can
   fix it and pick it again.
4. **Nhập dữ liệu** — enabled only after a successful check of the current file; O4 with `dryRun=false`; the
   button is disabled while either request is pending (no double submit). Success toasts "Đã nhập N đơn vị/phòng,
   M nhóm", closes the drawer and bumps the org change token, so the tree and the panel reload. A real import can
   still be refused (data changed since the check): toast, the drawer stays open and the check result is cleared.

- The drawer shows the selected node's code with a copy button, as a hint for `orgCode` / `parentCode`. The app
  never edits the file's codes.
- ADMIN ORG sees the drawer too, with the line "Bạn chỉ nhập được nhóm trong phạm vi quản lý; để trống sheet
  Organizations." The server enforces it.

State lives in a new `OrgImportStore` (`features/admin-org/org/data-access/org-import.store.ts`), provided by the
drawer; it is handed the org change token by `OrgStore`. The drawer is a component in
`features/admin-org/org/components/org-import/`.

### 5. Mock (`libs/mocks`)

`mockBackend: true` must keep the screen usable: `fake-backend.ts` answers `orgTree` (from the seeded orgs, with
`hasChildren` computed in scope), `orgContents`, `orgImportTemplate` (a tiny placeholder `.xlsx` blob) and
`importOrgs` (fixture answers: a success and an `ORGANIZATION-IMPORT_INVALID` `ERROR` envelope; the mock
does not parse Excel). Fixtures parse with the contract schemas.

## Tech stack

Angular 22 standalone, zoneless, signals; Signal Forms not needed (one file input); zod 4 contracts; `@lms/ui`
drawer, tree, button, toast; `@lucide/angular`; Vitest. No new dependency: the browser sends the file as
multipart (`EndpointClient` already builds `FormData`), no Excel parsing in the app.

## Commands

```bash
nvm use
LMS_API_TARGET=http://localhost:8019 npm start   # or the shared backend via proxy.conf.mjs
npx nx test contracts
npx nx test mocks
npx nx test lms
npm run check
```

## Project structure (files touched)

```
libs/contracts/src/lib/organization/organization.schema.ts  tree node, contents, import result, limits
libs/contracts/src/lib/organization/organization.endpoints.ts (+ .spec.ts)
apps/lms/src/app/features/admin-org/org/data-access/org-tree.store.ts (+ .spec.ts)
apps/lms/src/app/features/admin-org/org/data-access/org.store.ts
apps/lms/src/app/features/admin-org/org/data-access/org-import.store.ts (+ .spec.ts)   new
apps/lms/src/app/features/admin-org/org/components/org-import/                         new
apps/lms/src/app/features/admin-org/org/org.html, org.ts, org.spec.ts
libs/mocks/src/lib/backend/fake-backend.ts, fixtures
docs/conventions/contracts-and-mocks.md   tree paging line (/orgs/tree, hasChildren)
```

## Code style

Follow the existing stores: private `state` signals, setters as the only writers, commands as public methods,
`serverData` / `serverMutation` for HTTP, selectors suffixed `$`. Example of the import command shape:

```ts
private readonly checkMutation = serverMutation(
  (file: File) =>
    this.client.call(organizationEndpoints.importOrgs, {
      query: { dryRun: true },
      body: { file },
    }),
  { errors: 'toast', onSuccess: (result) => this.setChecked(result) },
);
```

## Testing strategy

- **contracts:** each new schema parses the IDENTITY.md examples; `importOrgs` builds multipart with part `file`
  and `dryRun` in the query.
- **lms, `org-tree.store.spec.ts`:** roots from `orgTree` without `parentId`; opening a node sends `parentId`;
  `hasChildren: false` gives a leaf with no placeholder; "Xem thêm…" reads the next page; reload on the token.
- **lms, `org.spec.ts`:** panel renders from `orgContents`; changing node resets the team page and drops the late
  answer for the old node.
- **lms, `org-import.store.spec.ts`:** wrong extension / too big is refused without a request; new file clears the
  result; confirm is disabled until a successful check and while pending; an `ORGANIZATION-IMPORT_INVALID`
  answer toasts and leaves no check result; success bumps the change token and closes.
- **mocks:** fixtures parse.
- **Manual, on the backend:** as `admin` (global) import the template with one UNIT, one DEPARTMENT and one team;
  as an ADMIN ORG account import teams only, and a file with rows in Organizations toasts the 403; a file with a
  duplicate code toasts the backend's import refusal. Tree on a scoped account shows only its branch.

## Boundaries

- **Always:** AGENTS.md and the docs it lists (angular.md, contracts-and-mocks.md, visual-design.md); every
  response parsed by its schema; UI copy in Vietnamese, code and commits in English; one commit per part
  (contracts+tree, panel, import), `npm run check` green before each.
- **Ask first:** a new dependency (e.g. an Excel reader); a backend change; changing the `/orgs` contract that the
  user form, assignments and course sharing use; building the generic `/admin/import` page.
- **Never:** validate business rules of the file in the app (duplicate codes, parents, scope); load ancestors
  outside the scope; keep the uploaded file after the drawer closes; commit to `main` or commit secrets.

## Success criteria

1. On the backend, the tree of a global admin and of an ADMIN ORG shows only nodes in scope; only nodes with
   `hasChildren` have an expand control; levels over 50 nodes page with "Xem thêm…".
2. Selecting a node makes one request (`/contents`); the panel shows counts, administrators and paged teams.
3. "Tải mẫu Excel" saves the backend's template.
4. A valid file: check shows the counts, confirm imports, the new nodes appear in the tree without a page reload.
5. An invalid file: a toast with the backend's title and message; nothing is imported and "Nhập dữ liệu" stays
   disabled.
6. Double-click on "Nhập dữ liệu" sends one request; changing the file clears the old result.
7. `mockBackend: true` shows the tree, the panel, a successful import and the refusal toast.
8. `npm run check` green; angular.md §14 and the visual-design checklist pass.

## Decisions (2026-10-27)

1. **Import lives in a drawer on `/admin/org`**, not on the mockup's `/admin/import` page. The route stays unbuilt.
2. **"Nhập danh sách" on `/admin/users` is hidden**: the backend has no user import endpoint. Removing the link is
   part of this spec (`features/admin-org/users/users.html` and its spec).
3. **Per-row errors are a later spec.** Showing `errors[]` (sheet, row, column, message) needs an envelope and
   `AppError` change; every refusal here is the current toast.
