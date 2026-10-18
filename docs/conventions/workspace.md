# Workspace (Nx)

Project-specific layout. It overrides `angular.md` §4 where they differ: the
generic `src/app/shared/ui/` is replaced by the `libs/ui` design-system library.

## Layout

```text
apps/
└── lms/                          # the Angular app        tags: type:app
    └── src/app/
        ├── app.ts / app.config.ts / app.routes.ts
        ├── core/                 # interceptors, guards, ErrorHandler, session, AppError, env config
        ├── layout/               # app shell (sidebar + header), focus layout, bare layout
        ├── shared/               # domain-aware presentational UI built from @lms/ui
        │                         #   (course-card, course-status, role-badge, due-date…)
        └── features/             # one folder per feature, route modules inside (angular.md §4);
                                  #   list in docs/migration/mockup-to-angular.md → Feature mapping
libs/
├── ui/                           # @lms/ui — design system, domain-agnostic   tags: type:ui
├── contracts/                    # @lms/contracts — zod schemas + endpoint registry   tags: type:contracts
└── mocks/                        # @lms/mocks — typed fixtures ported from the mockup seed   tags: type:mocks
lms-mockup/                       # read-only reference, never imported or built
docs/
```

## Where does it go?

| You are adding…                                                                         | Location                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Token, atom, molecule, organism, generic pipe/directive (no LMS domain words)           | `libs/ui` — see `ui-library.md`                         |
| UI that knows a domain type (`Course`, `Role`, `PublishStatus`…) but holds no state     | `apps/lms/src/app/shared/`                              |
| Wire schema, request/response type, endpoint definition                                 | `libs/contracts` — see `contracts-and-mocks.md`         |
| Fixture / example payload                                                               | `libs/mocks`                                            |
| View model, command or adapter used by one route or one feature                         | narrowest `data-access/` in `features/` (angular.md §4) |
| Interceptor, guard, global error handling, session                                      | `apps/lms/src/app/core/`                                |
| Data-access primitive every store uses (`serverData`, `serverMutation`, `invalidation`) | `apps/lms/src/app/core/data-access/`                    |

