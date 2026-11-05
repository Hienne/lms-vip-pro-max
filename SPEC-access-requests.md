# Spec: `access-requests`

Map: [SPEC-auth-self-service.md](SPEC-auth-self-service.md) (approved 2026-11-05: shared module, inbox as a tab on
the Người dùng screen). Read `docs/conventions/angular.md`, `contracts-and-mocks.md`, `visual-design.md` and
`docs/migration/mockup-to-angular.md` first.

## Objective

An admin sees every pending request from a visitor (to register, or to reset a password) in one place, the
"Yêu cầu" tab of the Người dùng screen, and can reject one with a note. The two sibling modules
(`self-registration`, `password-reset-request`) add the public forms and the approve / resolve actions on top of
what this module builds: the table, the contract, the list and reject endpoints, the throttle and the tab.

This module alone ships a tab that lists and rejects requests, but nothing creates a request until a sibling
lands. It is built first and verified with seeded rows.

Users: admins with the `USER_MANAGEMENT` function. No mockup page exists for this; the tab follows
`docs/conventions/visual-design.md` and reuses the Người dùng screen's toolbar and table.

## What exists today

- Frontend: `/admin/users` (`USER_MANAGEMENT`, `features/admin-org/users/`), one `UsersStore` and an editor
  (`UserEditor`) that calls `POST /api/v1/users` with a temporary `initialPassword`.
- Backend (`corebanking-academy`, package `vn.com.coreacademy.identity`): `UserController` with list, create,
  get, patch, `PATCH /{id}/status`, role-grants. `SecurityConfig` has one public path
  (`POST /api/v1/auth/login`). No request table, no reset-password endpoint, no mail.
- `users` has `must_change_password`, `status` (`active` / `inactive` / `locked`), `auth_provider`.

## Data (new)

Upgrade script `docs/sql/upgrade/2026-11-05-access-requests.sql`, rollback
`2026-11-05-access-requests.rollback.sql`, and the `psql` command that applies it, as in the earlier upgrades.

```text
learning_hub.access_requests
  request_id      bigint identity PK
  kind            varchar(20)  NOT NULL CHECK (kind IN ('REGISTER', 'PASSWORD_RESET'))
  status          varchar(20)  NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
  staff_code      varchar(20)  NOT NULL            -- the requested user_id (REGISTER) or the account asked about
  full_name       varchar(255)                     -- REGISTER only
  email           varchar(100)
  org_id          bigint                           -- REGISTER: the unit asked for; PASSWORD_RESET: the account's unit
  target_user_id  varchar(20)                      -- PASSWORD_RESET: the matched account, null when none matched
  password_hash   varchar(255)                     -- REGISTER only: set by the sibling spec, never returned
  created_time    timestamptz  NOT NULL DEFAULT now()
  resolved_by     varchar(20)                      -- admin user_id
  resolved_time   timestamptz
  resolution_note varchar(500)
```

- A partial unique index allows one `PENDING` row per (`kind`, lower(`staff_code`)), so a second request while one
  is waiting answers the same success message and creates nothing (the sibling specs rely on it).
- `password_hash` is write-only on the server: no endpoint returns it and no log prints it.
- A `PASSWORD_RESET` row for an unknown staff code is stored with `target_user_id` null, so the public answer
  never differs. The admin sees it flagged "Không tìm thấy tài khoản" and can only reject it.

## Endpoints

| Key (registry)                       | Endpoint                                      | Notes                                                     |
| ------------------------------------ | --------------------------------------------- | --------------------------------------------------------- |
| `adminOrgEndpoints.accessRequests`   | `GET /api/v1/access-requests`                 | query `kind`, `status`, `q`, `page`, `size`; paged list   |
| `adminOrgEndpoints.rejectAccessRequest` | `POST /api/v1/access-requests/{id}/reject` | body `{ note?: string }`; only a `PENDING` row            |

Response row (`AccessRequestSchema`): `requestId`, `kind`, `status`, `staffCode`, `fullName`, `email`, `orgId`,
`orgName`, `targetUserId`, `accountFound` (boolean), `createdTime`, `resolvedBy`, `resolvedTime`,
`resolutionNote`. No password field of any kind. The approve and resolve endpoints are added by the sibling
specs.

