# Implementation Plan: `password-reset-request`

Spec: [SPEC-password-reset-request.md](../../SPEC-password-reset-request.md) (approved 2026-11-05, open questions
on their defaults). Map: [SPEC-auth-self-service.md](../../SPEC-auth-self-service.md). Tasks:
[todo-password-reset-request.md](todo-password-reset-request.md).

Own pair of files, like `self-registration`; `plan.md`, `todo.md` and the self-registration pair are not touched.

## Overview

A public `/forgot-password` screen and one public endpoint create a `PASSWORD_RESET` request; an admin resets the
password from the "Yêu cầu" tab, which returns a one-time temporary password. No new table, no mock.

## Findings

- Reused as built: `access_requests` (`target_user_id`, `org_id`), `AccessRequestService` (reject, approve),
  `AccessRequestThrottle` (kind-aware), `RegistrationService` as the pattern for a same-answer public endpoint,
  `IdentityAccessPolicy.manageableUser`, `PasswordPolicy`, `PasswordEncoder`, `IdentityAuditService`, the inbox table,
  the dialog pattern, `AccessRequestsChanged`.
- The register page is the pattern for the public screen; public calls are exempt in `bearer.interceptor.ts` and
  `session-expiry.interceptor.ts`; a new route needs a `screens.ts` entry, `route-table.spec.ts` and
  `migration-entries.data.ts` (`todo`, no mockup) entries; the new endpoints join the backend-only list in
  `libs/mocks/src/fixtures.spec.ts`.
- Branch: both repos stay on `feat/access-requests`; backend commits stay local, never pushed.

## Architecture decisions

1. Contracts first (P1), then the backend (P2, P3), then the screens (P4, P5): with no mock the screens are built
   and checked against the local backend.
2. The temporary password is generated server-side and returned once with `Cache-Control: no-store`; the client keeps
   it only in the dialog's own signal.
3. The reset is one transaction with the row resolution and the audit, under the same write lock as approve.
4. Defaults for the open questions: server-generated password, no contact field, SSO refused after the click, a
   locked account refused, no `Retry-After` in `AppError`.

## Tasks

P1 contracts · P2 backend public request · P3 backend reset · Checkpoint (backend suite, live curl) · P4 forgot-password
screen and login link · P5 reset button and dialog · Final checkpoint (live in the browser, `npm run check`, docs).
Dependencies: P2 ← P1; P3 ← P2; P4 ← P1 (needs the backend from P2 to check); P5 ← P3.

## Risks

| Risk                                                                      | Impact | Mitigation                                                                                                  |
| ------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| The temporary password leaks (log, audit, second response, cache)         | High   | `no-store`, redacted `toString`, audit without it, a log-capture test, a test that no other response has it |
| A weak or repeated password                                               | High   | `SecureRandom`, a look-alike-free alphabet, a policy check and a many-runs uniqueness test                  |
| The public answer differs when the code exists                            | High   | one fixed answer, a service test for the four cases                                                         |
| A reset of an account the admin must not manage (super-admin, other unit) | High   | `manageableUser`, a not-found outside scope, tests for both                                                 |
| Old sessions stay valid after a reset                                     | Medium | bump `authorizationVersion`, a live check that the old token is rejected                                    |
