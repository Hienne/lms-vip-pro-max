# Spec: Backend response envelope and form-only field errors

Status: ready for implementation · Labels: `ready-for-agent`

## Problem Statement

The app's error contract was modelled on the mockup, not on the real backend.
It assumes the HTTP status carries the outcome (401, 403, 404, 422, 423) and
that a 422 carries `details`, a map from field name to message. That map
travels from `serverMutation.fieldErrors` through a `serverErrors` input on
five forms. Each form then merges it with its validator errors by hand. The
same "client errors once touched, plus the server message for this key" rule
is copied seven times: three private `messages()` helpers, three inline
copies, and a touched-only variant in the design-system page. Login has an
eighth variant that maps error kinds onto its two fields and an error summary.

The real backend works differently:

- Every response, success or failure, is HTTP 200 with an envelope:
  `responseId`, `timestamp`, `status` (`SUCCESS` or `ERROR`), `messageCode`
  (`CORE-0000` on success), `messageTitle`, `message` and `data`.
- The payload is in `data`. A failure is known only by `status: "ERROR"`.
- No failure names a field. "Email already exists", "unit code already used"
  and "current password is wrong" are response-level messages. The backend has
  no endpoint to check them ahead of time, so an async validator cannot catch
  them either.

Against that backend the app breaks in several ways:

- `HttpClient` treats every error envelope as success. The envelope then fails
  the endpoint's zod schema and shows up as a generic contract error.
- The session-expiry interceptor waits for an HTTP 401 that never arrives.
- `serverData`/`serverMutation` never see a failure.
- The field-level server error path is dead code. `ui-field` exists only to
  show validator messages, but every form computes those messages itself.

## Solution

One place in the app knows about the envelope. On success it hands the rest of
the pipeline the `data`, so endpoint schemas stay as they are. On error it
raises a typed error carrying the backend's code, title and message. Every
consumer downstream (session expiry, `serverData`, `serverMutation`,
`AppError`) works the same way it does today.

The user sees server failures at response level:

- A rejected save or delete shows a toast with the backend's title and message,
  and the drawer stays open.
- A failed sign-in shows an inline alert on the login form.
- A failed read shows the page's existing error state.
- An expired session (HTTP 401 or `CORE-0401`) ends the session once and goes
  to `/login`.

`ui-field` reads its control's Signal Forms state and shows validator and
async-validator errors once the field is touched. Forms no longer compute or
pass error lists. The touched rule lives in one place.

## User Stories

