# 05: Contract: shrink `AppError` and turn mock error examples into envelopes

**What to build:** Remove the mockup-era error contract now that no caller uses it (contract step of the expand–contract).

- `AppError.kind` becomes `offline | unauthorized | server | contract | unknown`. `forbidden`, `not-found`, `invalid` and `locked` are removed, along with `details`.
- `ApiErrorSchema` is removed. The HTTP status table keeps only 0 → `offline` and 401 → `unauthorized`; anything else is `unknown`.
- The endpoint error examples in `@lms/mocks` are keyed by scenario name instead of HTTP status, and each is an `ERROR` envelope with `messageCode`, `messageTitle` and a Vietnamese `message` from the mockup.
- The session-expired example uses `CORE-0401`. Every other example uses a placeholder code, defined together and marked "mock-only, unconfirmed with the backend".
- Fixtures with `details` are removed or rewritten as response-level messages.
- Any spec still flushing a 4xx with the old body moves to the named envelope examples.
- contracts-and-mocks.md describes the new `AppError` and the example scenarios; it no longer mentions 422 `details`. The architecture-review note "409 deserves its own kind" is dropped.

See spec: `docs/specs/response-envelope.md`, Implementation Decisions → `AppError`, Mock API, Docs.

**Blocked by:** 02, 03, 04

**Status:** ready-for-agent

- [ ] `app-error` spec covers the five kinds, verbatim title/message and the defaults when the backend omits them
- [ ] Fixtures spec: every error example parses as an `ERROR` envelope, and no example is keyed by an HTTP status
- [ ] No spec or source references `forbidden`, `not-found`, `invalid`, `locked`, `details` or `ApiErrorSchema`
- [ ] Placeholder codes live in one place with the "mock-only" note
- [ ] contracts-and-mocks.md matches the new contract
- [ ] `npm run check` green
