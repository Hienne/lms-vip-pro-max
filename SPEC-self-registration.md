# Spec: `self-registration`

Map: [SPEC-auth-self-service.md](SPEC-auth-self-service.md). Depends on `access-requests`
([SPEC-access-requests.md](SPEC-access-requests.md), built): the table, the contract, the inbox tab, the reject
action and `AccessRequestThrottle`. Read `docs/conventions/angular.md`, `contracts-and-mocks.md`,
`visual-design.md` and `docs/migration/mockup-to-angular.md` first.

## Objective

A person without an account opens "Đăng ký" on the sign-in page, fills in staff code, full name, email, unit and
a password, and sends a request. An admin sees it in the "Yêu cầu" tab and approves it; the approval creates the
account, and only then can the person sign in. The visitor chose the password, so the account does not start with
`mustChangePassword`.

Users: visitors (anonymous); admins with `USER_MANAGEMENT`. No mockup page exists; the screens follow
`docs/conventions/visual-design.md`.

## What exists today

- Sign-in page `features/auth/login/` (route `login`, `public`, `guestOnly`, layout `bare`). No link to register.
- `access_requests` table and `AccessRequestService` (list, reject). `password_hash` and `org_id` columns are
  already there; the partial unique index allows one `PENDING` row per (`kind`, lower(`staff_code`)).
- `AccessRequestThrottle` (5 per IP / 10 min, 3 per (kind, staff code) / hour) is built and not wired to anything.
- `UserAdministrationService.create` builds an account (duplicate checks over `user_id` and `username`,
  `PasswordPolicy`, org check, audit `USER_CREATED`, optional initial grants).
- `SecurityConfig` permits only `POST /api/v1/auth/login` without a token.

## Behaviour

**Send a request (public).**

- Fields: `staffCode` (`[A-Za-z0-9._-]{1,20}`, kept as typed), `fullName` (max 255), `email` (valid, max 100),
  `orgId` (a unit from the list below), `password` and `confirmPassword` (`PasswordPolicy`, max 72 bytes).
- The username of the new account is the staff code, lower case. The requester picks no role.
- The answer is the same success message in every case: a new request, a request already waiting for that code,
  and a code that already belongs to an account. In the last two nothing is created. The page can therefore not be
  used to discover which codes exist. The message: "Yêu cầu đã được gửi. Quản trị viên sẽ xem xét; bạn sẽ đăng
  nhập được sau khi yêu cầu được duyệt."
- Throttled by `AccessRequestThrottle`; a refused call answers 429 with `Retry-After` and the page shows how long
  to wait.
- The password is hashed with the same encoder as accounts before it is stored; the plain text is never stored,
  logged or echoed.

**Units for the form (public).** `GET /api/v1/auth/registration-units` returns `[{ orgId, name }]` for active
`UNIT` orgs only (no tree, no codes, no departments). See Open question 1.

**Approve (admin).** `POST /api/v1/access-requests/{requestId}/approve`, body `{ note?: string }`, only a
`PENDING` `REGISTER` row inside the caller's unit scope (same rules as reject; a null-unit row is global admin
only, but a registration always has a unit).

- In one transaction: re-check that no account has this staff code or username (a clash answers
  `DUPLICATE_IDENTIFIER` and the row stays pending so the admin can reject it); create the `LOCAL` account from
  the row with the stored hash, `mustChangePassword = false`, status `active`; grant `LEARNER` with scope `OWN`;
  mark the row `APPROVED` with `resolved_by`, `resolved_time`, `resolution_note`; audit `ACCESS_REQUEST_APPROVE`
  and `USER_CREATED`. After approval `password_hash` is cleared on the row.
- Answers the new account's id. The sign-in page needs no change: the approved person signs in normally.

**Reject** is unchanged (built). Rejecting a registration also clears `password_hash`.

## Endpoints

| Key (registry)                           | Endpoint                                           | Auth   | Notes                                |
| ---------------------------------------- | -------------------------------------------------- | ------ | ------------------------------------ |
| `identityEndpoints.registrationUnits`    | `GET /api/v1/auth/registration-units`              | public | units for the form                   |
| `identityEndpoints.registerRequest`      | `POST /api/v1/auth/register-request`               | public | body above; answers the fixed result |
| `identityEndpoints.approveAccessRequest` | `POST /api/v1/access-requests/{requestId}/approve` | admin  | body `{ note?: string }`             |

`SecurityConfig` gains the two public paths (`GET` units, `POST` register-request) and nothing else. Responses are
parsed by zod schemas in `libs/contracts/src/lib/identity/`; the register command is strict and its `toString`
(Java) and any log line print no password.

