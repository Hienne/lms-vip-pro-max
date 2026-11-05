# Spec: `password-reset-request`

Map: [SPEC-auth-self-service.md](SPEC-auth-self-service.md). Builds on `access-requests`
([SPEC-access-requests.md](SPEC-access-requests.md)) and follows the shape of `self-registration`
([SPEC-self-registration.md](SPEC-self-registration.md)): same table, same inbox, same throttle, no mock. Read
`docs/conventions/angular.md`, `contracts-and-mocks.md` and `visual-design.md` first.

## Objective

A person who forgot the password opens "Quên mật khẩu?" on the sign-in page and sends their staff code. An admin
sees the request in the "Yêu cầu" tab and resets the password: the server makes a temporary password, shows it to
the admin once, and the user must change it at the next sign-in (the existing `mustChangePassword` flow). Nothing
is sent by mail; the admin passes the temporary password on by their own means.

Users: visitors (anonymous); admins with `USER_MANAGEMENT`. No mockup exists; the screens follow
`docs/conventions/visual-design.md`.

## What exists today

- `access_requests` rows of kind `PASSWORD_RESET` are already modelled: `target_user_id` (the matched account, null
  when none) and `org_id` (the account's unit); the inbox lists them, flags "Không tìm thấy tài khoản" and can
  reject them. The partial unique index allows one pending row per (kind, lower code).
- `AccessRequestThrottle` takes the kind; `RegistrationService` is the pattern for a public, same-answer endpoint.
- `UserAccount` has `mustChangePassword`, `authorizationVersion` (bumping it revokes the account's tokens),
  `authProvider` (`LOCAL` / `SSO`) and `status`. `IdentityAccessPolicy.manageableUser` already applies unit scope and
  protects super-admins. No admin password reset exists.
- The forced change screen (`/change-password`) and the login redirect for `mustChangePassword` are built.

## Behaviour

**Send a request (public).**

- One field: `staffCode` (`[A-Za-z0-9._-]{1,20}`). Nothing else is asked.
- The answer is one fixed message in every case: an account matched, no account matched, a request already
  waiting. "Yêu cầu đã được gửi. Quản trị viên sẽ xem xét; nếu mã cán bộ hợp lệ, bạn sẽ được cấp mật khẩu tạm."
- The server looks the code up by staff code or username, ignoring case. A match stores a pending row with
  `target_user_id` and the account's `org_id`; no match stores a row with both null (the admin can only reject it).
  A waiting request for the same code stores nothing. A lost race on the pending index is answered like a duplicate.
- Throttled by `AccessRequestThrottle` with kind `PASSWORD_RESET` (429, `Retry-After`).
- No password is involved, so nothing sensitive is stored.

**Reset (admin).** `POST /api/v1/access-requests/{requestId}/reset-password`, body `{ note?: string }`, only a
`PENDING` `PASSWORD_RESET` row whose `target_user_id` is set, inside the caller's unit scope (same
not-found-outside-scope rule as reject and approve), and only for an account the caller may manage
(`manageableUser`, which also keeps a unit admin away from admin accounts).

- One transaction: the account must be `LOCAL` and `active` (`SSO`, `inactive` or `locked` answers a business
  refusal with a Vietnamese message; the admin can reject the request or fix the account first); generate a
  temporary password (12 characters from a set without look-alikes, passing `PasswordPolicy`, from `SecureRandom`);
  store its hash; set `mustChangePassword = true`; bump `authorizationVersion` so open sessions end; mark the row
  `APPROVED` with `resolved_by`, `resolved_time`, `resolution_note`; audit `ACCESS_REQUEST_RESET_PASSWORD` and
  `USER_PASSWORD_RESET` (neither carries the password).
- Answers `{ request, temporaryPassword }` once, with `Cache-Control: no-store`. The password is never stored in
  plain text, never logged, never part of any other response, and cannot be read again; to get another, the user
  sends a new request.

**Reject** is unchanged.

## Endpoints

| Key (registry)                              | Endpoint                                                  | Auth   | Notes                                     |
| ------------------------------------------- | --------------------------------------------------------- | ------ | ----------------------------------------- |
| `identityEndpoints.passwordResetRequest`    | `POST /api/v1/auth/password-reset-request`                | public | body `{ staffCode }`, fixed answer        |
| `identityEndpoints.resetPasswordForRequest` | `POST /api/v1/access-requests/{requestId}/reset-password` | admin  | body `{ note?: string }`; one-time secret |

`SecurityConfig` gains the one public path (`POST`) and nothing else. Zod: `PasswordResetRequestCommandSchema`
(strict, `staffCode` only), `PasswordResetRequestResultSchema` (`message`), `ResetPasswordResultSchema`
(`request: AccessRequest`, `temporaryPassword: string`). The Java request/result records print no secret in
`toString`.

## Screens

1. **Sign-in page:** next to the password field, a quiet link "Quên mật khẩu?" to `/forgot-password`.
2. **`/forgot-password`** (public, guest-only, bare layout, `features/auth/forgot-password/`): a centred card like
   `/register`: title "Quên mật khẩu", one help line ("Nhập mã cán bộ. Quản trị viên sẽ cấp mật khẩu tạm cho bạn."),
   field "Mã cán bộ", button "Gửi yêu cầu", link back to sign-in. After success the form is replaced by the fixed
   message and a link to sign in. A 429 shows a danger alert with the backend message.
3. **Inbox row action:** a pending `PASSWORD_RESET` row with an account found gets a primary "Đặt lại mật khẩu"
   button beside "Từ chối". It opens a confirm dialog (account name and code, what happens: "Mật khẩu tạm được tạo,
   phiên đăng nhập hiện tại của người này sẽ kết thúc, người này phải đổi mật khẩu khi đăng nhập", optional note,
   confirm "Đặt lại mật khẩu"). On success the dialog turns into a result view: the temporary password in a read-only
   monospace field with "Hiện/Ẩn" and "Sao chép" buttons, the line "Chỉ hiển thị một lần. Hãy gửi cho người dùng bằng
   kênh riêng." and a single "Xong" button. Closing it (Xong, Escape, backdrop) forgets the password; the list reloads,
   the count drops. A refusal (SSO, locked, out of scope, already resolved) shows its message in an alert inside the
   dialog and keeps the row. A row with no matching account keeps only "Từ chối".

```text
apps/lms/src/app/features/auth/forgot-password/
├── forgot-password.ts|html|scss|spec.ts
├── forgot-password.form.ts
└── data-access/forgot-password.store.ts (+ spec)
apps/lms/src/app/features/admin-org/users/components/access-requests/
└── reset-password-dialog.ts|scss (+ spec in access-requests.spec.ts)
```

The temporary password lives only in the dialog's own signal; it is not put in a store, the URL, the clipboard
automatically, local storage or any log, and the dialog component drops it on destroy.

## No mock

As in `self-registration`: the screens call the real backend (`LMS_API_TARGET=http://localhost:8019 npm start`, the
`lms-local-backend` launch entry). `FakeBackend` gets no handler; the two endpoints join the backend-only list in
`libs/mocks/src/fixtures.spec.ts`. The reset dialog spec stands in for the backend with a canned reply.

## Commands

```bash
nvm use
LMS_API_TARGET=http://localhost:8019 npm start     # app on :4200 against the local backend
npx nx test lms | contracts | mocks
npm run check                                      # see AGENTS.md before running it
```

Backend (`~/my-projects/corebanking-academy`, local only, never `103.121.90.119`; start Docker and the
`core-academy-local-db-1` container first):

```bash
set -a; . ./.env.local; set +a
mvn -o test
mvn -o spring-boot:run                             # port 8019
```

No new table, so no upgrade script.

## Project structure

| Where                                                              | What                                                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `libs/contracts/src/lib/identity/`                                 | the two commands, the results, the endpoints                                                          |
| `apps/lms/src/app/features/auth/{login,forgot-password}/`          | link on login, the forgot-password screen                                                             |
| `apps/lms/src/app/core/routing/screens.ts`, `core/http/*`          | `forgot-password` route (public, guest-only, bare); public call exempt from bearer and session expiry |
| `apps/lms/.../design-system/data-access/migration-entries.data.ts` | `route-forgot-password` entry (`todo`, no mockup)                                                     |
| `apps/lms/.../users/components/access-requests/`                   | reset button and dialog                                                                               |
| `corebanking-academy/.../identity/{controller,service,dto}`        | `PasswordResetRequestService` (public), `resetPassword` in `AccessRequestService`, `SecurityConfig`   |

## Code style

As the earlier modules: standalone zoneless components, signals, `$`-suffixed selectors, tokens only, Vietnamese
copy, English code. The forgot-password page reuses the register page's card classes by copying its small SCSS,
not by sharing a component.

## Testing

- `libs/contracts`: registry rows; the command is strict (rejects extra fields); the result requires a string
  password; an `AccessRequest` row still rejects a `temporaryPassword` field.
- `forgot-password.spec.ts`: validation, the request body, the confirmation view, the 429 alert, the link back;
  `login.spec.ts`: the link exists.
- Reset dialog (in `access-requests.spec.ts`): confirm text, success view shows the password once with reveal and
  copy, closing clears it (the text is gone from the DOM), refusal shown inside the dialog, rows without a matched
  account have no reset button, `Từ chối` still works.
- Backend: service tests for the same fixed answer in all cases (matched, unknown, waiting, race), the stored row
  (matched target and unit; unknown with nulls), throttle wiring with kind `PASSWORD_RESET`; reset creates a
  policy-valid, never repeated password (statistical check over many runs), stores only its hash, sets
  `mustChangePassword`, bumps `authorizationVersion`, resolves the row, audits without the password, refuses SSO /
  inactive / locked, refuses an account the caller may not manage, out-of-scope is not-found, a second reset is a
  state conflict; the response carries `no-store`; no log line contains the password (log capture test).
- Live check on the local backend with curl and in the browser: request → inbox → reset → sign in with the temporary
  password → forced change → sign in with the new one; the old session of that user is rejected.

## Boundaries

- Always: answer the request identically whether or not the code exists; generate the password with
  `SecureRandom`; store only a hash; show the password once with `no-store`; end the account's sessions; audit
  without the password; scope the action by the caller's unit and by `manageableUser`.
- Ask first: new dependencies; a second public path; changing `PasswordPolicy`; letting the admin type the
  password; sending the password by any channel from the server; touching the user list or editor.
- Never: touch the shared backend; return, log or keep a plain password; reveal in a public answer whether a code
  exists; put the password in a URL, storage, a toast or an audit row; commit a `mockBackend: true` change; send mail.

## Success criteria

1. On the local backend a visitor sends a request from `/forgot-password`; it shows in the inbox of a global admin and
   of the admin of that account's unit only, flagged with the account found; an unknown code is stored with no
   account, answered identically, and shows "Không tìm thấy tài khoản" with only "Từ chối".
2. Sending again for the same code answers the same and creates nothing new.
3. "Đặt lại mật khẩu" shows a temporary password once; the user signs in with it and is sent to the forced change;
   after the change the old temporary password fails; a session open before the reset is rejected.
4. An SSO, locked or inactive account refuses the reset with a clear message and the request stays pending.
5. The sixth request from one IP in 10 minutes answers 429 and the page shows the alert; no response other than the
   one reset answer, no log line and no audit row carries a password or its hash.
6. Rejecting still works.
7. `npm run check` green; the `angular.md` §14 and visual-design checklists pass at 375, 768 and 1280 px, light and
   dark, keyboard only. Reported with what was run and how.

## Open questions

1. **Who chooses the password.** Default: the server generates it. Alternative: the admin types one (more control,
   a human-chosen weak password). Which?
2. **How the user is told.** Default: the admin passes it on by their own means (phone, chat). The request carries no
   contact; ask for an optional email or phone on the form so the admin knows where to send it?
3. **SSO accounts.** Default: the reset is refused with a message (their password is not ours). Should the inbox
   hide the button for them instead of refusing after the click? That needs an `authProvider` field on the row.
4. **Locked accounts.** Default: refused until an admin reactivates the account. Should a reset on a locked account
   also unlock it?
5. **Wait time on a 429.** The page shows the backend message only, because `AppError` carries no headers. Add the
   `Retry-After` seconds to `AppError` so both public pages can say how long to wait? (Touches shared error code.)
6. **Throttle behind a proxy.** Carried over from `self-registration`: `getRemoteAddr()` is the proxy's address if the
   backend sits behind one.

## Implementation notes (as built)

- **No mock handlers.** Both endpoints go to the backend; the page and dialog specs stand in for it with canned replies.
- **Contracts** in `identity/access-request.schema.ts`; `passwordResetRequest` is exempt from the bearer token and the
  session-expiry handler.
- **Backend:** `PasswordResetRequestService` (public, throttled with kind `PASSWORD_RESET`, same answer for a matched
  code, an unknown code, a waiting request and a lost race; a match stores the account and its unit), and
  `resetPassword` in `AccessRequestService` (12-character `SecureRandom` password from an alphabet without look-alike
  characters, hash only, `mustChangePassword`, `authorizationVersion` bumped, row approved, two audit rows with no
  password). The endpoint answers `Cache-Control: no-store`. A resolved, non-reset, target-less, SSO, locked or inactive
  case answers `CORE-STATE_CONFLICT`; out of scope answers not found.
- **Screens:** `/forgot-password` is a single centred card like `/register`; the sign-in page links to it. The inbox
  shows "Đặt lại mật khẩu" on pending resets whose account was found. The dialog has a confirm view and a one-time
  result view (masked, reveal, copy, "Xong"); the store clears the password when the dialog is destroyed by any route.
  A refusal shows as an alert inside the dialog.
- **Verified live** (local backend 8019, `lms-local-backend`): the three answers are identical; the inbox shows the
  matched row with `accountFound` true and the unknown one false; reset returns a 12-character password with
  `no-store`; a second reset and a reset of the unknown row answer `STATE_CONFLICT`; the learner's old token gets 401,
  the old password is refused and the temporary one signs in, with `must_change_password` true; the audit rows and the
  backend log hold no password. In the browser: `/forgot-password` submit, then the admin inbox reset, masked field,
  "Xong" closes it and the password is absent from the DOM. Test rows were removed and the demo account restored.
- **Checks:** backend 444 tests green; `lint typecheck test build check-bundle` green on all four projects.
- **Not verified:** the forced change on the temporary password's first sign-in in the browser, a unit admin using the
  button, keyboard-only use, 375 and 768 px widths, light mode. Same throttle-IP caveat as registration.