1. As a learner, I want the app to treat a backend `ERROR` response as a failure, so that I never see half-loaded or blank data presented as success.
2. As a learner, I want to be sent to the login page with one message when my session expires, so that I know why I have to sign in again.
3. As a learner, I want session expiry detected whether the backend answers with HTTP 401 or with `CORE-0401`, so that I am never left on a page that silently fails.
4. As a learner signing in with wrong credentials, I want the backend's message in an alert on the login form, so that I see why sign-in failed where I am looking.
5. As a learner whose account is locked, I want the backend's title and message in the login alert, so that I know to contact an administrator.
6. As an administrator adding a user with an email that already exists, I want a toast with the backend's title and message, so that I know the save failed and why.
7. As an administrator, I want the add/edit drawer to stay open with my input intact after a rejected save, so that I can correct it and save again.
8. As an administrator adding a unit with a code already in use, I want the same toast behaviour, so that every admin form fails the same way.
9. As an administrator saving a role whose name is taken, I want the same toast behaviour.
10. As an administrator deleting a group that still has members, I want the backend's refusal as a toast, so that I understand why nothing was deleted.
11. As a learner changing my password with a wrong current password, I want a toast with the backend's message, so that I know the change did not happen.
12. As a learner saving my profile, I want any backend refusal as a toast, so that a failed save is never silent.
13. As any user, I want a field's validation messages to appear only after I have touched that field, so that a fresh form does not greet me with errors.
14. As any user, I want every field to show its validation messages after I press Save, so that I can see everything I must fix.
15. As a screen-reader user, I want each invalid control marked `aria-invalid` and described by its messages, so that I hear what is wrong when I focus it.
16. As a screen-reader user, I want the same accessible wiring for async-validator errors as for synchronous ones, so that future server checks are announced the same way.
17. As a user of a detail page whose record the backend refused to load, I want no "retry" button for a deliberate backend refusal, but one for a network or unknown failure, so that I only retry when retrying can help.
18. As a user, I want the backend's message shown verbatim, with a Vietnamese default when the backend sends none, so that I always get a readable explanation.
19. As a user offline, I want the existing offline message, so that network failures stay distinct from backend refusals.
20. As a developer, I want a malformed envelope (missing `status`, wrong types) reported as a contract error, so that backend drift is caught at the boundary and not deep in a screen.
21. As a developer, I want endpoint response schemas to keep describing the payload only, so that adopting the envelope does not touch every endpoint.
22. As a developer, I want requests that are not endpoint calls (assets, config) to bypass envelope handling, so that non-API resources keep working.
23. As a developer, I want `AppError.kind` to hold only the cases the app branches on, so that nobody writes logic against kinds the backend never sends.
24. As a developer, I want the table of message codes the app branches on to live in one place, so that adding a new code-driven behaviour is a one-line change.
25. As a developer, I want a form to declare only its model, schema and submit, so that adding a field means adding one `ui-field` and one `[formField]`.
26. As a developer, I want the "show after touched" rule tested once in `ui-field`, so that forms do not need their own tests for it.
27. As a developer, I want the design-system error summary to read the form's own error summary, so that the demo shows the real mechanism.
28. As a developer running the app on the in-app mock API, I want the mock to answer with the same envelope and HTTP 200 as the backend, so that dev behaviour matches production.
29. As a developer writing a page spec, I want the mock's error examples as `ERROR` envelopes keyed by scenario name, so that I can flush each backend refusal by name.
30. As a developer, I want mock-only message codes marked as unconfirmed with the backend, so that nobody mistakes them for real codes.
31. As a reviewer, I want the change split into ordered tickets, each passing `npm run check`, so that each step can be reviewed alone.
32. As a future contributor, I want the conventions docs to describe the envelope, the error kinds, the toast/alert policy and the self-wiring `ui-field`, so that new screens follow the new shape.

## Implementation Decisions

### Envelope contract (`@lms/contracts`, http)

- A zod schema for the envelope: `responseId`, `timestamp`, `status`
  (`SUCCESS` | `ERROR`), `messageCode`, `messageTitle`, `message`, `data`.
  `data` is unknown at this level and is parsed later by the endpoint's own
  response schema.
- `status === 'SUCCESS'` is the success test. `messageCode` is not used to
  decide success.
- The table of message codes the app branches on lives in contracts so the app
  and the mock share it. It starts with exactly one entry,
  `CORE-0401 → unauthorized`.
- The old `ApiErrorSchema` (`{ message, details? }`) is removed.

### `envelopeInterceptor` (app core/http, new)

- Acts only on requests that carry the `ENDPOINT` context token. Every other
  request passes through untouched.
- Sits immediately after `sessionExpiryInterceptor` in the interceptor list and
  before the dev features and the mock API, so the mock's envelope goes
  through it and session expiry sees its errors.
- On a 2xx body that parses as an envelope:
  - `SUCCESS`: replaces the response body with `data`.
  - `ERROR`: throws an `ApiError` carrying `messageCode`, `title`
    (`messageTitle`) and `message`.
- A 2xx body that does not parse as an envelope throws `ContractError`.
- Non-2xx responses (network failure, gateway 5xx, a real HTTP 401) pass
  through as `HttpErrorResponse`, as today.
- It never shows UI.

### Session expiry

- `sessionExpiryInterceptor` treats both HTTP 401 and `ApiError` with
  `messageCode === 'CORE-0401'` as an ended session.
- The exempt list (profile, login, loginDemo) and the lazy `SessionExpiry`
  loading are unchanged.
- The session store's "anonymous on unauthorized" check goes through
  `AppError.kind`, so it covers both cases without a change of its own.

### `AppError`

- `kind` becomes `offline | unauthorized | server | contract | unknown`.
  `forbidden`, `not-found`, `invalid` and `locked` are removed.