## Screens

1. **Sign-in page.** Under the form a quiet text line "Chưa có tài khoản? Đăng ký" linking to `/register`.
2. **`/register`** (new public, guest-only, bare-layout route, `features/auth/register/`): the same split layout as
   the login page, a title "Đăng ký tài khoản", one short help line, the form with `ui-field`s (Mã cán bộ, Họ và
   tên, Email, Đơn vị as a `ui` select, Mật khẩu with the reveal button, Nhập lại mật khẩu), primary button "Gửi
   yêu cầu", and a link back "Đã có tài khoản? Đăng nhập". Signal Forms; field errors in Vietnamese. After success
   the form is replaced by the confirmation message and a link to sign in. A 429 shows a danger alert with the wait.
3. **Inbox row action.** For a pending `REGISTER` row the slot left empty by `access-requests` gets a primary
   "Duyệt" button, beside "Từ chối". It opens a dialog (summary of name, code, unit, optional note, confirm
   "Duyệt yêu cầu"); success toast "Đã duyệt yêu cầu", the row leaves the pending list, the tab count drops, and
   `AccessRequestsChanged` is bumped. A duplicate-identifier refusal shows its message in the dialog. `PASSWORD_RESET`
   rows keep only "Từ chối" until the sibling module lands.

```text
apps/lms/src/app/features/auth/register/
├── register.ts|html|scss|spec.ts
├── register.form.ts
└── data-access/register.store.ts (+ spec)          # units serverData + register serverMutation
apps/lms/src/app/features/admin-org/users/components/access-requests/
└── approve-request-dialog.ts                       # beside reject-request-dialog.ts
```

## Mock

`FakeBackend` answers the three endpoints. Register-request creates a `REGISTER` row (or nothing for a duplicate)
and always answers the fixed message; it throttles after 5 calls so the 429 state can be seen. Approve adds the
user to the seeded users, grants the learner role and marks the row `APPROVED`. The password hash is a placeholder
string, never the typed password. Fixtures: three units.

## Commands

```bash
nvm use
npm start                                    # app on :4200 (set mockBackend: true locally to use the seeded mock; never commit it)
npx nx test lms | contracts | mocks
npm run check                                # see AGENTS.md before running it
```

Backend (`~/my-projects/corebanking-academy`, local only, never `103.121.90.119`):

```bash
set -a; . ./.env.local; set +a
mvn -o test -Dtest='AccessRequest*,Registration*'
mvn -o spring-boot:run                       # port 8019
```

No new table, so there is no upgrade script; if a column turns out to be needed it comes with an upgrade and a
rollback script, as before.

## Project structure

| Where                                                                   | What                                                                                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `libs/contracts/src/lib/identity/`                                      | register command, units response, approve command, endpoints                                         |
| `libs/mocks/`                                                           | handlers and fixtures                                                                                |
| `apps/lms/src/app/features/auth/{login,register}/`                      | link on login, the register screen                                                                   |
| `apps/lms/src/app/core/routing/screens.ts`                              | `register` entry in `open` (public, guestOnly, bare)                                                 |
| `apps/lms/src/app/features/admin-org/users/components/access-requests/` | approve button and dialog                                                                            |
| `corebanking-academy/.../identity/{controller,service,dto}`             | `RegistrationController`, `RegistrationService`, approve in `AccessRequestService`, `SecurityConfig` |

## Code style

As `angular.md` and the earlier modules: standalone zoneless components, signals, `$`-suffixed selectors, tokens
only, Vietnamese copy, English code. The register form reuses the login page's classes for the card and fields
instead of new ones where it can.

## Testing

- `libs/contracts`: registry rows; the register command is strict, rejects mismatched passwords at the form level
  and accepts exactly the fields above; the units response carries only `orgId` and `name`.
- `register.store.spec.ts`: loads units; submit success shows the fixed message; 429 surfaces the wait; a refused
  business answer shows a danger alert.
- `register.spec.ts`: validation messages (code pattern, email, password policy, mismatch), reveal button,
  submit disabled while busy, confirmation view, link back to sign-in, keyboard path.
- `login.spec.ts`: the "Đăng ký" link exists and goes to `/register`.
- Approve: dialog specs (note, duplicate refusal); the row leaves the pending list and the count drops.
- Backend: service tests for the identical answer in the three cases, throttle wiring (6th call from one IP is
  429), hash stored and never returned or logged, approve creates the account with the learner grant and
  `mustChangePassword = false`, a staff-code clash leaves the row pending, out-of-scope approve is not-found,
  approving a resolved row is a state conflict; the public paths need no token and every other path still does.
  Live check on the local backend with curl, including that a new account can sign in.

