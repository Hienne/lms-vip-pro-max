# CHAN Academy — Angular LMS

Internal training LMS for Ban QL&PT Core Banking, rebuilt in Angular from the
HTML/JS mockup in `lms-mockup/` (read-only spec; its README maps checklist
items to routes and lists the demo accounts).

UI copy is Vietnamese, taken from the mockup. Code, identifiers, comments,
commits and docs are English.

**Stack:** Angular 22 (standalone, zoneless, signals, Signal Forms) · Nx ·
zod · `@angular/aria` + `@angular/cdk` · SCSS only (the `ui` Sass module) ·
`@lucide/angular` · Vitest · in-app mock API. Node 24 (`.nvmrc`).

Before using any API, check the installed version in `package.json` and its
local type definitions; these libraries change between majors.

## Commands

Run `nvm use` first (Node 24). Full table in `docs/conventions/workspace.md`.

- `npm start`: app on :4200. The in-app mock API answers only the endpoints the backend lacks;
  everything else (sign-in included) goes through `apps/lms/proxy.conf.mjs` to the shared backend.
  There is no seeded-mock mode of the running app: sign in with a real account.
- **Backend:** if the task does not change the backend, use the shared server (the default
  `npm start` proxy) and do not start a local backend (`lms-local-backend`, the local stack). To
  use a backend on this machine, run `LMS_API_TARGET=http://localhost:8019 npm start`; start one
  only when the task edits backend code.
- `npx nx test <project>` (`lms`, `ui`, `contracts`, `mocks`): one project's specs.
- `npm run check`: format, lint, typecheck, test, build and bundle guard on every project.
  It is heavy (vitest uses every core, about 1.3 GB per worker, beside the build), and on a
  16 GB machine it can exhaust memory and swap until it looks hung. Before running it:
  - stop `nx serve` / preview servers and idle Nx daemons (`npx nx daemon --stop`);
  - run it in the background with output to a file, and run it once, not alongside another
    `nx` or `vitest` run;
  - if the machine is short on memory, run `npx nx run-many -t lint typecheck test build check-bundle --parallel=1`
    after `npm run format:check`.

  Read its result from the output file when it finishes. Do not wait on it with a `grep` loop:
  `format:check` failing stops the chain before any `nx` text appears, so the loop never ends.
  Look for the final `EXIT` code or the first `[warn]` / `✖` line instead.

## Docs

Project docs override `docs/conventions/angular.md` where they differ. Read the
matching doc before starting the work it covers:

- `docs/conventions/angular.md`: before writing any Angular code (component, store, form, effect, route, test).
- `docs/conventions/workspace.md`: before creating a project, library, folder or Nx target, or adding a dependency.
- `docs/conventions/ui-library.md`: before building or restyling reusable UI, tokens, icons or overlays.
- `docs/conventions/visual-design.md`: before building or restyling any UI, converting a mockup screen, or writing UI copy.
- `docs/conventions/contracts-and-mocks.md`: before touching an endpoint, schema, model, fixture, the mock API or error handling.
- `docs/migration/mockup-to-angular.md`: before converting a mockup screen or component.

## Always

- **Directive first, atomic levels.** Style or behaviour on a native element is
  an attribute directive; a component only when it owns DOM. Imports point down
  the atomic levels only.
- **Zod is the contract.** Types come from `z.infer`; every HTTP response is
  parsed by its endpoint schema.
- **Tokens only.** Colours, spacing, radius, type and motion come from the
  token maps through the `ui` Sass module (`ui.color(primary)`, `ui.space(3)`):
  an unknown key fails the build and a colour literal outside the token source
  fails the guard spec.
- **Look from `@lms/ui`, layout in the feature.** A feature stylesheet arranges (grid, gap,
  width); shape, shadow, font, small print and fills come from the atoms and organisms. Every page
  title is `ui-page-header`. A new screen copies the structure of `/progress`
  (`features/achievements/progress`), not of an older neighbour. A new screen uses `ui-section-card`
  (titled panels), `ui-stat-strip` + `ui-stat` (figure rows), `ui-list-row` in `ul[uiList]` (link
  lists) and `uiTableCell` / `uiTableCol` (tables that do not wrap), never a hand-styled card header,
  figure row or list row (ui-library.md → Screen building blocks). `npm run guard:design` enforces
  this (visual-design.md → Drift guard) and runs in CI.
- **Designed, not generated.** Nothing that
  `docs/conventions/visual-design.md` lists: no eyebrows, icon tiles, heroes,
  gradients, coloured edge stripes, badge soup, or status colours used for
  decoration, even where the mockup or a neighbouring file has them.
- **Business rules stay on the server.** Scoring, progress %, permissions and
  unit scope in the mockup's `api/*.js` are backend spec; the app renders
  server results and uses roles only for navigation and display.
- **Store owns state.** Components render store selectors and call store
  commands (angular.md §5).

## Done

A task is done when `npm run check` is green, `npm run guard:design` passes without raising the
drift baseline, the
angular.md §14 checklist passes, any UI change contains nothing that
`docs/conventions/visual-design.md` lists, and any converted screen passes the verify
step in `docs/migration/mockup-to-angular.md`. Report what was verified and how.

## Shared database rule

The shared development PostgreSQL database is `appdb`, schema `learning_hub`. The backend connects with the PostgreSQL role `dev_user`. Angular must never connect to PostgreSQL directly or contain database credentials; all data access goes through the backend API. For database/schema work, make changes in the backend repository and preserve `dev_user` access.
