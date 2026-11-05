# Tasks: `self-registration`

Plan: [plan-self-registration.md](plan-self-registration.md) · Spec: [SPEC-self-registration.md](../../SPEC-self-registration.md)

## R1: Contracts and endpoints

- [x] `RegisterRequestCommandSchema` (strict, password rules, no echo), `RegistrationUnitSchema` (`orgId`, `name`
      only), `ApproveAccessRequestCommandSchema` (`note?` ≤500); endpoints `registrationUnits`, `registerRequest`,
      `approveAccessRequest` in `identityEndpoints`; the two public ones marked public.
- **Verify:** `npx nx test contracts` · **Deps:** none · **Size:** S

## R2: Mock API and fixtures (dropped: the user asked for the real backend API, no mock)

- [ ] `FakeBackend` answers the three endpoints: fixed register answer for new / waiting / existing code, throttle
      after 5 calls, approve creates the user with the learner grant and marks the row `APPROVED`; three units.
- **Verify:** `npx nx test mocks` · **Deps:** R1 · **Size:** M

## R3: Backend public register, units, throttle wiring

- [x] `GET /auth/registration-units`, `POST /auth/register-request` public in `SecurityConfig` (only these two);
      `RegistrationService` stores a `REGISTER` row with a hashed password, identical answer in all three cases,
      `AccessRequestThrottle` applied (429 + `Retry-After`), redacted `toString`, no password in logs.
- **Verify:** `mvn -o test -Dtest='Registration*'`; the whole suite stays green · **Deps:** R1 · **Size:** M

## R4: Backend approve

- [x] `POST /access-requests/{id}/approve`: scope check, re-check identifiers, create the `LOCAL` account with the
      stored hash and `mustChangePassword=false`, grant `LEARNER`/`OWN`, mark `APPROVED`, clear the hash, audit
      `ACCESS_REQUEST_APPROVE` + `USER_CREATED`; a clash leaves the row pending; reject also clears the hash.
- **Verify:** `mvn -o test -Dtest='AccessRequest*'`; whole suite · **Deps:** R3 · **Size:** M

## Checkpoint: Backend

- [x] Full backend suite green; live curl: register → listed → approve → sign in works, not before; commit locally

## R5: Register screen and login link

- [ ] `features/auth/register/` (form, store, component, spec), `register` entry in `screens.ts` (`public`,
      `guestOnly`, `bare`), "Chưa có tài khoản? Đăng ký" link on login; confirmation, 429 and error states.
- **Verify:** `npx nx test lms`; manual on the mock at 375 and 1280 px · **Deps:** R2 · **Size:** M

## R6: Approve button and dialog

- [ ] "Duyệt" on pending `REGISTER` rows, `ApproveRequestDialog` (note, duplicate refusal shown in the dialog),
      toast, count drops, `AccessRequestsChanged` bumped; `PASSWORD_RESET` rows unchanged.
- **Verify:** `npx nx test lms` · **Deps:** R2 · **Size:** S

## Checkpoint: Complete

- [ ] Spec success criteria 1 to 7 pass (local backend, then mock); `npm run check` green; §14 and visual-design
      checklists at 375/768/1280 px, light and dark, keyboard only
- [ ] Spec "Implementation notes (as built)" added; map status updated; review with the human
