# 04: A failed sign-in shows an alert on the login form

**What to build:** When sign-in fails (wrong credentials, locked account, or any other backend refusal), the login form shows one `ui-alert` with the backend's title and message, above the fields. The fields themselves show only their validator messages.

- The `serverMutation` option `'inline'` is renamed `'alert'`. After 02, login is the only user.
- Login drops its kind-to-field mapping (`fieldErrors`), the error summary built from it, and the `[errors]` bindings fed by server errors.
- The session store's "anonymous on unauthorized" check is confirmed to work for both HTTP 401 and `CORE-0401` through `AppError.kind`.
- The login, session-store, app and app-shell specs move to the envelope test provider and flush envelopes.

See spec: `docs/specs/response-envelope.md`, Implementation Decisions → Error display policy, Session expiry.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Login spec: a sign-in answered with an `ERROR` envelope shows the alert with title and message, and no toast
- [ ] Login spec: a demo-account sign-in refused by the backend shows the same alert
- [ ] Login spec: no field shows a server message, and no error summary is rendered for a server failure
- [ ] Session-store spec: restoring a session answered with HTTP 401 or `CORE-0401` leaves the visitor anonymous without ending a session
- [ ] `serverMutation` accepts `'toast' | 'alert'` only
- [ ] The login, session-store, app and app-shell specs flush envelopes only
- [ ] Browser on the mock: sign in with each demo account and sign out again
- [ ] `npm run check` green
