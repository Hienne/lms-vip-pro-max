# Implementation Plan: `access-requests`

Spec: [SPEC-access-requests.md](../../SPEC-access-requests.md) (approved 2026-11-05). Map:
[SPEC-auth-self-service.md](../../SPEC-auth-self-service.md). Tasks: [todo.md](todo.md).

This plan lives in `tasks/auth-self-service/` because `tasks/plan.md` and `tasks/todo.md` still hold the UX Wave 1
plan. Nothing in those two files is touched. `/build` for this work points at this folder.

## Overview

One shared module: the `access_requests` table, a list and a reject endpoint, a throttle, and the "Yêu cầu" tab on
the Người dùng screen. `self-registration` and `password-reset-request` add their public forms and approve / resolve
actions later, each with its own spec and plan.

## Findings from the codebase

- **Contracts:** `libs/contracts/src/lib/admin-org/admin-org.{schema,endpoints}.ts` and its endpoints spec hold the
  admin endpoints, so the new schemas and the two endpoints go there (the spec allowed `identity/` or `admin-org/`).
- **Mocks:** `libs/mocks/src/lib/admin-org/admin-org.fixtures.ts` plus the admin-org backend branch.
- **Frontend:** `features/admin-org/users/` has `users.{ts,html,scss,spec.ts}` and `data-access/users.store.ts`.
  `core/` has no `admin/` folder yet; the invalidation token goes in `core/admin/access-requests-changed.ts`.
- **UI:** `libs/ui` already has `tabs`, `data-table`, `search`, `select`; no new primitive is needed.
- **Backend:** package `vn.com.coreacademy.identity` has `controller`, `service`, `repository`, `entity`, `dto`.
  `UserAdministrationService` and `IdentityAccessPolicy` already hold the unit-scope rule for the user list; the
  request service reuses them rather than copying the rule. Upgrade scripts sit in `docs/sql/upgrade/`.
- **Branch:** backend work goes on a branch cut from `corebanking-academy` `main`, as D0 of the Wave 2 spec does.
  The app work goes on its own branch from `main`.
- **Overlap:** `SPEC-ux-wave2.md` (`users-admin`) also edits the Người dùng screen. This plan lands first and only
  adds the tab; it does not touch the user list panel. `users-admin` rebases after.

## Architecture decisions

1. **Contract first.** Tasks 1 and 2 (schemas, mock) let the frontend be built and verified with `mockBackend`
   before the backend exists, so the UI tasks do not wait on Java.
2. **Backend and app are independent after Task 1.** Tasks 3 to 5 (backend) and Tasks 6 to 9 (app) can be built in
   parallel sessions once the contract is merged; they meet at the integration checkpoint.
3. **Tab, not route.** `?tab=requests` on the existing route and guard; no new `screens.ts` entry.
4. **Throttle is a backend component with no endpoint**, built here so the siblings only call it.
5. **Open questions take the spec defaults** until the user answers: in-memory throttle, null-unit requests for
   global admins only, resolved rows kept, count by `size=1` call.

## Task list

### Phase 1: Contract and mock

- [ ] T1: Contract schemas and endpoints
- [ ] T2: Mock API and fixtures

### Checkpoint: Contract

- [ ] `npx nx test contracts mocks` green; reviewed with the human

### Phase 2: Backend (can run in parallel with Phase 3)

- [ ] T3: Upgrade and rollback scripts, entity, repository
- [ ] T4: List and reject endpoints with scope
- [ ] T5: Throttle component

### Checkpoint: Backend

- [ ] `./mvnw test` and the integration test green; upgrade and rollback applied on the local database

### Phase 3: Tab in the app

- [ ] T6: Store and invalidation token
- [ ] T7: Tab strip on Người dùng
- [ ] T8: Requests table, filters, empty / error states
- [ ] T9: Reject dialog

### Checkpoint: Complete

- [ ] End to end on the local backend, then on the mock; `npm run check` green; visual-design checklist

## Risks and mitigations

| Risk                                                              | Impact | Mitigation                                                                                           |
| ----------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Unit-scope rule is not reusable as is from `IdentityAccessPolicy` | Med    | Read it in T4 first; extract a small shared method instead of copying, and say so in the task report |
| Users page split causes churn with `users-admin`                  | Med    | T7 only wraps the existing content in a tab panel; no edit to its store or template body             |
| In-memory throttle is wrong on several nodes                      | Low    | Open question 1; documented, upgradeable to a table                                                  |
| Local backend stack not running                                   | Med    | Follow `SPEC-local-stack.md`; fall back to the mock for the app tasks                                |
| Password hash leaking via logs or DTO `toString`                  | High   | T3 entity excludes it from `toString`; T4 integration test asserts no body or log carries it         |

## Open questions (spec defaults apply until answered)

1. Single-node backend? 2. Null-unit requests visible to unit admins? 3. Retention of resolved rows? 4. Cheaper
   count endpoint?
