---
artifact: ticket
status: done
workspace: lms-vip-pro-max
project: lms
source: .scratch/auth-api-integration/spec.md
source_revision: 2
revision: 3
---

# 02: Sign in, restore and call the backend with the bearer token

## What to build

The tracer bullet from the login page to a signed-in user from the real backend. The login form
takes "Tên đăng nhập hoặc mã cán bộ" and a password and signs in through v1 login; the demo-account
block and the locked-account shortcut go. The session keeps the access token with its expiry in
`localStorage` behind a small token store, loads the user through v1 me, and adapts it to the
existing profile (spec AC-008 mapping, AC-009 scope label, every menu, home `/learn`). An
interceptor adds the bearer header to `/api/` requests except login, before the base URL is added.
At boot an unexpired token restores the user; a missing or expired token, or a 401 from me, leaves
the visitor anonymous and clears the token. A mid-use 401 runs the session-expired flow, which also
clears the token; v1 login and me are its exemptions. Development runs with the mock on again and
the v1 auth calls reach the backend because they have no fixture.

## Source acceptance criteria

- AC-001
- AC-002
- AC-003
- AC-004
- AC-005
- AC-008
- AC-009
- AC-011

## Contract affected

The session uses v1 login and me instead of the old login and profile. Token storage
`{ accessToken, expiresAt }` in `localStorage`. Development environment `mockApi: true`.

## Risk

Medium. Every guard and the shell read the session; the profile adapter must keep `Profile`
consumers working. Interceptor order decides whether the token can leak to another origin.

## Suggested verification

Session store spec (sign in, restore with valid / expired / missing token, me 401), a bearer
interceptor spec following the base-URL interceptor spec, session-expiry interceptor spec, login
component spec, mock API interceptor spec. Live: the user signs in with a real account on
`npm start`; the agent checks the bearer header on me, the header and profile showing the real
user, and a reload keeping the session.

## Blocked by

- 01

## Acceptance criteria

- [x] The login form shows the username / staff code field and no demo block, and posts `{ username, password }` to v1 login.
- [x] A successful login stores the token and expiry, loads me with the bearer header, says "Đăng nhập thành công" and goes to `next` or `/learn`.
- [x] `/api/` requests carry the bearer header while a token is stored, except login; other URLs and token-less requests carry none.
- [x] Boot with a valid token restores the user; boot with a missing or expired token makes no me call and leaves the visitor anonymous; an expired token is removed.
- [x] A me 401 at boot and a non-exempt 401 mid-use leave the visitor anonymous and remove the token.
- [x] The signed-in user shows the `/me` name, unit, group, title, role name and scope label in the header and profile page.
- [x] With the development mock on, v1 auth calls go to the network and other endpoints still get their fixtures.