## Boundaries

- Always: answer the register request identically whether or not the code exists; hash before storing; clear the
  hash when the row is resolved; scope approve by the caller's unit on the server; audit the approval.
- Ask first: new dependencies; adding more public paths; changing `PasswordPolicy`; a role other than
  `LEARNER`/`OWN` on approval; touching the user list or the editor.
- Never: touch the shared backend; return, log or keep a plain password; reveal in any public answer whether a
  code exists; commit a `mockBackend: true` change made for a browser check; send mail.

## Success criteria

1. On the local backend a visitor sends a request from `/register`; it appears in the "Yêu cầu" tab of a global
   admin and of the admin of that unit only; the count rises by one.
2. Sending again for the same code, and sending for a code that already has an account, show the same message and
   create nothing new.
3. "Duyệt" creates the account; the person signs in with the password they chose and is not asked to change it;
   they hold the learner role with `OWN` scope; the audit log shows both entries.
4. Before approval, signing in with those credentials fails as for any unknown account.
5. The 6th request from one IP inside 10 minutes answers 429 and the page tells the wait; no response, log line or
   `toString` carries a password or its hash.
6. Rejecting a registration still works and clears the hash.
7. Mock (`mockBackend: true`): the same flow.
8. `npm run check` green; the `angular.md` §14 and visual-design checklists pass at 375, 768 and 1280 px, light
   and dark, keyboard only. Reported with what was run and how.

## Open questions

1. **Public unit list.** The form needs the unit names, which a visitor can then read. Options: this public
   endpoint (default), a free-text unit that the admin maps on approval, or no unit at all with the admin choosing
   one on approval. The default exposes unit names only.
2. **Email.** Required in this spec. The email is stored but never verified or mailed; make it optional?
3. **Role on approval.** Default `LEARNER` with `OWN` scope, as the map's assumption 1 says. Should the approving
   admin be able to pick a role instead?
4. **Username.** Equal to the staff code, lower case. Acceptable, or should the visitor choose one?

## Implementation notes (as built)

Built in R1, R3 to R6 on branch `feat/access-requests` in both repos (backend commits `c1744ab`, `5d52e3a`; not
pushed). R2 (mock) was dropped on the user's instruction: the screens call the real backend API.

- **No mock handlers.** The register, units and approve endpoints are not in `FakeBackend`; with the default
  config they go to the backend (`LMS_API_TARGET=http://localhost:8019 npm start`, the `lms-local-backend` launch
  entry). The approve dialog spec stands in for the backend with a canned reply.
- **Contracts** in `identity/access-request.schema.ts`; the public calls are exempt from the bearer token and the
  session-expiry handler.
- **Backend:** `RegistrationController` / `RegistrationService` (public, throttled, same answer in every case,
  not transactional so a lost race on the pending index is answered like a duplicate), `approve` in
  `AccessRequestService` (creates the account, copies the stored hash, `LEARNER`/`OWN` written directly, three audit
  rows). The table was already in place, so there is no upgrade script. A rejected or approved request has its
  hash cleared.
- **Page:** a single centred card (the pattern of the change-password page), not the sign-in page's split layout.
  A throttled request shows the backend's message in an alert; the wait from `Retry-After` is not shown (`AppError`
  does not carry headers).
- **Approve refusal** (code taken meanwhile) shows as an error toast, not inside the dialog.
- **Verified live** (local backend on 8019, `lms-local-backend`): units list; register; a repeated request and an
  existing code answer identically; bad unit refused; login fails before approval; the inbox lists the request with no
  password or hash in the body; approve creates the account with the `LEARNER` `OWN` grant and three audit rows; a
  second approve answers `CORE-STATE_CONFLICT`; the new user signs in with the chosen password and is not asked to
  change it; the sixth call from one IP answers 429 with `Retry-After`. In the browser: the whole flow from `/register`
  to the learner home, the 429 alert, and `/register` at 375 px in dark mode with no horizontal scroll.
- **Not verified:** a unit admin approving from the UI (the scope rule is service-tested and was curl-checked for
  reject); keyboard-only pass and 768 px; light/dark at 1280 px on the approve dialog.
- **Throttle IP:** the controller uses `getRemoteAddr()`. Behind a proxy that is the proxy's address, so every
  visitor would share one bucket. Forwarded headers were not trusted; configuring the proxy chain needs your decision.
- Open questions 1 to 4 kept their defaults (public unit list, email required, `LEARNER`/`OWN`, username = code).
