# Tasks: `password-reset-request`

Plan: [plan-password-reset-request.md](plan-password-reset-request.md) · Spec: [SPEC-password-reset-request.md](../../SPEC-password-reset-request.md)

## P1: Contracts and endpoints

- [x] `PasswordResetRequestCommandSchema` (strict, `staffCode` only), `PasswordResetRequestResultSchema`,
      `ResetPasswordResultSchema` (`request`, `temporaryPassword`); endpoints `passwordResetRequest` (public) and
      `resetPasswordForRequest`; schema and registry specs; the two endpoints added to the backend-only list in
      `libs/mocks/src/fixtures.spec.ts`.
- **Verify:** `npx nx test contracts mocks` · **Deps:** none · **Size:** S

## P2: Backend public request

- [ ] `POST /api/v1/auth/password-reset-request` public in `SecurityConfig` (this one path); `PasswordResetRequestService`
      stores a row (matched: target and unit; unknown: nulls; waiting: nothing), the same answer in all cases, race on the
      index handled, throttle with kind `PASSWORD_RESET`.
- **Verify:** `mvn -o test -Dtest='PasswordResetRequest*'`; whole suite · **Deps:** P1 · **Size:** M

## P3: Backend reset

- [ ] `POST /access-requests/{id}/reset-password`: scope, `manageableUser`, LOCAL and active only, generated policy-valid
      password, hash stored, `mustChangePassword`, `authorizationVersion` bumped, row `APPROVED`, audit without the
      password, `no-store`, one-time result; refusals for SSO / inactive / locked / resolved / other kind / no target.
- **Verify:** `mvn -o test -Dtest='AccessRequest*,PasswordReset*'`; whole suite; log-capture and uniqueness tests · **Deps:** P2 · **Size:** M

## Checkpoint: Backend

- [ ] Full backend suite green; live curl: request → listed → reset → sign in with the temporary password → forced
      change; the old token is rejected; commit locally

## P4: Forgot-password screen and login link

- [ ] `features/auth/forgot-password/` (form, store, component, spec), route in `screens.ts`, route-table and migration
      registry entries, public call exempt from bearer / session expiry, "Quên mật khẩu?" link on login.
- **Verify:** `npx nx test lms`; manual at 375 and 1280 px against the local backend · **Deps:** P1 · **Size:** M

## P5: Reset button and dialog

- [ ] "Đặt lại mật khẩu" on pending reset rows with an account found; dialog with confirm, then the one-time result view
      (reveal, copy, "Xong"); the password is gone from the DOM after closing; refusals shown in the dialog.
- **Verify:** `npx nx test lms` · **Deps:** P3 · **Size:** M

## Checkpoint: Complete

- [ ] Spec success criteria 1 to 6 pass live in the browser; `npm run check` green; §14 and visual-design checklists at
      375/768/1280 px, light and dark, keyboard only
- [ ] Spec "Implementation notes (as built)" added; map status updated; review with the human
