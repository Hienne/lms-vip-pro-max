# 03: Remove Prism and OpenAPI; in-app dev mock

**What to build:** `npm start` runs the app against an in-app mock with no second process. `apps/mock-api`, `@stoplight/prism-cli` and the `mock` script are deleted, and `dev` becomes `nx serve lms`. The proxy target is marked `TODO(backend)`. `defineEndpoint` loses `errors`, `ErrorStatus` and `summary` (moved to doc comments), and contracts lose `endpointRegistries`. `ApiErrorSchema` is marked provisional. `@lms/mocks` keeps its fixtures, drops the per-status and "every endpoint has an example" checks, and exports `MOCK_FIXTURES` keyed by endpoint object. `mockApiInterceptor` (`core/dev/mock-api/`) answers tagged requests with `roles[role] ?? default` from `MockScenario`; an endpoint without a fixture falls through with one warning. The `Prefer` logic and `ROLE_EXAMPLE_ENDPOINTS` are removed, and the offline simulation stays as its own interceptor. `mockScenarios` is renamed `mockApi`. Only `environment.ts` imports the mock module, under a narrow ESLint override; the order is offline → mock → `apiBaseUrl`. The toolbar role select shows only when `mockApi` is true. The bundle check gets a fixture marker. See spec: `docs/specs/endpoint-client.md`, Removing Prism and OpenAPI / `@lms/mocks` / In-app dev mock.

**Blocked by:** 02 (every call goes through the client, so every request is tagged)

**Status:** open

- [ ] `mock-api.interceptor.spec.ts`: lookup by object; role example then default; unknown or untagged endpoint falls through with one warning; offline wins over the mock
- [ ] Fixture schema specs still pass; removed checks are gone, not skipped
- [ ] ESLint: only `environment.ts` and `core/dev/mock-api/**` may import `@lms/mocks` outside specs; `type:mock-server` constraint gone
- [ ] Production and staging builds pass the bundle check with the fixture marker; a dev build fails it (the check is proven)
- [ ] Smoke test with `npm start`: sign in, users, org, roles, switch role in the toolbar, offline simulation
- [ ] `npm run check` green
