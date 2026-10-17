---
artifact: spec
status: ready
workspace: lms-vip-pro-max
project: lms
source: .scratch/auth-api-integration/decisions.md
source_revision: 4
revision: 2
---

# Auth API integration: login, logout and auth/me against the real backend

## Problem

The app signs people in against the in-app mock: an email login, a cookie session assumed, and a
profile the mock computes. The backend ("CORE Academy API") now provides real authentication:
login by username or staff code returns a JWT, every other call must carry it as a bearer token,
`/me` returns the signed-in user, and logout revokes every token of the account. Until the app
uses these three endpoints, nobody can sign in with a real account and every screen shows mock
people.

## Desired behaviour

- A staff member signs in on the login page with their username or staff code and password. On
  success the app keeps the access token and its expiry, loads `/me`, says "Đăng nhập thành công"
  and goes to the page they asked for, else `/learn`.
- Every later backend call carries `Authorization: Bearer <token>`; nothing else does.
- Reloading the page or opening another tab keeps the user signed in while the token is valid
  (DEC-001). A token that has already expired is dropped at start-up and the visitor is treated
  as anonymous, without asking `/me` (DEC-002).
- When the backend answers 401 mid-use, the existing "session expired" flow runs: the user is
  told once and sent to `/login?next=<where they were>`; the stored token is gone.
- Logging out calls the backend and always ends the session in the app, even if that call fails
  (DEC-014). Because the backend revokes every token of the account, other tabs and devices are
  signed out at their next call.
- The header, the profile page and every screen that shows the signed-in user show the real
  person from `/me` (DEC-009, DEC-011). Until permissions are mapped, every menu is open to every
  signed-in user (DEC-010).
- Development keeps the mock API for everything the backend lacks; only the three auth calls go
  to the backend (DEC-008, DEC-013). The dev toolbar's role switcher changes which mock data the
  other screens show, not who is signed in (DEC-016).

## User stories

- As a staff member, I sign in with my username or staff code, so I use the LMS as myself.
- As a signed-in user, I stay signed in across reloads and tabs until my token expires.
- As a signed-in user, I log out and my session ends everywhere.
- As a developer, I sign in against the real backend while the screens the backend lacks still run on mock data.

## Decisions

DEC-001 to DEC-019 in `decisions.md` revision 4. Deferred there and out of scope here: the
backend error contract (DEC-005) and permission mapping (DEC-006).

## Observable acceptance criteria

- **AC-001:** The login form has a "Tên đăng nhập hoặc mã cán bộ" field and a password field and
  submits `{ username, password }` to `POST /api/v1/auth/login`; the demo-account block and the
  "try a locked account" shortcut are gone (DEC-007).
- **AC-002:** After a successful login the app stores the access token with
  `expiresAt = now + expiresInSeconds`, calls `GET /api/v1/auth/me` with the bearer header, shows
  "Đăng nhập thành công" and navigates to `next` or `/learn` (DEC-001, DEC-002, DEC-010).
- **AC-003:** Every request whose path starts with `/api/` carries `Authorization: Bearer <token>`
  while a token is stored, except the login request; requests outside `/api/` and requests made
  without a stored token carry no `Authorization` header (DEC-003).
- **AC-004:** At start-up a stored, unexpired token restores the user through `/me`; a missing or
  expired token leaves the visitor anonymous with no `/me` request, and an expired token is removed
  from storage (DEC-002).
- **AC-005:** A `/me` answering 401 at start-up leaves the visitor anonymous and removes the stored
  token; a non-exempt 401 while signed in runs the existing session-expired flow and removes the
  stored token. Login, `/me` and logout 401s do not trigger the session-expired flow (DEC-002, DEC-019, DEC-020).
- **AC-006:** Logout calls `POST /api/v1/auth/logout` with the bearer header, then removes the
  token and the user and leaves the visitor anonymous, whether the call succeeds or fails (DEC-014).
- **AC-007:** Enveloped responses are parsed with their envelope: the endpoint returns `data`; a
  body that does not match the envelope or its `data` schema is a contract error (DEC-004).
- **AC-008:** The signed-in user built from `/me` has: id and staff code from `user.userId`
  (leading zeros kept), name from `fullName`, email from `email` or empty, unit from `orgName`,
  group from `teamName`, title from `positionName`, status from `status`, role name from the first
  role grant, every menu key, and home `/learn` (DEC-010, DEC-011).
- **AC-009:** The data-scope label of the signed-in user reads "Toàn hệ thống" for GLOBAL, the
  user's `orgName` for ORG, `teamName` for TEAM, "Cá nhân" for OWN and "—" without a role grant
  (DEC-018).
- **AC-010:** The account status accepts `inactive`, rendered as a neutral badge labelled
  "Ngừng hoạt động" wherever an account status is rendered (DEC-017).
- **AC-011:** With the development mock on, login, logout and me go to the network while other
  endpoints are still answered by the mock; the development environment runs with the mock on
  (DEC-008, DEC-013).
