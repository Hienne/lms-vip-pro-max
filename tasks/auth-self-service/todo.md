# Tasks: `access-requests`

Spec: [SPEC-access-requests.md](../../SPEC-access-requests.md) · Plan: [plan.md](plan.md).

Run `nvm use` first. Focused tests: `npx nx test lms`, `npx nx test contracts`, `npx nx test mocks`. Whole gate:
`npm run check` (read AGENTS.md before running it). Backend: `./mvnw test -Dtest=AccessRequest*`. One commit per
task; the message names the module and task and ends with the attribution line.

## T1: Contract schemas and endpoints

**Acceptance criteria:**

- [ ] `AccessRequestSchema` (strict, no password field), `AccessRequestsQuerySchema`, `RejectAccessRequestCommandSchema`
      (`note` optional, max 500), kind and status enums.
- [ ] `adminOrgEndpoints.accessRequests` (GET, paged) and `adminOrgEndpoints.rejectAccessRequest` (POST) are
      registered with the paths of the spec.

**Verification:** `npx nx test contracts` (registry row for both; schema rejects `passwordHash`; accepts null `targetUserId`)

**Dependencies:** none · **Files:** `admin-org.schema.ts`, `admin-org.endpoints.ts`, `admin-org.endpoints.spec.ts` · **Size:** S

## T2: Mock API and fixtures

**Acceptance criteria:**

- [ ] Five fixture rows: both kinds, all three statuses, a reset request with no matching account, a row in
      another unit.
- [ ] The admin-org mock answers `accessRequests` (filters kind, status, q, page; scoped to the caller) and
      `rejectAccessRequest` (409 on a resolved row, 403 without `USER_MANAGEMENT`).

**Verification:** `npx nx test mocks`

**Dependencies:** T1 · **Files:** `admin-org.fixtures.ts`, the admin-org backend branch + its spec · **Size:** S

## Checkpoint: Contract

- [ ] `npx nx test contracts` and `npx nx test mocks` pass
- [ ] Review with the human before the backend and the UI start

## T3: Upgrade and rollback scripts, entity, repository (backend)

**Acceptance criteria:**

- [ ] `docs/sql/upgrade/2026-11-05-access-requests.sql` creates the table, checks and the partial unique index of
      the spec with `IF NOT EXISTS`; the rollback drops it with `IF EXISTS`; the `psql` command is in the header.
- [ ] `AccessRequest` entity and `AccessRequestRepository`; `toString` never prints `password_hash`.

**Verification:** apply, rollback, apply again on the local database; `./mvnw test -Dtest=AccessRequestRepositoryTest`
(one pending per (kind, staff code), second insert rejected)

**Dependencies:** none (parallel with T1) · **Files:** the two scripts, entity, repository, repository test · **Size:** M

## T4: List and reject endpoints with scope (backend)

**Acceptance criteria:**

- [ ] `GET /api/v1/access-requests` filters by kind, status, q and pages; `POST …/{id}/reject` sets `REJECTED`,
      `resolved_by`, `resolved_time`, `resolution_note`.
- [ ] Needs `USER_MANAGEMENT`; rows outside the caller's unit scope are absent; a null-unit row is global-admin
      only; 403 otherwise; reject of a resolved row answers 409.
- [ ] No response or log line contains a password hash (integration test).

**Verification:** `./mvnw test -Dtest=AccessRequest*` and `./mvnw verify -Dit.test=AccessRequestApiIT`

**Dependencies:** T3 · **Files:** controller, service, DTOs, service test, `AccessRequestApiIT` · **Size:** M

## T5: Throttle component (backend)

**Acceptance criteria:**

- [ ] A component allows 5 calls per IP per 10 minutes and 3 per (kind, staff code) per hour; the 6th / 4th throws
      a 429 problem with a Vietnamese message and a `Retry-After`.
- [ ] It has no endpoint and is not wired into `SecurityConfig`; the sibling specs call it.

