# Core Banking Academy — Angular LMS

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

- `npm start`: app on :4200 against the in-app mock API.
- `npx nx test <project>` (`lms`, `ui`, `contracts`, `mocks`): one project's specs.
- `npm run check`: format, lint, typecheck, test, build and bundle guard on every project.

## Docs

Project docs override `docs/conventions/angular.md` where they differ. Read the
matching doc before starting the work it covers:

- `docs/conventions/angular.md`: before writing any Angular code (component, store, form, effect, route, test).
- `docs/conventions/workspace.md`: before creating a project, library, folder or Nx target, or adding a dependency.
- `docs/conventions/ui-library.md`: before building or restyling reusable UI, tokens, icons or overlays.
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
- **Business rules stay on the server.** Scoring, progress %, permissions and
  unit scope in the mockup's `api/*.js` are backend spec; the app renders
  server results and uses roles only for navigation and display.
- **Store owns state.** Components render store selectors and call store
  commands (angular.md §5).

## Done

A task is done when `npm run check` is green, the
angular.md §14 checklist passes, and any converted screen passes the verify
step in `docs/migration/mockup-to-angular.md`. Report what was verified and how.
