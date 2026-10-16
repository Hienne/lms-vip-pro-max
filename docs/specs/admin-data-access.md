# Spec: Admin data access (server data, server mutation, invalidation)

Status: ready for implementation · Labels: `ready-for-agent`

## Problem Statement

The five admin-org stores (roles, org, users, user editor, user detail) each
hand-write the same machinery around the server: a list resource reloaded by a
change counter, a linked signal that keeps the last value on screen during a
reload, one `rxResource` per mutation whose `tap` closes the drawer, bumps the
counter and shows a toast, and `toAppError(resource.error())` repeated for
every error selector. The rule "a save error goes into the drawer form, a row
action error goes to a toast" is re-decided inside every `tap`.

For an administrator this works today, but every screen that will be migrated
next (courses, exams, reports) will copy the same block again. A mistake in
one copy — a forgotten counter bump, a toast on the wrong error, a stale
detail of the previous user shown while the next one loads — appears on one
screen only and is not caught by any shared test, because the mechanism has
no test of its own: it is only covered indirectly by four page specs.

## Solution

Add a small data-access module in the app's `core` with three primitives that
stores call from their field initializers, the same way they call
`rxResource` today:

- **`invalidation()`** — a change token a store creates; mutations bump it,
  data reads reload on it.
- **`serverData()`** — reads one value from the server, keeps the last value
  on screen while reloading, and exposes the error as an `AppError`.
- **`serverMutation()`** — runs a command, and on success runs a hook, bumps
  an invalidation and shows a success toast; on error either shows a toast or
  exposes the error for the form, as the mutation declares.

The five admin-org stores are rewritten on top of it, keeping exactly the
behaviour they have today. Stores keep the screen state (filters, sort, page,
editing, tab), the Vietnamese copy, confirm dialogs and intent-named
commands. `docs/conventions/angular.md` §5.2 and §14 and
`docs/conventions/workspace.md` are updated so the new shape is the
documented one.

## User Stories

