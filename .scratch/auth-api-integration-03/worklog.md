---
artifact: worklog
status: draft
workspace: .
project: unknown
source: .scratch/auth-api-integration/issues/03-logout-everywhere.md
source_revision: 2
revision: 1
---

# Worklog

## Goal

Track implementation and verification for auth-api-integration-03.

## Active ticket or slice

- Task: feature:auth-api-integration-03

## Contracts and invariants

- None recorded.

## Decisions

- None recorded.

<!-- flow:auto:start -->
Updated: 2026-10-17T01:19:17.366Z

## Changed files

- `./apps/lms/proxy.conf.mjs`
- `./apps/lms/src/app/app.config.ts`
- `./apps/lms/src/app/app.spec.ts`
- `./apps/lms/src/app/core/dev/dev-toolbar/dev-toolbar.spec.ts`
- `./apps/lms/src/app/core/dev/dev-toolbar/dev-toolbar.store.ts`
- `./apps/lms/src/app/core/dev/dev-toolbar/dev-toolbar.ts`
- `./apps/lms/src/app/core/dev/mock-api/mock-api.interceptor.spec.ts`
- `./apps/lms/src/app/core/http/session-expiry.interceptor.spec.ts`
- `./apps/lms/src/app/core/http/session-expiry.interceptor.ts`
- `./apps/lms/src/app/core/session/session.store.spec.ts`
- `./apps/lms/src/app/core/session/session.store.ts`
- `./apps/lms/src/app/core/storage/local-storage.ts`
- `./apps/lms/src/app/features/account/profile/profile.spec.ts`
- `./apps/lms/src/app/features/admin-org/org/org.spec.ts`
- `./apps/lms/src/app/features/admin-org/roles/roles.spec.ts`
- `./apps/lms/src/app/features/admin-org/user-detail/user-detail.spec.ts`
- `./apps/lms/src/app/features/admin-org/users/users.html`
- `./apps/lms/src/app/features/admin-org/users/users.spec.ts`
- `./apps/lms/src/app/features/auth/login/data-access/login.store.ts`
- `./apps/lms/src/app/features/auth/login/login.html`
- `./apps/lms/src/app/features/auth/login/login.scss`
- `./apps/lms/src/app/features/auth/login/login.spec.ts`
- `./apps/lms/src/app/features/auth/login/login.ts`
- `./apps/lms/src/app/features/design-system/design-system/design-system.spec.ts`
- `./apps/lms/src/app/shared/status/account-status.spec.ts`
- `./apps/lms/src/app/shared/status/account-status.ts`
- `./apps/lms/src/test-setup.ts`
- `./apps/lms/tsconfig.app.json`
- `./apps/lms/tsconfig.spec.json`
- `./docs/conventions/contracts-and-mocks.md`
- `./docs/conventions/workspace.md`
- `./eslint.config.mjs`
- `./libs/contracts/src/index.ts`
- `./libs/contracts/src/lib/identity/identity.schema.ts`
- `./libs/mocks/src/index.ts`
- `./apps/lms/src/app/core/http/bearer.interceptor.spec.ts`
- `./apps/lms/src/app/core/http/bearer.interceptor.ts`
- `./apps/lms/src/app/core/session/session.testing.ts`
- `./apps/lms/src/app/core/session/to-profile.ts`
- `./apps/lms/src/app/core/session/token-store.spec.ts`
- `./apps/lms/src/app/core/session/token-store.ts`
- `./libs/contracts/src/lib/auth/auth-v1.endpoints.spec.ts`
- `./libs/contracts/src/lib/auth/auth-v1.endpoints.ts`
- `./libs/contracts/src/lib/auth/auth-v1.schema.ts`
- `./libs/contracts/src/lib/http/envelope.spec.ts`
- `./libs/contracts/src/lib/http/envelope.ts`
- `./libs/mocks/src/lib/auth/auth-v1.fixtures.spec.ts`
- `./libs/mocks/src/lib/auth/auth-v1.fixtures.ts`

## Verification ledger

- PASSED — `.:all:build`
- PASSED — `test-integrity`

## Review threshold

- Total changed lines: 1923
- Implementation/code lines: 1882
- Code files: 46
- Formal review: required
- Gate: satisfied
- Evidence: code-simplification via subagent (flow:code-simplifier) at 2026-10-17T01:15:20.938Z, 0 blocking/1 non-blocking
- Evidence: code-review via subagent (flow:code-reviewer) at 2026-10-17T01:17:04.549Z, 0 blocking/3 non-blocking
<!-- flow:auto:end -->
