# Spec: Base libraries (contracts, mocks, core UI)

Status: ready for implementation · Labels: `ready-for-agent`

## Problem Statement

The foundation work delivered tokens, atoms and the design system page, but
the libraries every screen depends on are still empty. `@lms/contracts` and
`@lms/mocks` export nothing, Prism serves only a health check, the app has no
way to parse a response or turn a failure into something a screen can render,
and `@lms/ui` has no field, alert, empty/error state, page header, menu,
dialog, drawer, toast or tooltip. The next foundation step (session, role
guard, app shell, error pages, login) cannot start without them, and if each
screen invented its own error handling or form wrapper the team would drift
apart immediately.

## Solution

Build the base layer once, before any business screen:

- The contract toolkit in `@lms/contracts`: endpoint definitions, URL
  building and the shared API error shape, so every endpoint is declared one
  way.
- The shared domain schemas (roles, statuses, units, groups, users) and the
  auth endpoints, ported from the mockup's types and `api/auth.js`.
- Typed fixtures in `@lms/mocks` ported from the mockup seed, checked against
  the schemas, and used by Prism as named examples for every success, error
  and role.
- The app's response parsing and error mapping, so every API call is
  validated and every failure becomes one typed application error.
- The core `@lms/ui` pieces the shell, login and error pages need, each with
  its demo on `/design-system` and its checklist entry.

## User Stories

1. As a developer, I want to declare an endpoint once (method, path, params, body, response, error statuses), so that the app service and the mock server read the same definition.
2. As a developer, I want URL building from an endpoint and typed params, so that I never concatenate paths by hand.
3. As a developer, I want one API error schema matching the mockup's `ApiError` (`message`, optional field `details`), so that every error body is read the same way.
4. As a developer, I want domain types inferred from zod schemas, so that types and runtime validation never disagree.
5. As a developer, I want role, account status and publish status as zod enums, so that unions are exhaustive and checked.
6. As a developer, I want user, unit and group schemas ported from the mockup types, so that session and admin screens share one model.
7. As a developer, I want the auth endpoints (`login`, `loginDemo`, `logout`, `profile`, `demoAccounts`) declared with their error statuses (401, 404, 422, 423), so that the login screen knows every state it must render.
8. As a developer, I want fixtures for the mockup's people, units and groups, so that tests and Prism use the same demo data the README describes.
9. As a developer, I want a test that parses every fixture with its schema, so that a fixture that drifts from the contract fails CI.
10. As a developer, I want Prism to serve every registered endpoint with a default example, an example per error status and examples per role, so that I can develop screens without a backend.
11. As a developer, I want to pick a Prism example with the `Prefer` header, so that I can force any error state.
12. As a developer, I want every response parsed by its endpoint schema in the app, so that a contract mismatch is reported instead of corrupting the UI.
13. As a developer, I want a single mapping from any failure (HTTP error, contract error, offline) to a typed application error (`offline`, `unauthorized`, `forbidden`, `not-found`, `invalid`, `locked`, `contract`, `unknown`), so that stores and components handle errors one way.
14. As a developer, I want the server's field `details` preserved on `invalid` errors, so that forms can show per-field messages.
15. As a developer, I want an `AuthApi` service with the mockup's method names, so that every call traces back to its mockup function.
16. As a developer, I want `ui-field` to wire label, hint and errors to the projected native control with `aria-describedby` and `aria-invalid`, so that every form is accessible without plumbing.
17. As a developer, I want `ui-error-summary` with links that focus the invalid fields, so that long forms meet the mockup's accessibility rule.
18. As a developer, I want `ui-alert` with tones and `ui-tip`, so that inline messages look the same everywhere.
19. As a developer, I want `ui-empty` and `ui-error-state` with a retry output, so that every list and every failed load renders a consistent state.
20. As a developer, I want `ui-page-header` with eyebrow, title, description, actions and breadcrumb slots, so that every page starts the same way.
21. As a developer, I want `ui-breadcrumb` with the current page marked, so that navigation is announced correctly.
22. As a developer, I want a `uiTooltip` directive on a CDK overlay, so that icon buttons show a real tooltip on hover and focus.
23. As a developer, I want a menu built on `@angular/aria`, so that row actions and the user menu have correct keyboard behaviour.
24. As a developer, I want a `confirm()` helper returning `Observable<boolean>` on a CDK dialog, so that destructive actions ask for confirmation in one line.
25. As a developer, I want a drawer on CDK dialog as a side panel, so that the mobile sidebar and detail panels share focus trapping and Escape handling.
26. As a developer, I want a `Toaster` service that also announces text to screen readers, so that system feedback is visible and audible.
27. As a learner, I want error messages in Vietnamese with a retry button, so that I can recover from a failed load.
28. As a keyboard user, I want menus, dialogs and drawers to trap and restore focus, so that I never lose my place.
29. As a screen-reader user, I want toasts announced and field errors linked to their fields, so that I hear what went wrong.
30. As a judge, I want the design system page to demo these pieces in light and dark, so that I can assess them like the mockup's.
31. As a tech lead, I want each piece's checklist entry updated in its own pull request, so that the progress board stays true.

