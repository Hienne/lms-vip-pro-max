# Implementation Plan: `self-registration`

Spec: [SPEC-self-registration.md](../../SPEC-self-registration.md) (approved 2026-11-05, open questions on their
defaults). Map: [SPEC-auth-self-service.md](../../SPEC-auth-self-service.md). Tasks:
[todo-self-registration.md](todo-self-registration.md).

`plan.md` / `todo.md` in this folder still hold the `access-requests` plan with an open final checkpoint, so this
module has its own pair of files. Nothing in those two is touched.

## Overview

A public `/register` screen and two public endpoints create a `REGISTER` request; an admin approves it from the
"Yêu cầu" tab, which creates the account. No new table.

## Findings

- Built and reused: `access_requests` (has `password_hash`, `org_id`), `AccessRequestService.reject`,
  `AccessRequestThrottle` (unwired), `UserAdministrationService.create`, `PasswordPolicy`, the reject dialog, the
  tab and `AccessRequestsChanged`.
- `SecurityConfig` permits one public path today; this module adds `GET .../auth/registration-units` and
  `POST .../auth/register-request`.
- `screens.ts` `open` group holds `login` (`public`, `guestOnly`, `bare`); `register` is one more entry there.
- Branch: both repos continue on `feat/access-requests`; backend commits stay local (never push).

## Architecture decisions

1. Contract and mock first (R1, R2) so the screens are built and checked with `mockBackend` before the Java exists.
2. Backend public side (R3) and approve (R4) are separate: R3 is the security-sensitive part, R4 reuses the user
   creation rule and the scope check.
3. Approve creates the user by calling `UserAdministrationService`-level logic in the same transaction, not by a
   second HTTP hop; the stored hash is copied, never re-hashed.
4. Defaults for the open questions: public unit list, email required, `LEARNER`/`OWN`, username = staff code.

## Tasks

R1 contracts and endpoints · R2 mock · R3 backend public register + units + throttle wiring · R4 backend approve ·
R5 register screen and login link · R6 approve button and dialog · Checkpoint (live check, `npm run check`).
Dependencies: R2 ← R1; R3 ← R1; R4 ← R3; R5 ← R2; R6 ← R2. R3/R4 and R5/R6 can run in parallel.

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Public answer differs when a code exists | High | one fixed answer, a service test for the three cases |
| Plain or hashed password leaks (response, log, `toString`) | High | no field in any response schema, redacted `toString`, grep test over captured logs |
| Throttle bypass via spoofed forwarding headers | Medium | read the client IP the way the framework resolves it; do not trust `X-Forwarded-For` blindly (ask first if a proxy setting is needed) |
| Approve races a manual user create | Medium | re-check identifiers inside the transaction under the existing write lock |
