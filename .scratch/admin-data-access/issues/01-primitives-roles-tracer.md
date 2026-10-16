# 01: Tracer bullet: data-access primitives through the roles screen

**What to build:** The roles screen runs on the new core data-access primitives and behaves exactly as today. The app's core gets `invalidation()` (a change token with a readonly version and `bump()`), `serverData()` (reads a value, keeps the last one during a reload, exposes `value`, `isLoading` for the first load only, `error` as `AppError`, `reload()`; reloads on given tokens) and `serverMutation()` (`run`, `isPending`, `error`, `reset`; required `errors: 'toast' | 'inline'`, `success(input, result)` message, optional `onSuccess`, optional `invalidates`; on success runs `onSuccess`, then bumps, then toasts; built on `rxResource`, so a new request still cancels the in-flight one). `RolesStore` is rewritten on them: the list reloads on its token, save is inline (form errors in the drawer, drawer closed from `onSuccess`), delete is toast; `state` keeps only `editing`; confirm stays in the command. angular.md §5.2 store shape and its example, and the workspace.md "where code goes" table, describe the new pattern. `serverData` params are not part of this ticket (see 04). See spec: `docs/specs/admin-data-access.md`, Implementation Decisions.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Primitive spec through `TestBed` injection context with `Subject` sources and a stub `Toaster`: first-load `isLoading`; value kept across an invalidation reload and `reload()`; load error as `AppError`; success order `onSuccess` → invalidation → toast; message from input and result; `'toast'` versus `'inline'` errors; same input resubmitted calls again; `reset()` clears the error; a second run cancels the first
- [ ] `RolesStore` uses only the primitives for API calls; no `linkedSignal`, change counter or `toAppError` left in it
- [ ] Roles page spec passes without edits
- [ ] angular.md §5.2 (state holds screen state only; API calls through the primitives; raw `rxResource` only with a stated reason; example rewritten) and workspace.md updated
- [ ] Smoke test on the app against Prism: add, edit and delete a role, including a failed save showing field errors and a failed delete showing a toast
- [ ] `npm run check` green