## Implementation Decisions

- **Contract toolkit.** `defineEndpoint` captures method, path (always starting `/api/`), summary, optional params/query/body schemas, response schema and declared error statuses; `toUrl` fills path params. `ApiErrorSchema` is `{ message, details? }` where details maps field names to messages. Lives in the contracts library's http module.
- **Domain schemas.** One folder per domain mirroring `core/types.js`. This spec ports only the shared/identity domain: `RoleSchema`, `AccountStatusSchema`, `PublishStatusSchema`, unit, group, user, plus the auth domain's command and response schemas (login command, login result, profile, demo account). Other domains come with their screens.
- **Auth endpoints** keep the mockup's function names and its statuses: login 401/422/423, loginDemo 404/423, logout, profile 401, demoAccounts. Password rules stay server-side; the contract only types the payload.
- **Status 423 (locked/suspended)** is a declared status of the auth endpoints and maps to a dedicated `locked` application error kind, because the mockup shows a distinct message for it.
- **Fixtures** port the mockup seed's units, groups and users (all demo accounts in the README) and the auth responses. Error fixtures copy the mockup's Vietnamese messages. Computed values are fixed fixtures, never recomputed.
- **Mock server.** `build-spec` walks every endpoint registry, converts schemas with zod's JSON Schema output, attaches named examples (`default`, one per error status, one per role where the response depends on role), and keeps the health operation. Prism serves static examples chosen by `Prefer`.
- **App HTTP layer.** `parseResponse(schema)` operator throws `ContractError` carrying the zod issues; `toAppError(unknown)` is the only mapping from `HttpErrorResponse`, `ContractError`, status 0 and unknown errors to `AppError`. A global error handler reports unexpected errors. `AuthApi` is the first XApi service and the template for the rest.
- **UI pieces** follow the directive-first ladder and atomic levels: `uiTooltip` (behaviour directive, CDK overlay; `uiIconButton` switches from native `title` to it), `ui-field` + `ui-error-summary`, `ui-alert` + `ui-tip`, `ui-empty` + `ui-error-state`, `ui-breadcrumb` + `ui-page-header`, menu on `@angular/aria`, `ConfirmDialog` + `confirm()` and drawer on CDK Dialog, `Toaster` service + toast outlet on CDK overlay and `LiveAnnouncer`. Exact `@angular/aria` and CDK APIs are checked against the installed packages first.
- **Copy** for UI demos and error messages is Vietnamese from the mockup; `@lms/ui` takes text through inputs and holds no domain words.
- Each ticket replaces its "Chưa migrate" placeholders on `/design-system`, updates its checklist entries with owner and pull request, and lands as its own pull request.

## Testing Decisions

Tests assert external behaviour only: parsed results and validation errors, URLs built, HTTP calls made and their results, mapped error kinds, rendered DOM, ARIA, focus and emitted outputs. Seams, highest first:

1. **Contracts public API**: `toUrl`, schema parse/reject cases, every endpoint's declared statuses.
2. **Fixtures spec**: every fixture parses with its schema; demo accounts from the README exist.
3. **Mock server**: the generated OpenAPI document contains every endpoint with its examples; one smoke request per auth endpoint against Prism in the `serve` target is checked manually and recorded in the pull request.
4. **App HTTP seam**: `AuthApi` with `HttpTestingController`, using fixtures from `@lms/mocks` (spec-only dependency), covering success, contract mismatch and each declared error mapped through `toAppError`. Prior art: `api-base-url.interceptor.spec.ts`.
5. **`@lms/ui` public API**: one spec per piece through a host component, as in the existing atom specs (`button.directive.spec.ts`, `segmented.spec.ts`): ARIA wiring, keyboard, focus trap/restore for overlays, outputs, announcements.
6. **`/design-system` route spec**: placeholders replaced by demos for every completed piece.

## Out of Scope

- Session store, `roleGuard`, app shell and layouts, error pages, login screen, dev toolbar (next spec, built on this one).
- Domain schemas other than identity and auth; molecules and organisms not listed (data table, tabs, pagination, stepper, tree, charts, rating, KPI, option card, dropzone, search).
- Fixing the gaps found after the foundation review (production bundle containing the board and owners, missing pull request links, board layout at 375 px): tracked separately.

## Further Notes

- Contracts and mocks tickets and UI tickets have no edges between them, so two people can work the two tracks in parallel.
- When the session spec starts, its login screen uses `ui-field`, `ui-error-summary`, `ui-alert` and `AuthApi` from here unchanged.
