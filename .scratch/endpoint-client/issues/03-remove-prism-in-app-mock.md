# 03: Remove Prism and OpenAPI; in-app dev mock

**What to build:** `npm start` runs the app against an in-app mock with no second process. `apps/mock-api`, `@stoplight/prism-cli` and the `mock` script are deleted, and `dev` becomes `nx serve lms`. The proxy target is marked `TODO(backend)`. `defineEndpoint` loses `errors`, `ErrorStatus` and `summary` (moved to doc comments), and contracts lose `endpointRegistries`. `ApiErrorSchema` is marked provisional. `@lms/mocks` keeps its fixtures, drops the per-status and "every endpoint has an example" checks, and exports `MOCK_FIXTURES` keyed by endpoint object. `mockApiInterceptor` (`core/dev/mock-api/`) answers tagged requests with `roles[role] ?? default` from `MockScenario`; an endpoint without a fixture falls through with one warning. The `Prefer` logic and `ROLE_EXAMPLE_ENDPOINTS` are removed, and the offline simulation stays as its own interceptor. `mockScenarios` is renamed `mockApi`. Only `environment.ts` imports the mock module, under a narrow ESLint override; the order is offline → mock → `apiBaseUrl`. The toolbar role select shows only when `mockApi` is true. The bundle check gets a fixture marker. See spec: `docs/specs/endpoint-client.md`, Removing Prism and OpenAPI / `@lms/mocks` / In-app dev mock.

**Blocked by:** 02 (every call goes through the client, so every request is tagged)

**Status:** done

- [x] `mock-api.interceptor.spec.ts`: lookup by object; role example then default; unknown or untagged endpoint falls through with one warning; offline wins over the mock
- [x] Fixture schema specs still pass; removed checks are gone, not skipped
- [x] ESLint: only `environment.ts` and `core/dev/mock-api/**` may import `@lms/mocks` outside specs; `type:mock-server` constraint gone
- [x] Production and staging builds pass the bundle check with the fixture marker; a dev build fails it (the check is proven)
- [x] Smoke test with `npm start`: sign in, users, org, roles, switch role in the toolbar, offline simulation
- [x] `npm run check` green

## Notes and deviations

- `proxy.conf.json` became `proxy.conf.mjs`: JSON cannot carry the `TODO(backend)` comment, and a `"//"` key would be read as a proxy context. `project.json` points at it. The target is a placeholder (`http://localhost:3000`).
- The ESLint override uses `**/src/environments/environment.ts` and `**/src/app/core/dev/mock-api/**/*.ts`: flat-config `files` resolve relative to the project's own `eslint.config.mjs`, so root-relative paths never matched. A probe file in `core/` importing `@lms/mocks` still fails lint.
- `DEV_FEATURES.interceptors` (the offline simulation) is now registered unconditionally (production's is empty), so the staging toolbar's offline switch works too; before it was tied to `mockScenarios`. Order: offline → mock (only when `mockApi`) → `apiBaseUrl`.
- The toolbar's role list ("Đăng nhập nhanh theo vai trò") is hidden when `mockApi` is false; offline, session-expired and forbidden-URL entries stay.
- Bundle check: `--fixtures-only` checks staging (which keeps the dev toolbar on purpose) for the fixture marker `admin@demo.cb` only; the `check-bundle` target builds staging and runs both checks. A development build fails the check (proven).
- Fixtures: `endpointExamples` stays keyed by registry key (specs use it); `MOCK_FIXTURES` is derived from the registries `@lms/mocks` lists itself. A spec checks every example key belongs to a registered endpoint.
- Smoke test (in-app mock, `npm start`): sign-in form, users, org, roles, role switch admin → unit admin (org shows one unit), offline simulation on/off, session-expired → `/login?next=`. No `/api` request left the browser. Pre-existing, not touched: while offline is simulated the shell's `inboxCount$` logs `ResourceValueError` from the nav-counts resource.
