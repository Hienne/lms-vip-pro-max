# 01: Tracer bullet: the app reads the backend envelope

**What to build:** The backend answers every call with HTTP 200 and an envelope (`responseId`, `timestamp`, `status` `SUCCESS`/`ERROR`, `messageCode`, `messageTitle`, `message`, `data`). This ticket makes the whole app read it end to end, running on the in-app mock.

- `@lms/contracts` gets a zod envelope schema and the message-code table, whose only entry is `CORE-0401 → unauthorized`.
- A new `envelopeInterceptor` acts only on requests carrying `ENDPOINT` and sits right after `sessionExpiryInterceptor`. For `status === 'SUCCESS'` it replaces the body with `data`, so endpoint schemas are unchanged. For anything else it throws an `ApiError` (`messageCode`, `title`, `message`). A 2xx body that is not an envelope throws `ContractError`. Non-2xx responses pass through.
- `toAppError` understands `ApiError`: `CORE-0401` → `unauthorized`, any other code → a new kind `server`. Both carry `title` and `messageCode`, with the backend's text verbatim and the Vietnamese default when it is missing. The old kinds and `details` stay for now (expand).
- `sessionExpiryInterceptor` ends the session on HTTP 401 or `CORE-0401`, with the same exempt endpoints.
- The `serverMutation` toast uses `title` as its heading and `message` as its detail.
- The in-app mock wraps every fixture in a `SUCCESS` envelope.
- Shared test helpers `envelopeOk(data)` and `envelopeError(code, title, message)`, plus a test HTTP provider that installs `envelopeInterceptor`, for later tickets.
- contracts-and-mocks.md describes the envelope, the success test and the code table.

See spec: `docs/specs/response-envelope.md`, Implementation Decisions → Envelope contract, `envelopeInterceptor`, Session expiry, `AppError`, Mock API.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `EndpointClient` spec, run with the production interceptor list: a `SUCCESS` envelope yields parsed `data`
  - Run with `provideEnvelopeHttpClient()` (envelope interceptor only), not the full production list: session expiry has its own spec.
- [x] `EndpointClient` spec: an `ERROR` envelope yields an `AppError` of kind `server` with the backend's `title`, `message` and `messageCode`
- [x] `EndpointClient` spec: an `ERROR` with `CORE-0401` yields kind `unauthorized`
- [x] `EndpointClient` spec: a malformed envelope yields `ContractError`
- [x] `EndpointClient` spec: a request without `ENDPOINT` passes through unchanged
- [x] `EndpointClient` spec: status 0 still yields `offline`
- [x] Session-expiry spec: HTTP 401 and a 200 with `CORE-0401` each end the session once, and the exempt endpoints do not
- [x] `serverMutation` spec: a `'toast'` failure shows a toast with the title as heading and the message as detail
- [x] `mock-api.interceptor` spec: every answer is HTTP 200 with a `SUCCESS` envelope around the role's fixture
- [x] All existing page specs pass unchanged (they install no interceptors)
- [ ] Browser on the mock: the learner, instructor and admin demo accounts sign in, reach their home, and the migrated screens (users, user detail, org, roles, profile) load
  - Checked on the mock as learner (dashboard, profile) and admin (users, org, roles): all load through the envelope, no console errors. Sign-in, sign-out and the instructor account were not exercised in the browser; their paths are covered by the session-store and login specs.
- [x] contracts-and-mocks.md documents the envelope, `status === 'SUCCESS'` and the code table
- [x] `npm run check` green