- **AC-012:** The dev toolbar's role switcher sets the mock role and says so, without calling any
  login endpoint and without changing the signed-in user (DEC-016).
- **AC-013:** The old `/api/auth/login`, `/api/auth/logout`, `/api/auth/profile` and `loginDemo`
  endpoints no longer exist in the contracts; `demoAccounts`, `updateProfile` and `changePassword`
  remain, answered by the mock only (DEC-015, DEC-019).

## Contracts and state transitions

Enveloped responses (all three v1 endpoints), from `decisions.md` facts:

```ts
// BaseResponse<T>: parsed, then transformed to `data`
{ responseId: string; timestamp: string; status: 'SUCCESS' | 'ERROR';
  messageCode: string; message: string; messageTitle: string;
  data: T; errors?: { field: string; code: string; message: string }[] }
```

- `login`: `POST /api/v1/auth/login`, body `{ username: string; password: string }`, no bearer,
  data `{ accessToken: string; tokenType: string; expiresInSeconds: number }`.
- `logout`: `POST /api/v1/auth/logout`, bearer, data ignored (null).
- `me`: `GET /api/v1/auth/me`, bearer, data `MeResponse` as pasted by the backend team (nullable
  `email` and org/team/branch fields, `status` ∈ active | locked | inactive,
  `authProvider` ∈ LOCAL | SSO, `roleGrants[].scope.type` ∈ GLOBAL | ORG | TEAM | OWN).
- `AccountStatus` gains `inactive`.

Stored token: `{ accessToken, expiresAt }` in `localStorage`, read and written behind try/catch;
an unreadable or malformed entry counts as no token.

Session states:

```text
boot ── no token / expired ──────────────► anonymous (expired token removed)
boot ── valid token ─► /me ── 200 ───────► signed in
                         └─── 401 ───────► anonymous (token removed)
                         └─── other error ► error (retry re-runs restore)
anonymous ── login 200 ─► store token ─► /me 200 ─► signed in
signed in ── logout (any outcome) ───────► anonymous (token removed)
signed in ── non-exempt 401 ─────────────► anonymous via session-expired flow (token removed)
```

## Verification seams

- **Session store spec** (existing `session.store.spec.ts`, `HttpTestingController` +
  `@lms/mocks` fixtures): AC-002, AC-004, AC-005 (boot), AC-006, AC-008, AC-009. Storage is the
  injected storage token, faked in the spec.
- **Bearer interceptor spec**, following `api-base-url.interceptor.spec.ts`: AC-003.
- **Session-expiry interceptor spec** (existing): AC-005 (mid-use 401 removes the token, exempt
  list is v1 `login`, `me` and `logout`).
- **Contracts and fixtures specs** (existing `auth.endpoints.spec.ts`, `fixtures.spec.ts`): AC-007,
  AC-010 (schema), AC-013.
- **Component specs** (existing `login.spec.ts`, `dev-toolbar.spec.ts`, and the status badge's
  spec): AC-001, AC-010 (badge), AC-012.
- **Mock API interceptor spec** (existing): AC-011 (no fixture for the v1 auth endpoints → network).
- **Live check** in the running app against `http://103.121.90.119:8019`: the user signs in with a
  real account (the agent does not enter real credentials), then the agent checks the bearer header
  on `/me`, the header and profile showing the real user, reload, and logout (AC-001 to AC-006, AC-011).

## Constraints

- Follows `docs/conventions/angular.md` and `docs/conventions/contracts-and-mocks.md`; its "Auth
  contract decisions" and "In-app mock API" sections are updated to the bearer/v1 contract.
- Fixtures of the v1 endpoints live in `@lms/mocks` and parse with their schemas, but are not
  registered in `MOCK_FIXTURES`.
- Assumption: `Profile` fields `/me` lacks are defaulted for display: `roleId` from the first role
  grant's `roleCode` (else empty), `unitId`, `groupId` from `orgId`/`teamId` as strings (else
  empty), `scopeUnitId` null, `joinedAt` and `lastLoginAt` from `lastSyncTime` or null where the
  schema allows. These feed display only.
- Assumption: the bearer header is attached before `apiBaseUrlInterceptor` rewrites the URL, so
  the `/api/` test runs on the relative path.
- Assumption: login error display stays as today (DEC-012); a wrong password may show the
  generic 401 text.
- The uncommitted `mockApi: false` in the development environment is reverted.
- `npm run check` green, including the production bundle check.

## Out of scope

- Backend error contract: `messageCode`, `responseId`, 400 field errors mapping (DEC-005).
- Mapping `roles` / `functions` / `functionScopes` to menus, guards and scope (DEC-006).
- Refresh tokens, proactive logout timers, cross-tab `storage` sync (DEC-002, DEC-014).
- Migrating any overview screen (DEC-009).
- Real profile edit and change password endpoints (DEC-015).

## Open decisions

None