1. As an administrator, I want the roles, units, users and user pages to behave exactly as they do today after this change, so that the refactor costs me nothing.
2. As an administrator, I want a list to stay on screen while it reloads after I save, so that the page does not flash empty.
3. As an administrator, I want a loading state only on the first load of a page, so that later reloads feel instant.
4. As an administrator, I want a load error to show the page's error state with a retry, so that I can recover without reloading the app.
5. As an administrator, I want retry to reload the same data from the server, so that a transient failure is easy to fix.
6. As an administrator, I want a failed save in the drawer to show the server's field errors in the form, so that I can correct the input without losing it.
7. As an administrator, I want a failed row action (lock, unlock, delete, change unit status, reset password) to show a toast with the server's message, so that I know it did not happen.
8. As an administrator, I want the drawer to close only after a save succeeds, so that a failed save keeps my input.
9. As an administrator, I want a success toast with the copy each screen uses today ("Đã thêm vai trò", "Đã cập nhật người dùng", "Đã lưu", "Đã xóa"…), so that the wording does not change.
10. As an administrator, I want the password reset toast to keep showing where the link was sent, so that I can tell the user.
11. As an administrator, I want the list to reload from the server after every accepted change, so that I always see the server's truth (Prism is stateless).
12. As an administrator, I want a change made in the user editor to reload both the users list and the user page, so that both screens agree.
13. As an administrator, I want resubmitting the same form after an error to call the server again, so that a second attempt is not silently ignored.
14. As an administrator, I want reopening the drawer to start with no error from the previous attempt, so that an old message does not mislead me.
15. As an administrator, I want a confirm dialog before lock, unlock and delete, with the same title, message, label and tone as today, so that destructive actions stay deliberate.
16. As an administrator, I want the save button disabled while a save is pending, so that I do not submit twice.
17. As an administrator, when I go from one user's page to another's, I want the previous user's details to disappear instead of staying on screen, so that I never act on the wrong person.
18. As an administrator, when the current user's page reloads after an edit, I want the details to stay on screen during the reload, so that the page does not flash.
19. As a unit administrator, I want the scope sentence and scope labels to stay as they are, so that I still see which unit I manage.
20. As a developer migrating the next admin screen, I want one documented way to read server data, so that I do not copy a linked-signal block from another store.
21. As a developer, I want one documented way to run a mutation, so that closing, reloading and toasting are not hand-written.
22. As a developer, I want each mutation to declare whether its errors go to a toast or inline, so that the error policy is visible where the mutation is declared.
23. As a developer, I want declaring the error destination to be required, so that I cannot forget it.
24. As a developer, I want the success message to be a function of the input and the server result, so that messages like "added" versus "updated" and "sent to X" need no extra state.
25. As a developer, I want an `onSuccess` hook that runs before the reload and the toast, so that I can close a drawer or navigate.
26. As a developer, I want a store to share its invalidation read-only with another store, so that cross-store reloads (editor → list, editor → detail) need no counter plumbing.
27. As a developer, I want a data read to accept params and stay idle while they are undefined, so that a route-keyed detail waits for its id.
28. As a developer, I want a data read to drop its last value when its params change and keep it on an invalidation reload, so that the detail case needs no custom linked signal.
29. As a developer, I want errors exposed as `AppError` already, so that stores stop calling `toAppError` in every selector.
30. As a developer, I want the primitives to take any `() => Observable`, so that they keep working when the endpoint-call adapter (architecture review #02) replaces the API service bodies.
31. As a developer, I want to keep using a raw `rxResource` where the primitives do not fit (session, shell counts), with a comment saying why, so that the convention does not force a bad fit.
32. As a developer, I want the store shape in angular.md §5.2 to describe this pattern, so that the docs and the code agree.
33. As a reviewer, I want the §14 checklist to check "API calls go through `serverData`/`serverMutation`, or `rxResource` with a stated reason", so that I can review against the convention.
34. As a reviewer, I want the four admin-org page specs to pass unchanged, so that I can trust the refactor preserved behaviour.
35. As a reviewer, I want the mechanism tested once through its own interface, so that I do not need to read five stores to know it works.
36. As a reviewer, I want each store migrated in its own commit with page specs green, so that I can review the diff in steps.
37. As an AI agent working in this repo, I want workspace.md to say where data-access primitives live, so that I put the next one in the right folder.
38. As an AI agent, I want the convention example in §5.2 rewritten with the primitives, so that I copy the current pattern and not the old one.
39. As a maintainer, I want the known limitation of mutation concurrency recorded, so that it is fixed deliberately later rather than rediscovered.

## Implementation Decisions

- **Location.** A new `data-access` folder in the app's `core`. Not
  `shared/` (presentational UI only per workspace.md) and not inside
  `features/admin-org` (features may not import another feature's internals,
  and the next admin features need it).
- **Shape: factory functions, not a base class or a service.** Called in a
  store's field initializers (injection context), like `rxResource`. A store
  may call them several times. They inject `Toaster` themselves.
- **`invalidation()`** returns a token with a readonly version signal and
  `bump()`. The owning store creates it; another store may receive it
  read-only (the user editor exposes its token to the users list and the user
  page, replacing today's `changes$` counter).
- **`serverData(load, options)`**
  - `load` receives the current params and returns an `Observable`.
  - Options: `params` (a function; `undefined` keeps the read idle) and
    `reloadOn` (one or more invalidation tokens).
  - Exposes `value` (last value from the server), `isLoading` (true only
    while no value is held), `error` (`AppError | undefined`) and `reload()`.
  - The last value survives reloads caused by invalidation or `reload()`, and
    is dropped when the params change (compared by value). This replaces the
    custom linked signal of the user detail store.
  - No `isRefreshing` (not in the mockup).
- **`serverMutation(run, options)`**
  - `run` receives the input and returns an `Observable` of the result.
  - Options: `errors: 'toast' | 'inline'` (required, no default),
    `success: (input, result) => message` where message is a string or a
    title plus detail, optional `onSuccess(result)`, optional `invalidates`
    (one or more tokens).
  - On success, in order: `onSuccess`, bump invalidations, success toast.
  - On error: `'toast'` shows `toAppError(error).message` as an error toast;
    `'inline'` exposes it as `error`.
  - Exposes `run(input)` (always sets a fresh request object so resubmitting
    the same payload calls again), `isPending`, `error` (meaningful for
    `'inline'`) and `reset()` (clears the request and its error; used when a
    drawer reopens).
  - Built on `rxResource`, so a new request still cancels the in-flight one,
    exactly as today.
- **Stores after migration.** `state` holds only screen state (editing,
  filters, sort, page, tab). Primitives sit in the Resources section as
  private fields; selectors re-expose them as `x$`. Confirm dialogs stay in
  store commands. The drawer handle stays in the store and is closed from
  `onSuccess` until architecture review #03 moves it to a view-side editor.
- **Migration order:** roles → org → user editor → users → user detail, each
  in its own commit, page specs green after each.
- **Docs.** angular.md §5.2: `state` holds screen state only; every API call
  goes through `serverData` or `serverMutation`; raw `rxResource` only where
  they do not fit, with a comment giving the reason; the store example is
  rewritten. §14: the checklist line is updated to match. workspace.md: the
  "where code goes" table gets a row for core data-access primitives.

## Testing Decisions

Tests assert external behaviour only, through the public interface of each
primitive or of the page; no test reads a store's private fields or a
resource object. Seams, highest first:

1. **Admin-org page specs (existing, unchanged).** The roles, org, users and
   user-detail page specs drive the real stores against
   `HttpTestingController`. They are the regression net: they must pass
   without edits. If an edit proves unavoidable, the PR states which and why.
2. **Data-access primitives (new spec).** Through `TestBed` injection
   context, with `Subject`s as the load and run sources and a stub
   `Toaster`. Covers: first-load `isLoading`; value kept across an
   invalidation reload; value dropped when params change; idle while params
   are undefined; load error as `AppError`; `reload()`; mutation success order
   (`onSuccess` → invalidation → toast); success message from input and
   result; `'toast'` versus `'inline'` errors; resubmitting the same input
   calls again; `reset()` clears the error; a second run cancels the first.

Prior art: the admin-org page specs (store plus `HttpTestingController`) and
the session store spec in the app foundation.

## Out of Scope

- Mutation concurrency (row actions cancelling each other): kept as today,
  recorded as a known limitation, to be handled separately.
- The endpoint-call adapter, `ErrorHandler` reporting, `ContractError`
  details and 401 handling (architecture review #02).
- Moving the drawer, footer and server-error wiring out of stores
  (architecture review #03).
- Migrating `SessionStore`, `ShellStore`, the login and profile stores.
- Small clean-ups noted in the review: the `UsersStore` pass-through
  selectors, the hand-typed unit status union in the org store.
- Any change to copy, layout or server contracts.

## Further Notes

- Origin: architecture review of 15/10/2026, candidate 01 ("Admin collection
  module"), refined in a grilling session. Correction to the review: the org
  store has one list, not two.
- Done means: `npm run check` green, the angular.md §14 checklist passes, the
  four page specs pass unchanged, and a smoke test on the app against Prism
  covers add, edit and delete a role, lock a user, and switching between two
  users' pages.