The test for `libs/ui` versus `shared/`: if the code would make sense in a
different product (a bank's HR app), it belongs in `libs/ui`.

## Module boundaries

`@nx/enforce-module-boundaries` enforces these `depConstraints`:

| Source tag       | May depend on               |
| ---------------- | --------------------------- |
| `type:app`       | `type:ui`, `type:contracts` |
| `type:ui`        | `type:ui`                   |
| `type:contracts` | — (only `zod`)              |
| `type:mocks`     | `type:contracts`            |

`*.spec.ts` files in `type:app` and `type:ui` get an ESLint override that adds
`type:mocks`, so tests reuse fixtures while production bundles never contain them.
`*.testing.ts` helpers, imported only by specs, get the same override.
The one other exception is the in-app mock API: `apps/lms/src/environments/environment.ts` and
`apps/lms/src/app/core/dev/mock-api/**` may depend on `type:mocks` too (a narrow override in
`eslint.config.mjs`); no other app file may, and the staging and production environment files
import nothing from the mock.
Inside `apps/lms`, angular.md §4 import rules apply (features never import each
other's internals; `shared/` never imports `features/`; `core/` imports `features/` only
through a lazy `import()`, enforced by a `no-restricted-imports` block in `eslint.config.mjs`).

Path aliases: `@lms/ui`, `@lms/contracts`, `@lms/mocks`. Import from the alias,
never from a relative path into another project.

## Tooling

| Concern            | Choice                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime            | Node 24 LTS (`.nvmrc`; Angular 22 rejects odd Node majors such as 23)                                                                                                                                               |
| Framework          | Angular 22, standalone, zoneless                                                                                                                                                                                    |
| Monorepo           | Nx 23, npm; `lint` and `test` are inferred targets (`@nx/eslint/plugin`, `@nx/vitest`); `typecheck` is declared per project (`tsc --noEmit` on its lib/app and spec tsconfigs, because Vitest does not type-check)  |
| Unit tests         | Vitest + jsdom. Angular projects use the Analog plugin (`vitest-analog`, ≥ 2.8 for Angular 22.2); plain TS libs use plain Vitest. The Angular `unit-test` builder is not used: it only supports buildable libraries |
| Styles             | SCSS only: the `ui` Sass module of `@lms/ui` (token maps, functions, mixins) on the Sass include path `libs/ui/src/styles`; no PostCSS step, no utility framework                                                   |
| Accessible widgets | `@angular/aria`, `@angular/cdk`                                                                                                                                                                                     |
| Icons              | `@lucide/angular` (successor of the deprecated `lucide-angular`)                                                                                                                                                    |
| Validation / types | `zod` (v4 API)                                                                                                                                                                                                      |
| Mock API           | in-app interceptor over `@lms/mocks` fixtures (development only), no server process                                                                                                                                 |
| Font               | Be Vietnam Pro, self-hosted (`@fontsource/be-vietnam-pro`); internal networks may block Google Fonts                                                                                                                |

Adding any other runtime dependency needs the user's approval. Pre-styled UI
kits (Material, PrimeNG, Spartan…) are out. The style library's compile test uses the
`sass` package that Angular's build already installs; it is not a declared dependency.

Generator defaults live in `nx.json`. Generated files still drift between Nx
versions: check them against angular.md §2 and delete generator samples before
committing. Vitest resolves the `@lms/*` aliases with Vite's native
`resolve.tsconfigPaths: true`; the Nx `nxViteTsPaths` / `nxCopyAssetsPlugin`
helpers are deprecated and not used.

## Commands

Use the `package.json` scripts with Node 24 active (`nvm use`); for a single
project run the Nx target directly (`npx nx test ui`).

| Script                                          | Does                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm start` · `npm run dev`                     | the app on :4200 against the in-app mock API (same command)                     |
| `npm run build` · `build:staging` · `build:dev` | app build per environment → `dist/apps/lms`, `dist/apps/lms-staging`            |
| `npm test` · `test:watch` · `test:coverage`     | Vitest across all projects; watch uses the root `vitest.config.mts`             |
| `npm run lint` · `lint:fix` · `typecheck`       | across all projects                                                             |
| `npm run format` · `format:check`               | Prettier                                                                        |
| `npm run check`                                 | everything CI checks, on every project: run before pushing                      |
| `npm run ci:check`                              | CI only: `nx affected -t lint typecheck test build` (needs `NX_BASE`/`NX_HEAD`) |
| `npm run ci:build`                              | CI only: production + staging builds                                            |

## Environments

| Configuration                        | Environment file                           | Built by                         |
| ------------------------------------ | ------------------------------------------ | -------------------------------- |
| `development` (serve default, tests) | `apps/lms/src/environments/environment.ts` | `npm start`, `npm run build:dev` |
| `staging`                            | `environment.staging.ts`                   | `npm run build:staging`          |
| `production` (build default)         | `environment.production.ts`                | `npm run build`                  |

- `fileReplacements` in `apps/lms/project.json` swap `environment.ts` for the
  configuration's file. Adding an environment means a file, a build
  configuration (with its own `outputPath`), and a `serve` configuration.
- Each file is an `AppConfigInput`; `provideAppConfig` parses it with
  `AppConfigSchema` (`apps/lms/src/app/core/config/app-config.ts`) at bootstrap
  and provides `APP_CONFIG`. A new setting is added to the schema first, then to
  every environment file; the spec checks all three parse.
- `devTools` turns on internal tooling for the team: the migration progress board route
  (`/dev/migration`, registered by `createAppRoutes` only when true) and owner / pull request
  details in the `/design-system` placeholders. True in development and staging, false in
  production, so internal names and pull request links never reach end users. It is separate
  from `mockApi` and `mockBackend`, which are true only in development: the mock API, its fixtures
  and the seeded in-memory backend (`mockBackend`: it answers the endpoints the backend has) are
  wired from `environment.ts` alone.
- Everything that exists only for the team (the migration board route, the dev toolbar, the
  offline simulation) hangs off one object, `DEV_FEATURES` in
  `apps/lms/src/app/core/dev/dev-features.ts`. The production build replaces that file with
  `dev-features.production.ts` (empty) through `fileReplacements`, so none of it is bundled;
  the config flags only decide whether staging and development use it (the offline simulation in
  `DEV_FEATURES.interceptors` is registered whenever the object has one, and the mock API only
  when `mockApi` is true). Add new team-only code
  there, never behind a runtime `if` alone. `npm run check` runs `lms:check-bundle`
  (`tools/check-production-bundle.mjs`), which fails if the production output contains the
  toolbar, the board or any mock fixture, and builds staging to check that it holds no fixtures. Known gap: the migration registry data
  (`migration-entries.data.ts`, with owner handles) still ships because the design-system
  placeholders read statuses from it; it is hidden at runtime by `devTools`.
- There is no API origin setting: the app always calls `/api/...` on its own origin, so
  endpoint paths in `@lms/contracts` stay environment-free and `EndpointClient` never reads
  the config. Serving the API on another origin would need a base-URL interceptor and CORS on
  the backend; add them only when a deployment actually needs it.
- Environment files ship to the browser: no secrets, tokens or credentials.

## CI (GitHub Actions)

`.github/workflows/ci.yml`:

- **check** (every PR and push to `main`): `npm ci` → `nx-set-shas` →
  restore `.nx/cache` → `npm run format:check` → `npm run ci:check`.
- **image** (after check): `docker build` of the root `Dockerfile`, which runs
  the production build and stamps `version.txt` with the commit. On push to
  `main` the image is pushed to `ghcr.io/hienne/lms-vip-pro-max` and its
  digest handed to deploy; PRs only build it.
- **deploy** (push to `main`): SSH to the Ubuntu server with the
  `UBUNTU_FE_DEPLOY_SSH_KEY` secret. The key's forced command runs the
  root-owned FE deploy script, which copies the image's `/artifact` into the
  Nginx web root, verifies it and rolls back on failure. The job then checks
  that the public `/version.txt` equals the commit.

PR runs are cancelled by newer pushes; `main` runs never are, so a deploy is
not interrupted mid-copy.

A new check belongs in a `package.json` script first, then in the workflow, so
`npm run check` and CI never disagree.

`apps/lms/proxy.conf.mjs` maps `/api` to the shared backend server, `http://103.121.90.119:8019`
(`corebanking-academy`); change the target to `http://localhost:8019` to use a backend on this
machine. App code only ever uses relative `/api/...` URLs: in development the proxy forwards the
calls the mock does not answer, and staging and production are served by an Nginx reverse proxy
that forwards `/api/` to the backend on the same origin (infrastructure, not code).