Authorisation: `USER_MANAGEMENT` function with the same unit scope the user list applies; an admin sees only rows
whose `org_id` is inside their scope. A row with a null `org_id` is visible to a global admin only. Anyone else
gets 403. Rejecting an already resolved row answers 409 with the backend's problem body.

Shared throttle (a small backend component the sibling public endpoints call; no endpoint of its own): at most
5 requests per IP per 10 minutes and 3 per (kind, staff code) per hour, answering 429 with a Vietnamese message
and a `Retry-After`. Counts live in memory per instance; that is enough for one backend node (Open question 1).

## Screen: the "Yêu cầu" tab

The Người dùng route keeps one URL and one `USER_MANAGEMENT` guard. The tab is the query value
`?tab=requests` (default `users`), so a link and the browser back button work.

```text
apps/lms/src/app/features/admin-org/users/
├── users.ts|html|scss|spec.ts            (gains the tab strip; the user list moves into its own panel component only if needed)
├── components/access-requests/
│   └── access-requests.ts|html|scss|spec.ts
└── data-access/access-requests.store.ts (+ spec)
```

Store (`AccessRequestsStore`, provided by the tab, not root):

- `requests = serverData(accessRequests, { params: filters })`, filters `kind`, `status` (default `PENDING`),
  `q`, `page`; changing a filter resets `page`.
- `reject = serverMutation(rejectAccessRequest, { errors: 'toast', success: 'Đã từ chối yêu cầu', invalidates })`.
- `pendingCount$`: the total of a `status=PENDING`, `size=1` call, shown on the tab label. It reloads after a
  reject and when a sibling action resolves a request (a shared `accessRequestsChanged` invalidation owned by a
  small root service `core/admin/access-requests-changed.ts`, the same pattern as `remindersChanged`).
- Selectors: `rows$`, `total$`, `isLoading$`, `loadError$`, `isEmpty$`.

View, using the existing toolbar and data-table patterns:

1. Tab strip (`ui` tabs): "Người dùng" and "Yêu cầu" with the pending count as plain text in the label, e.g.
   "Yêu cầu (3)"; nothing shown when 0. The count is a number, not a coloured badge.
2. Toolbar: search "Tên, mã cán bộ, email…", select "Loại yêu cầu" (Tất cả / Đăng ký / Quên mật khẩu), select
   "Trạng thái" (Chờ xử lý / Đã duyệt / Đã từ chối / Tất cả), result count.
3. Table columns: Người gửi (name or staff code, email beneath), Loại, Đơn vị, Gửi lúc (relative, absolute date
   in the title), Trạng thái, row action. A `PASSWORD_RESET` row with no matching account shows the muted line
   "Không tìm thấy tài khoản" under the staff code.
4. Row action for a pending row: "Từ chối" (ghost button) opening a dialog with an optional note field
   (max 500) and the confirm "Từ chối yêu cầu". The primary action ("Duyệt" or "Đặt lại mật khẩu") is slotted by
   the sibling modules; this module leaves the slot empty and does not render a disabled placeholder.
5. Resolved rows show who resolved, when, and the note, as muted text; no actions.
6. Empty: "Không có yêu cầu nào." Loading: spinner as the users tab does. Error: `ui-error-state` with retry.

Tab keyboard behaviour comes from the `ui` tabs primitive (`@angular/aria`); the panel moves focus per its
pattern. At 375 px the table follows the same narrow-width treatment as the user list.

## Mock

- `AdminOrgBackend` answers `accessRequests` (filtered, paged, scoped to the caller) and `rejectAccessRequest`
  (409 on a resolved row, 403 without `USER_MANAGEMENT`).
- Fixtures: five rows covering both kinds and all statuses, one reset request with no matching account, one row
  in another unit (hidden from a unit admin).

## Commands

```bash
nvm use
npm start                                   # app on :4200, proxied to the shared backend by default
npx nx test lms                             # app specs
npx nx test contracts                       # schema and registry specs
npx nx test mocks                           # mock API specs
npm run check                               # full gate; see AGENTS.md before running it
```

Backend (`~/my-projects/corebanking-academy`; run only because this module edits backend code, on the local
stack from `SPEC-local-stack.md`, never on `103.121.90.119`):