- `server` means the backend answered on purpose with a code that is not in
  the branching table.
- New fields `title` and `messageCode` (both present on `server` and on
  code-driven kinds). `details` is removed.
- `message` and `title` come verbatim from the backend. The Vietnamese
  `DEFAULT_MESSAGE` for the kind is used only when the backend sent none.
- `toAppError` stays the only translator. Its new inputs are `ApiError`,
  `ContractError` and `HttpErrorResponse` (status 0 → `offline`, 401 →
  `unauthorized`, anything else → `unknown`).
- The user-detail page's retry rule becomes "retryable unless kind is
  `server`".

### Error display policy

- No interceptor shows a toast. Display stays a decision made at the call site.
- `serverMutation` option `errors` becomes `'toast' | 'alert'`. `'inline'` is
  renamed to `'alert'`. The toast uses `title` as its heading and `message` as
  its detail.
- `serverMutation.fieldErrors` is removed.
- Every admin-org save that used `'inline'` (unit, group, role, user editor)
  switches to `'toast'`. Their drawers stay open on failure, as they do today.
- `ProfileStore`'s two raw `rxResource` mutations (save profile, change
  password) move to `serverMutation` with `errors: 'toast'`, so a refusal is
  no longer silent once field-level errors are gone.
- Login uses `'alert'`. The form shows one `ui-alert` with title and message.
  Its kind-to-field mapping, `fieldErrors` and its `ui-error-summary` are
  removed.
- Reads (`serverData`) keep their page-level error state.

### Forms

- The `serverErrors` input is removed from user, unit, group, role and
  password forms. So are the bindings on their pages.
- All `xxxErrors` computeds and private `messages()` helpers are removed. A
  form declares its model, schema, `[formField]` bindings and submit.

### `ui-field` (`@lms/ui`, molecule)

- Reads the projected control's Signal Forms state through
  `contentChild(FormField)`.
- Shows `state().errors()` messages only when `state().touched()` is true.
  These include synchronous and async validator errors. Empty messages are
  filtered out.
- Keeps its existing wiring (label `for`, generated id, `aria-describedby`,
  `aria-required`, `aria-invalid`) driven by those messages.
- The `errors` input is removed.
- No pending indicator for async validation yet. It is added in `ui-field`
  when the first async validator appears.
- `@lms/ui` gains a runtime dependency on `@angular/forms/signals`. The `Field`
  docstring and ui-library.md say so.
- The design-system forms section feeds `ui-error-summary` from the form's
  `errorSummary()`.

### Mock API (`@lms/mocks` and the in-app mock interceptor)

