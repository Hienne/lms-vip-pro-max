---
artifact: decisions
status: validated
workspace: lms-vip-pro-max
project: lms
source: conversation
revision: 4
handoff: ready-for-spec
---

# Auth API integration (login, logout, auth/me) — decisions

## Facts found

- Backend (OpenAPI 3.1, "CORE Academy API") exposes only three endpoints:
  - `POST /api/v1/auth/login` `{ username, password }` (username or staff code), public.
    200 → `BaseResponse<TokenResponse { accessToken, tokenType, expiresInSeconds }>`.
  - `POST /api/v1/auth/logout`, bearer. Revokes **every** JWT of the account (all devices, via
    `auth_ver`); 401 when the token is missing, expired or revoked.
  - `GET /api/v1/auth/me`, bearer. `BaseResponse<MeResponse { user: UserInfo, roles: string[],
    functions: string[], roleGrants: RoleGrant[], functionDetails: FunctionInfo[],
    functionScopes: Record<string, Scope[]> }>`; `Scope.type` ∈ GLOBAL | ORG | TEAM | OWN.
- No refresh-token endpoint. Swagger: paste the raw token, without the `Bearer` prefix.
- Every response is wrapped: `{ responseId, timestamp, status: SUCCESS|ERROR, messageCode,
  message, messageTitle, data, errors?: { field, code, message }[] }`.
- Probed: 401 → `messageCode CORE-0401`, English message; empty login → **400** (not 422)
  `CORE-0400-VALIDATION` with `errors[]` (`NotBlank`). CORS allows `http://localhost:4200`,
  headers `authorization, content-type`, exposes `X-Request-Id`; no credentials/cookies.
- App today (`libs/contracts/src/lib/auth`): email login, cookie session assumed,
  `LoginResult { id, roleId }`, `Profile` (= `User` + unitName, groupName, roleName,
  `menus: MenuKey[]`, `homePath`, `scopeName`) from `/api/auth/profile`; plus `loginDemo`,
  `demoAccounts`, `updateProfile`, `changePassword` that the backend does not have.
- `SessionStore` restores the profile at boot, `profile` 401 = anonymous visitor; guards
  (`authGuard`, `menuGuard`, `homeGuard`, `guestGuard`) read `user$`, `menus$`, `homePath$`.
- `sessionExpiryInterceptor` turns a non-exempt 401 into `SessionExpiry.end()` (toast +
  `/login?next=`). `toAppError` maps 422 → invalid, 423 → locked; `ApiErrorSchema` is
  `{ message, details }`, marked provisional.
- `mockApiInterceptor` answers by endpoint identity and sends endpoints without a fixture to the
  network. `apiBaseUrlInterceptor` prefixes `/api/`. All environments now point `apiBaseUrl` at
  `http://103.121.90.119:8019`; the uncommitted `environment.ts` sets `mockApi: false`.
- Migrated screens: login, profile, admin users/user detail/org/roles, 403. No overview screen
  (`/learn` "Trang chủ học tập", `/admin` "Tổng quan quản trị", `/instructor`) is migrated; they
  render the route placeholder. Shell header shows `user.name` and `roleText(user)`.
- Only `LOCAL_STORAGE` exists in `core/storage` (preferences).
- `MeResponse` detail from the backend team (pasted 2026-10-16): `UserInfo.userId` is the staff
  code (keeps leading zeros); `email` and every org/team/branch field are nullable;
  `status` ∈ active | locked | inactive; `authProvider` ∈ LOCAL | SSO; `roles` and `functions`
  are deduplicated codes; `functionDetails` are active screens sorted by `sortNo` then `id`,
  `routePattern` (nullable) is meant to render the menu; `functionScopes` is keyed by function code;
  `errors` is absent when there are no field errors.
- The dev toolbar's role switcher signs in through `loginDemo`; the profile screen shows
  unitName, groupName, roleName, scopeName and the granted menus, and saves through
  `updateProfile` / `changePassword` (mock only).

## Decisions

## DEC-001: Token in `localStorage`
- **Option:** 1C. The access token persists in `localStorage`, shared by every tab and kept after the browser closes.
- **Reason:** user's choice; no re-login on reload or new tab.
- **Consequence:** one token store service behind try/catch (storage can throw); XSS exposure accepted.

## DEC-002: Drop an expired token at boot, otherwise rely on 401
- **Option:** 2B. Store `expiresAt = now + expiresInSeconds` with the token; at boot an expired or missing token means anonymous without calling `/me`. Mid-use expiry stays on the existing 401 → `SessionExpiry` path. No refresh, no timer.
- **Consequence:** verification covers boot with a valid, expired and absent token.

## DEC-003: Bearer on every `/api/` request except login
- **Option:** 3A. An interceptor adds `Authorization: Bearer <token>` to `/api/...` requests while a token exists, decided before `apiBaseUrlInterceptor` adds the origin; the login endpoint is exempt by endpoint identity.
- **Consequence:** the token never goes to a non-API URL.

## DEC-004: Envelope unwrapped by the endpoint schema
- **Option:** 4A. An `envelope(DataSchema)` helper in `@lms/contracts` parses `BaseResponse` and transforms to `data`; `EndpointClient` is unchanged; fixtures of enveloped endpoints are wrapped.

