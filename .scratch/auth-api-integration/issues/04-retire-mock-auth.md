---
artifact: ticket
status: done
workspace: lms-vip-pro-max
project: lms
source: .scratch/auth-api-integration/spec.md
source_revision: 2
revision: 3
---

# 04: Dev toolbar switches mock data only; retire the old auth endpoints

## What to build

The dev toolbar's role switcher sets the mock role and says so, without signing anyone in; the
signed-in user stays the real one. With no callers left, remove the old login, logout, profile
and demo-login endpoints, their fixtures and examples; keep demo accounts (the toolbar's role
list), profile update and change password on the mock. Update the auth and mock API sections of
the contracts-and-mocks convention to the bearer and v1 contract.

## Source acceptance criteria

- AC-012
- AC-013

## Contract affected

Removed: old `login`, `logout`, `profile`, `loginDemo` endpoints. Kept, mock-only: `demoAccounts`,
`updateProfile`, `changePassword`.

## Risk

Low to medium. Removal must find every reference, including specs and the mock example registry;
`npm run check` and the production bundle check catch leftovers.

## Suggested verification

Dev toolbar spec (switch sets the mock role, makes no login call, user unchanged), contracts
endpoint spec (old keys gone), fixtures spec, `npm run check`.

## Blocked by

- 02
- 03

## Acceptance criteria

- [x] Switching role in the dev toolbar changes the mock role, shows its toast, and makes no login request.
- [x] The signed-in user is the same before and after a role switch.
- [x] The old login, logout, profile and demo-login endpoints no longer exist; demo accounts, profile update and change password remain.
- [x] The convention doc describes the bearer token and the v1 auth endpoints.