- The in-app mock answers every fixture with HTTP 200 and a `SUCCESS` envelope
  around the fixture (still chosen by the dev toolbar's role). It simulates
  no errors today, and this spec does not add error simulation.
- The endpoint error examples, which page specs flush, become `ERROR`
  envelopes. They are keyed by scenario name, not by HTTP status. Each carries
  `messageCode`, `messageTitle` and a Vietnamese `message` taken from the
  mockup.
- The session-expired example uses the real `CORE-0401`. Other examples use
  placeholder codes, defined together and marked "mock-only, unconfirmed with
  the backend".
- Fixtures with `details` are removed or rewritten as response-level messages.

### Docs

- contracts-and-mocks.md: envelope, the success test, the branching code
  table, the new `AppError`, error display policy, mock scenarios.
- angular.md §6: the example no longer checks `touched()` in the template.
  `ui-field` does it.
- ui-library.md and the `Field` docstring: Field reads Signal Forms state.
- The architecture-review note "409 deserves its own kind" is dropped.

### Delivery

Six tickets under `.scratch/response-envelope/issues/`, in expand–contract
order. Page specs install no interceptors today, so adding the envelope
interceptor breaks none of them; each ticket moves the specs it touches to
flushing envelopes. Docs change in the ticket that changes the behaviour.

1. Tracer bullet: the app reads the backend envelope (old kinds still exist).
2. Admin-org rejected saves show a toast (blocked by 1).
3. Profile failures show a toast (blocked by 1).
4. Failed sign-in shows an alert; `'inline'` becomes `'alert'` (blocked by 1, 2).
5. Contract: shrink `AppError`, mock error examples as envelopes (blocked by 2, 3, 4).
6. `ui-field` shows validator errors itself (blocked by 2, 3, 4).

## Testing Decisions

Tests assert external behaviour through public interfaces: what a caller of
`EndpointClient` receives, what the user sees in the DOM, and what the mock
returns. No test reads a private field or calls an interceptor function
directly.

1. **`EndpointClient` spec (existing, extended).** Uses `HttpTestingController`
   with the production interceptor list. Covers:
   - A `SUCCESS` envelope yields the parsed `data`.
   - An `ERROR` envelope yields an error that `toAppError` turns into kind
     `server` with the backend's `title`, `message` and `messageCode`.
   - An `ERROR` with `CORE-0401` yields kind `unauthorized`.
   - A malformed envelope yields `ContractError`.
   - A request without `ENDPOINT` passes through unchanged.
   - Status 0 yields `offline`.

   `envelopeInterceptor` has no spec of its own. It is tested through the
   client.

2. **Session-expiry spec (existing, extended).** HTTP 401 and a 200 with
   `CORE-0401` both end the session once. Exempt endpoints do not.
3. **`app-error` spec (existing, rewritten).** It covers the new kinds,
   verbatim title/message, and the defaults when the backend omits them.
4. **`serverMutation` spec (existing, updated).** A `'toast'` failure shows a
   toast with title and detail. An `'alert'` failure exposes `error` and shows
   no toast. The `fieldErrors` cases are removed.
5. **`ui-field` spec (existing, extended).** A host component uses Signal
   Forms. Covers:
   - No messages before touch.
   - Messages after touch and after `submit()`.
   - An async validator's error is shown and wired the same way.
   - `aria-invalid` and `aria-describedby` follow the messages.
6. **Page specs (existing: users, user-detail, org, roles, profile, login).**
   They switch to flushing envelopes through two shared test helpers (one for
   success, one for error). Covers:
   - A rejected save shows a toast and the drawer stays open.
   - A wrong password on change-password shows a toast.
   - A failed sign-in shows the login alert with title and message.
   - user-detail shows retry for `unknown` and not for `server`.

   Assertions about field-level server messages are removed. Any other changed
   assertion is listed in the PR.

7. **`mock-api.interceptor` spec (existing, updated).** Every answer is HTTP
   200 with a `SUCCESS` envelope around the role's fixture. The fixtures spec
   checks that every error example parses as an `ERROR` envelope.
8. `npm run check` green after every ticket. The in-app mock simulates no
   errors, so the refusal flows are proven by page specs. A manual pass on the
   mock checks that every role's home and the migrated screens load through
   the envelope, sign-in and sign-out work, and admin saves succeed with
   their toast.

Prior art: `endpoint-client.spec.ts`, `session-expiry.interceptor.spec.ts`,
`server-mutation.spec.ts`, `field.spec.ts`, `mock-api.interceptor.spec.ts`,
`users.spec.ts`, `org.spec.ts`, `roles.spec.ts`.

## Out of Scope

- Async validators against the backend (no verification endpoints exist yet),
  and a pending indicator in `ui-field`.
- Mapping more `messageCode`s to kinds (403, 404, locked). They are added to the
  table when a screen needs to branch on them and the backend confirms the
  codes.
- Translating backend messages on the client by `messageCode`.
- Gathering the per-form `onSubmit` ritual (`preventDefault` + `submit()` +
  emit) into a shared helper.
- Submission errors through Signal Forms' `submit()` action. Not needed while
  the backend returns no field-level errors.
- Any change to business rules, scoring or permissions.

## Further Notes

- This spec replaces candidate 5 of the 2026-10-15 architecture review
  ("field errors, client + server, merged into Field"). The grilling session
  found that the backend has no field-level errors, so the field only needs
  validator errors, and the real gap was the envelope.
- If the backend later adds field-level errors, the preferred route is
  returning them from the Signal Forms `submit()` action as submission
  errors. They would then reach `ui-field` through the same state with no
  new input.
- Only `CORE-0000` (success) and `CORE-0401` (authentication) are confirmed
  backend codes. Every other code in the mock is a placeholder.