## DEC-005: Backend error contract deferred
- **Option:** 5 deferred. `ApiErrorSchema` and the `toAppError` status map are not reworked in this feature; the goal is a successful login. The error contract will be agreed with the backend later.
- **Consequence:** out of scope: mapping 400 `errors[]` to field messages, `messageCode`, `responseId`.

## DEC-006: No permission mapping yet; menus stay mock
- **Option:** 6 deferred. `/me` roles/functions/scopes are not mapped to menus or guards in this feature; menus keep coming from mock data for now.
- **Consequence:** `menuGuard` and the sidebar are not driven by the backend; how the mock menus are supplied is open (round 2).

## DEC-007: Login by username or staff code, demo panel removed
- **Option:** 8A. The login form takes "Tên đăng nhập hoặc mã cán bộ" + password and posts `{ username, password }`; the demo-account block and the "try a locked account" shortcut are removed.

## DEC-008: Auth goes live, everything else stays mock
- **Option:** 9A. Development keeps the mock API for endpoints the backend lacks while login, logout and me hit the real backend.
- **Consequence:** the mechanism that selects live endpoints is open (round 2).

## DEC-009: Real user shown where the app already shows the user; no overview screen migration
- **Option:** 10A. Header, profile page and existing screens show the `/me` user; the overview screens stay placeholders.
- **Consequence:** migrating `/learn` or `/admin` is a separate feature.

## DEC-010: Every menu granted until permissions are mapped
- **Option:** R2-1A. The session grants every `MenuKey`, `homePath` is `/learn`, the displayed role is `roleGrants[0].roleName`; same in every environment.
- **Reason:** works without mocks in staging/production.
- **Consequence:** `TODO(backend)` to replace with a `functions` mapping; `menuGuard` never forbids for now.

## DEC-011: `Me` contract adapted to the existing `Profile`
- **Option:** R2-2A. A `Me` zod schema follows the backend; one `toProfile(me)` in the session maps it, so `Profile` consumers stay unchanged. Mapping: `id`, `staffCode` ← `user.userId`; `name` ← `fullName`; `email` ← `email ?? ''`; `unitName` ← `orgName`; `groupName` ← `teamName`; `title` ← `positionName`; `status` ← `status`; `scopeName` ← `roleGrants[0].scope.type` as a Vietnamese label; other fields defaulted.
- **Consequence:** `/api/auth/profile` is replaced by `/api/v1/auth/me` as the session source.

## DEC-012: Login error messages unchanged
- **Option:** R2-3B. The login screen keeps today's error handling; no login-specific messages in this feature.
- **Consequence:** a wrong password may show the generic 401 text; accepted until the error contract (DEC-005).

## DEC-013: Live auth through missing fixtures
- **Option:** R2-4A. The three `/api/v1/auth/*` endpoints get no entry in `MOCK_FIXTURES`, so `mockApiInterceptor` forwards them to the backend; development returns to `mockApi: true` (the uncommitted `mockApi: false` is reverted). Auth fixtures stay in `@lms/mocks` for tests.
- **Consequence:** signing in during development needs network access to the backend.

## DEC-014: Logout always clears locally
- **Option:** R2-5A. Token and session are cleared even when the logout call fails; other tabs learn through their next 401; copy unchanged.

## DEC-015: Profile edit and change password stay on mock
- **Option:** R2-6A. Both keep calling their mock endpoints; in staging they fail.

## DEC-016: Dev toolbar role switch changes mock data only
- **Option:** R2-7B. The role switcher sets `MockScenario.role$` for mock fixtures and no longer calls `signInDemo`; the signed-in user stays the real one.
- **Consequence:** `loginDemo` and `demoAccounts` lose their last callers (login page per DEC-007, toolbar here).

## DEC-017: `inactive` added to the account status
- **Option:** R3-1A. `AccountStatusSchema` gains `inactive` (neutral badge, label "Ngừng hoạt động"); `toProfile` passes the backend status through.

## DEC-018: Scope label from the first role grant
- **Option:** R3-2 as recommended. `scopeName`: GLOBAL → "Toàn hệ thống"; ORG → the user's `orgName`; TEAM → `teamName`; OWN → "Cá nhân"; no role grant → "—".

## DEC-019: Old auth endpoints replaced
- **Option:** R3-3A. Remove the old `login`, `logout`, `profile` and `loginDemo` endpoints in favour of the three v1 endpoints; keep `demoAccounts` mock-only for the dev toolbar role list (DEC-016) and `updateProfile` / `changePassword` (DEC-015). `sessionExpiryInterceptor` exempts the v1 `me` and `login`.

## DEC-020: A 401 on logout is not a session expiry
- **Option:** found while implementing ticket 03. `sessionExpiryInterceptor` also exempts the v1 `logout`, besides `me` and `login` (DEC-019).
- **Reason:** logout with an already revoked or expired token answers 401; without the exemption the user would see the "session expired" toast and a `/login?next=` redirect while logging out on purpose.
- **Consequence:** AC-005's exempt list is `login`, `me` and `logout`; the logout spec covers success, 401 and network failure (AC-006).

## Open questions

None. The user confirmed a shared understanding on 2026-10-17.
