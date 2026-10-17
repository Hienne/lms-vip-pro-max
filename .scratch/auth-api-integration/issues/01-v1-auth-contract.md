---
artifact: ticket
status: done
workspace: lms-vip-pro-max
project: lms
source: .scratch/auth-api-integration/spec.md
source_revision: 2
revision: 2
---

# 01: v1 auth contract, envelope and inactive status

## What to build

Prefactor the contract so the next tickets only wire behaviour. Add the backend response envelope
as a reusable schema helper that parses the envelope and yields `data`. Declare the three v1
endpoints (login, logout, me) beside the existing auth endpoints, with their command and response
schemas from the spec's "Contracts and state transitions". Add `inactive` to the account status
and render it as a neutral "Ngừng hoạt động" badge. Add fixtures for the v1 endpoints in
`@lms/mocks` (enveloped, parsed by the fixtures spec) without registering them in the mock API.
The old endpoints stay untouched here.

## Source acceptance criteria

- AC-007
- AC-010

## Contract affected

New: envelope helper, `LoginV1Command`-style username/password command, token response, `Me`
schema (user, roles, functions, role grants, function details, function scopes), v1 `login`,
`logout`, `me` endpoints. Changed: `AccountStatus` gains `inactive`.

## Risk

Low. Additive; the only shared change is the status enum, which every status switch must handle.

## Suggested verification

Contracts spec and fixtures spec (every fixture parses with its schema; a body missing the envelope
fails); account-status spec for the new badge. `npx nx test contracts mocks lms`.

## Blocked by

None

## Acceptance criteria

- [x] An enveloped body parses to its `data`; a body without the envelope or with a wrong `data` fails to parse.
- [x] The v1 login, logout and me endpoints exist with the spec's paths, methods and schemas.
- [x] A `/me` sample with null email and null org fields and a staff code with leading zeros parses unchanged.
- [x] `inactive` is a valid account status and renders as a neutral "Ngừng hoạt động" badge.
- [x] v1 fixtures parse with their schemas and are not answered by the mock API.