**Verification:** `./mvnw test -Dtest=AccessRequestThrottleTest` (limits, window expiry with an injected clock)

**Dependencies:** none · **Files:** throttle class, its test, an exception mapping if missing · **Size:** S

## Checkpoint: Backend

- [ ] `./mvnw test` passes; the integration test passes against the local Postgres
- [ ] Upgrade and rollback applied once each on the local database
- [ ] Review with the human

## T6: Store and invalidation token

**Acceptance criteria:**

- [ ] `core/admin/access-requests-changed.ts` holds the `accessRequestsChanged` invalidation.
- [ ] `AccessRequestsStore`: `requests` with filters (`status` defaults to `PENDING`, a filter change resets
      `page`), `reject` mutation (toast on error, success text "Đã từ chối yêu cầu"), `pendingCount$` from a
      `status=PENDING&size=1` call, reloading on reject and on the token.

**Verification:** `npx nx test lms` (`access-requests.store.spec.ts`: default filter, page reset, reject reloads
list and count, token bump, 403 / 409 toast)

**Dependencies:** T2 · **Files:** `access-requests-changed.ts`, `access-requests.store.ts` (+ spec) · **Size:** S

## T7: Tab strip on Người dùng

**Acceptance criteria:**

- [ ] Tabs "Người dùng" and "Yêu cầu"; the active tab is `?tab=requests` (default `users`); back button and a
      direct link work.
- [ ] The label shows "Yêu cầu (n)" only when n > 0, as text. The user list, its store and its template body are
      unchanged on the default tab.
- [ ] Keyboard behaviour comes from the `ui` tabs primitive.

**Verification:** `npx nx test lms` (`users.spec.ts`: tab switch by query, count only above 0, default tab
untouched); manual at 375 / 768 / 1280 px on the mock

**Dependencies:** T6 · **Files:** `users.ts|html|scss`, `users.spec.ts` · **Size:** S

## T8: Requests table, filters, empty and error states

**Acceptance criteria:**

- [ ] Toolbar: search, "Loại yêu cầu", "Trạng thái" (default Chờ xử lý), result count.
- [ ] Columns: Người gửi (name or code, email under), Loại, Đơn vị, Gửi lúc (relative, absolute in the title),
      Trạng thái, action. A reset request with no account shows "Không tìm thấy tài khoản". Resolved rows show who,
      when and the note, with no actions.
- [ ] Empty "Không có yêu cầu nào."; loading spinner; `ui-error-state` with retry. The primary-action slot is empty
      and nothing disabled stands in for it.

**Verification:** `npx nx test lms` (`access-requests.spec.ts`: columns, no-account line, resolved rows, empty,
error with retry); visual-design checklist on the mock

**Dependencies:** T7 · **Files:** `components/access-requests/access-requests.ts|html|scss|spec.ts` · **Size:** M

## T9: Reject dialog

**Acceptance criteria:**

- [ ] "Từ chối" on a pending row opens a dialog with an optional note (max 500) and the confirm "Từ chối yêu cầu".
- [ ] Confirming rejects, closes the dialog, removes the row from the pending list and drops the count by one.
      Escape and cancel leave the row untouched; focus returns to the row action.

**Verification:** `npx nx test lms` (with and without a note, cancel, focus return, keyboard path)

**Dependencies:** T8 · **Files:** the access-requests component (+ dialog part) and its spec · **Size:** S

## Checkpoint: Complete

- [ ] Local backend with seeded rows: the five success criteria of the spec pass, including the unit-admin scope and
      the 409 on a second reject
- [ ] Mock (`mockBackend: true`, not committed): the same flow
- [ ] `npm run check` green; angular.md §14 and the visual-design checklist at 375, 768, 1280 px, light and dark,
      keyboard only
- [ ] Spec "Implementation notes (as built)" added; map status updated; review with the human