```bash
./mvnw test -Dtest=AccessRequest*           # unit tests
./mvnw verify -Dit.test=AccessRequestApiIT  # integration test against the local Postgres
psql … -f docs/sql/upgrade/2026-11-05-access-requests.sql
psql … -f docs/sql/upgrade/2026-11-05-access-requests.rollback.sql
```

## Project structure

| Where                                                        | What                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `libs/contracts/src/lib/identity/` (or `admin-org/`)         | `AccessRequestSchema`, query and reject command, endpoints   |
| `libs/mocks/`                                                | fixtures and the backend branch                              |
| `apps/lms/src/app/features/admin-org/users/`                 | tab, component, store (above)                                |
| `apps/lms/src/app/core/admin/access-requests-changed.ts`     | the invalidation token                                       |
| `corebanking-academy/.../identity/{controller,service,repository,entity,dto}` | request entity, repository, service, controller |
| `corebanking-academy/docs/sql/upgrade/`                      | upgrade and rollback scripts                                 |

## Code style

As `angular.md`: standalone zoneless components, signals, `$`-suffixed selectors, tokens only, Vietnamese UI copy,
English code. Endpoint definition shape, for example:

```ts
accessRequests: defineEndpoint({
  method: 'get',
  path: '/api/v1/access-requests',
  query: AccessRequestsQuerySchema,
  response: PageSchema(AccessRequestSchema),
}),
```

## Testing

- `libs/contracts`: registry row for both endpoints; the schema rejects a payload carrying `passwordHash`
  (strict) and accepts a null `targetUserId`.
- `access-requests.store.spec.ts`: default filter is `PENDING`; a filter change resets `page`; reject reloads the
  list and the count; the count bumps on `accessRequestsChanged`; 403 and 409 surface as the error toast.
- `access-requests.spec.ts`: columns and "Không tìm thấy tài khoản" line; reject dialog with and without a note;
  empty, error with retry; resolved rows have no action; keyboard path through filters, row action and dialog.
- `users.spec.ts`: tab switches on `?tab=requests`, the label shows the count only when above 0, the user list is
  untouched on the default tab.
- Backend: repository / service tests for scope, the one-pending-per-key index, reject on a resolved row (409),
  throttle (5 per IP, 3 per key, 429 with `Retry-After`); an integration test that no response body or log line
  contains `password_hash`. The rollback script is run once against the local database and the table is gone.

## Boundaries

- Always: parse every response with its schema; scope rows by the caller's unit on the server; keep
  `password_hash` out of every response, log and `toString`; write the rollback with the upgrade.
- Ask first: touching `SecurityConfig` beyond the sibling modules' public paths; adding a dependency (a rate
  limit library, for instance); changing what the user list shows.
- Never: touch the shared backend; return or log a password or its hash; make a public endpoint answer
  differently for a staff code that exists; commit a `mockBackend: true` change made for a browser check.

## Success criteria

1. Local backend with seeded rows, as a global admin: Người dùng → "Yêu cầu" lists them, the label shows the
   pending count, filters work, "Từ chối" with a note moves a row to Đã từ chối and drops the count by one.
2. As a unit admin: rows of another unit are absent from the list and from the count; rejecting one by id answers
   403.
3. Rejecting a rejected request answers 409 and the UI shows the error toast.
4. The 6th request from one IP inside 10 minutes answers 429 (backend test); no response carries a password hash.
5. Mock (`mockBackend: true`): the same flow on the five fixture rows.
6. The upgrade applies cleanly on the local database, the rollback removes the table, and both are idempotent in
   their `IF [NOT] EXISTS` guards.
7. `npm run check` green; angular.md §14 and the visual-design checklist pass at 375, 768 and 1280 px, light and
   dark, keyboard only. Reported with what was run and how.

## Open questions

1. **Throttle storage.** In memory per instance is enough for one node. If the backend runs on several, the
   counts need the database (a small table) or a gateway rule. Is the backend single-node?
2. **Scope of a null-unit request.** A registration with no unit chosen is visible to global admins only, as
   written above. Should unit admins see it too?
3. **Retention.** Resolved rows stay forever in this spec. Add a purge after N days, or keep them as an audit
   trail?
4. **Tab label count source.** A second small list call (`size=1`) is used for the count. If the backend offers a
   cheaper count, switch to it.
