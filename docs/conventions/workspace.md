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
| File hashing       | `@noble/hashes` (exact version, user-approved): an incremental SHA-256 for chunked uploads, run in a Web Worker (`*.worker.ts`, typed by `apps/lms/tsconfig.worker.json`, bundled by `webWorkerTsConfig`)           |
| Mock API           | in-app interceptor over `@lms/mocks` fixtures (development only), no server process                                                                                                                                 |
| Font               | Be Vietnam Pro only, weights 400, 500 and 600, self-hosted (`@fontsource/be-vietnam-pro` in `apps/lms/project.json` styles); internal networks may block Google Fonts                                               |

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

| Script                                          | Does                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm start` · `npm run dev`                     | the app on :4200 against the in-app mock API (same command)                  |
| `npm run build` · `build:staging` · `build:dev` | app build per environment → `dist/apps/lms`, `dist/apps/lms-staging`         |
| `npm test` · `test:watch` · `test:coverage`     | Vitest across all projects; watch uses the root `vitest.config.mts`          |
| `npm run lint` · `lint:fix` · `typecheck`       | across all projects                                                          |
| `npm run format` · `format:check`               | Prettier                                                                     |
| `npm run check`                                 | full checks on every project, including format and tests: run before pushing |
| `npm run ci:check`                              | CI only: `nx affected -t lint typecheck build check-bundle`, no unit tests   |
| `npm run ci:build`                              | CI only: production + staging builds                                         |

### Local FE with the shared SCORM player

Run `npm run dev:scorm` and open **http://localhost:4200**. Restart any existing Angular dev server
before using this command. It uses the shared API at `https://chanacademy.io.vn` and the existing player
at `https://chanacademy.io.vn:8020`; Java, the server environment and Nginx remain unchanged.

The Angular dev proxy routes only the authenticated SCORM launch endpoint through a loopback relay.
The returned player URL uses `http://127.0.0.1:8020`, a different origin from Angular. The relay forwards
SCORM files and runtime requests to the shared player, adapting the embedding policy and bootstrap
parent origin to the local FE. Runtime scores, bookmarks, enrollment/lesson IDs and sequence numbers
remain server-owned and unchanged. The player relay never forwards LMS bearer tokens or cookies to
package content/runtime. Only the launch API receives the existing Authorization header.

For another Angular port, use `npm run dev:scorm -- --port 4311` and open **http://localhost:4311**.
If the local player port is occupied, set `$env:LMS_SCORM_DEV_PORT="8021"` in PowerShell before starting.
Optional `LMS_API_TARGET` and `LMS_SCORM_TARGET` select API/player upstream origins. `LMS_DEV_ORIGIN`
must match the exact local FE address when using `127.0.0.1` instead of `localhost`.

The relay binds only to `127.0.0.1`, allows only the SCORM launch/player routes, and validates the
local request origin. It is loaded only by the opt-in development proxy configuration and never
included in app builds. Normal `npm start` and production still use the server's original launch URLs.
Run `npm run test:scorm-proxy` for the local relay integration checks.

### Run against a local backend

To work with no network at all, run the backend from `~/my-projects/corebanking-academy` on this machine, with its
own Postgres and S3 (MinIO) in Docker. The backend's `docs/sql/README.md`, section "Chạy local", has the steps:
`compose.local.yaml`, `scripts/local-db-init.sh` (baselines and demo data), `mvn spring-boot:run` with `.env.local`
loaded, then `scripts/local-seed-media.sh` and `scripts/local-smoke.sh`. Then, here:

```bash
LMS_API_TARGET=http://localhost:8019 npm start
```

`apps/lms/proxy.conf.mjs` already reads `LMS_API_TARGET`; no code changes. The `lms-local` entry in
`.claude/launch.json` starts the same server for the browser preview.

Sign in with the seeded accounts: `hocvien` (learner), `giangvien` (instructor), `quantri` (admin), `quantri.ban`
(unit admin), `baocao` (report viewer). Their password is in the backend's `docs/sql/README.md` ("Đăng nhập demo")
and in its git-ignored `.env.local` as `LOCAL_DEMO_PASSWORD`. The local data has the `FE-DEMO-*` courses, quizzes
in two of them, and the course `DEMO-MEDIA` with a PDF and a video lesson.

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
  from `mockApi`, which is true only in development: the mock API and its fixtures (it answers only
  the endpoints the backend lacks) are wired from `environment.ts` alone. `mockBackend` is a
  spec-only flag that no environment file sets.
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
  restore `.nx/cache` → `npm run ci:check` (affected lint, typecheck, build and
  bundle guard; they block deploy on failure), then `npm run guard:design`
  (the visual-design guards, visual-design.md → Drift guard). CI runs no other
  unit tests; run `npm run check` locally. The workflow sets `SKIP_FORMAT_CHECK:
'true'`; set it to `'false'` to restore `npm run format:check`.
- **image** (parallel with check): buildx build of the root `Dockerfile` with
  the GitHub Actions layer cache (the `npm ci` layer is reused), which runs
  the production build and stamps `version.txt` with the commit. On push to
  `main` the image is pushed to `ghcr.io/hienne/lms-vip-pro-max` and its
  digest handed to deploy; PRs only build it.
- **deploy** (push to `main`, needs both check and image): SSH to the Ubuntu server with the
  `UBUNTU_FE_DEPLOY_SSH_KEY` secret. The key's forced command runs the
  root-owned FE deploy script, which copies the image's `/artifact` into the
  Nginx web root, verifies it and rolls back on failure. The job then checks
  that the public `/version.txt` equals the commit.

PR runs are cancelled by newer pushes; `main` runs never are, so a deploy is
not interrupted mid-copy.

A new check belongs in a `package.json` script first, then in the workflow.
`npm run check` remains the full local verification command; the CI skip flags
do not disable local formatting checks or tests.

`apps/lms/proxy.conf.mjs` maps `/api` to the shared backend server, `http://103.121.90.119:8019`
(`corebanking-academy`); start the server with `LMS_API_TARGET=http://localhost:8019 npm start` to use a backend on
this machine. App code only ever uses relative `/api/...` URLs: in development the proxy forwards the
calls the mock does not answer, and staging and production are served by an Nginx reverse proxy
that forwards `/api/` to the backend on the same origin (infrastructure, not code).
