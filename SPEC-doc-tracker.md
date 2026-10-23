# Spec: `doc-tracker` (frontend, Phase 3)

Map: [SPEC.md](SPEC.md). Uses [SPEC-kb-contracts.md](SPEC-kb-contracts.md). Feeds
[SPEC-assistant-screen.md](SPEC-assistant-screen.md) and [SPEC-owl-indicator.md](SPEC-owl-indicator.md).

## Objective

While a user has uploads in `queued` or `processing`, the app keeps polling their status on every page, and
announces each document that finishes (`ready` or `failed`), so the owl and the document list react
without a reload.

## Placement

`apps/lms/src/app/core/knowledge/document-tracker.store.ts`, class `DocumentTrackerStore`,
`@Injectable({ providedIn: 'root' })`. It is app-level state like `NetworkStore` and `SessionStore`
(the existing root, store-shaped services); angular.md's "no root store" rule is for route stores. It
follows the §5.2 shape: one `state` object, `$` selectors, setters, commands.

## Behaviour

- **Active only while signed in** (reads `SessionStore`'s user). Sign-out or session expiry clears all
  state and stops polling.
- **Seed:** on sign-in, one call `documents { mine: true, status: ['queued', 'processing'], size: 100 }`
  fills `pending` (so a reload in the middle of processing keeps the owl chewing).
- **Track:** `track(document)` adds a just-uploaded document (called by the assistant store from the
  upload mutation's `onSuccess`).
- **Poll:** while `pending` is not empty and the network is online, the same query runs every 3 s
  (`serverData` with an interval-driven `invalidation`; the timer lives in an `effect` with `onCleanup`).
  The last value stays on screen during reloads.
- **Finish:** an id that leaves the pending result is fetched once with `document`; `ready` or `failed`
  becomes `lastFinished` (`{ document, at }`) and bumps the `finished` change token. A failed fetch keeps
  the id pending for the next poll.
- **Errors:** a poll error keeps polling with the same interval and is not shown (the owl is not an error
  surface); the console gets it through `ErrorHandler` only for contract errors.
- **Notice:** `dismiss()` clears `lastFinished`. A `ready` notice clears itself after 6 s; a `failed`
  notice stays until dismissed.

## Public surface

| Member                    | Kind                      | Meaning                                                                                                  |
| ------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pending$`                | selector                  | the user's documents still `queued` or `processing`                                                      |
| `lastFinished$`           | selector                  | the last finished document and when, or `null`                                                           |
| `owlState$`               | selector                  | `'processing'` if `pending` not empty, else `'done'` / `'failed'` while a notice is shown, else `'idle'` |
| `finished`                | `ChangeToken` (read-only) | bumps when any tracked document finishes; the document list reloads on it                                |
| `track(doc)`, `dismiss()` | commands                  |                                                                                                          |

## Testing (`document-tracker.store.spec.ts`)

Vitest fake timers, `provideMockBackendHttp()` or `HttpTestingController` with `@lms/mocks` fixtures:
seed on sign-in; poll interval; stop when empty; stop while offline; finish to `ready` and to `failed`;
6 s auto-dismiss for ready only; sign-out clears; a failed poll keeps polling.

## Boundaries

- Always: store owns all of it; components only read selectors.
- Never: compute processing progress in the app (the server owns status); poll when nothing is pending.

## Success criteria

Specs pass; in the app, uploading then navigating to another page keeps the status moving, and a reload
during processing resumes it.
