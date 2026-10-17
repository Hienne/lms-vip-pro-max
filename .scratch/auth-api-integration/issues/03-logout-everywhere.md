---
artifact: ticket
status: done
workspace: lms-vip-pro-max
project: lms
source: .scratch/auth-api-integration/spec.md
source_revision: 2
revision: 3
---

# 03: Logout through the backend, always ending the local session

## What to build

Logging out from the shell calls v1 logout with the bearer header, then removes the stored token
and the user and shows the login page, whether the call succeeds, answers 401 or fails offline.
The copy stays as today.

## Source acceptance criteria

- AC-006

## Contract affected

The session's sign-out uses v1 logout instead of the old logout.

## Risk

Low. The current sign-out already ignores the call's outcome.

## Suggested verification

Session store spec (logout success, 401 and network error all end anonymous with no token). Live:
logout on the running app removes the token and a reload stays anonymous.

## Blocked by

- 02

## Acceptance criteria

- [x] Logout calls v1 logout with the bearer header.
- [x] After logout the token and the user are gone and the visitor is anonymous, for success, 401 and network failure alike.
