# Spec: Endpoint client and in-app mock API

Status: ready for implementation · Labels: `ready-for-agent`

## Problem Statement

Every endpoint is declared once in `@lms/contracts` with its method, path,
params, body and response schema. Then each one is written out a second time by
hand in an API service (`AdminOrgApi`, `AuthApi`, `NavCountsApi`: 22 methods).
Every method repeats the same ritual:
`http.<verb><unknown>(toUrl(endpoint, …), body).pipe(parseResponse(endpoint.response))`.
The verb is typed again, so it can drift from the registry without a compile
error. `query` is declared in `defineEndpoint` but nothing sends it. Every new
screen (courses, exams, reports) adds more of these methods.

When a response does not match its schema, `parseResponse` throws a
`ContractError` with the exact zod issues. Then `serverData`/`serverMutation`
hold it inside `rxResource`, and `toAppError` turns it into "Dữ liệu trả về
không hợp lệ…". The global `ErrorHandler` never sees it, so a developer has no
trace of which field was wrong.

In development the app talks to Stoplight Prism, which serves an OpenAPI
document built from the registry plus `@lms/mocks`. Keeping that document
complete costs a declared error-status list on every endpoint, an example per
status, a `summary`, a registry index, a separate process and a proxy. The
backend will be integrated soon and directly, so the OpenAPI pipeline no longer
earns its cost. A real backend may return any status from any endpoint anyway.

The mockup also has file uploads (`replaceFile`, files in lesson blocks) and a
data export (`exportAll`). The current API-service shape has no way to send
`FormData` or receive a file, and there is no helper to save a downloaded file.

## Solution

- One **`EndpointClient`** in the app's `core/http` with a single method,
  `call(endpoint, input)`. It takes the verb, URL, query, body encoding and
  response type from the endpoint definition, parses the response with the
  endpoint schema, reports contract mismatches to `ErrorHandler`, and tags each
  request with its endpoint through an `HttpContextToken`. Stores call it
  directly. The three API services and their specs are deleted.
- **JSON by default; multipart and blob are opt-in per endpoint** through two
  new optional fields on `defineEndpoint`. A **`FileSaver`** service saves a
  downloaded `Blob` under a name the store chooses.
- **Prism and the OpenAPI build are removed.** The registry loses `errors`,
  `ErrorStatus`, `summary` and `endpointRegistries`. `@lms/mocks` stays as
  typed fixtures for specs, plus a fixture map keyed by endpoint object.
- **An in-app dev mock** replaces Prism: an interceptor that answers each
  tagged request with its fixture (by role, chosen in the dev toolbar). It is
  wired only from the development environment file, so staging and production
  bundles never contain fixtures.

## User Stories

1. As a learner or administrator, I want every screen to behave exactly as today against the same responses, so that the refactor costs me nothing.
2. As a user, I want the same Vietnamese error messages as today when a call fails, so that nothing I read changes.
3. As an administrator, I want a downloaded export to be saved as a file with a meaningful name, so that I can find it on my computer.
4. As an administrator, I want to upload a file (lesson attachment, replacement file) as a real file, not a text-encoded copy, so that large files upload reliably.
5. As a developer, I want to call an endpoint with one line from the store, so that adding an endpoint needs no service method and no service spec.
6. As a developer, I want the compiler to require `params`, `query` or `body` exactly when the endpoint declares them, so that a missing path param or a body on a GET cannot compile.
7. As a developer, I want the result typed from the endpoint's response schema, so that I never annotate it by hand.
8. As a developer, I want the HTTP verb to come only from the registry, so that changing `put` to `patch` is a one-line change that cannot drift.
9. As a developer, I want query objects turned into a query string with one documented rule (skip null/undefined, repeat the key for arrays), so that list filters behave the same everywhere.
10. As a developer, I want the body sent as the store passes it, without a second validation on the client, so that schema transforms never rewrite my payload silently.
11. As a developer, I want a response that breaks the contract reported to `ErrorHandler` with its zod issues, so that I see which field was wrong in the console.
12. As a developer, I want the user to still see the usual Vietnamese contract message, so that reporting does not change the UI.
13. As a developer, I want to mark an endpoint `encoding: 'multipart'` and still pass a typed object, so that the store never builds `FormData` by hand.
14. As a developer, I want a nested object in a multipart body to fail loudly, so that I do not guess an encoding the backend does not read.
15. As a developer, I want to mark an endpoint `responseType: 'blob'` and receive a `Blob`, so that downloads need no special client code.
16. As a developer, I want one `FileSaver.save(blob, filename)` call in a mutation's `onSuccess`, so that saving a file is not reimplemented per screen.
17. As a developer, I want `npm start` to run the app against an in-app mock with no second process, so that I can click through screens before the backend exists.
18. As a developer, I want to switch the mocked role in the dev toolbar, so that I can see what an admin, unit admin, instructor, viewer or learner sees.
19. As a developer, I want the offline simulation to keep working while mocking, so that I can still check the offline state.
20. As a developer, I want an endpoint without a fixture to fall through to the network with a single console warning, so that partial mocking is possible and visible.
21. As a developer, I want to turn the mock off with one flag and use a backend through the proxy, so that integrating the real backend needs no code change.
22. As a reviewer, I want the production and staging bundles proven free of fixtures, so that demo data never ships.
23. As a reviewer, I want the store page specs to pass without edits, so that I can trust the migration preserved behaviour.
24. As a reviewer, I want the call mechanism tested once through `call`, so that I do not need 22 service specs.
25. As an AI agent working in this repo, I want angular.md and contracts-and-mocks.md to describe `EndpointClient` and the in-app mock, so that I do not recreate an API service or Prism.
26. As a maintainer, I want `ApiErrorSchema` marked provisional until the backend publishes its error schema, so that nobody treats the mockup's shape as final.
27. As a maintainer, I want the known limits recorded (blob errors show the default message; no stateful mock; no per-request error simulation), so that they are lifted deliberately later.

## Implementation Decisions

### Endpoint definition (`libs/contracts`)

- Remove `errors` and the `ErrorStatus` type. A real backend may answer any
  status; `toAppError` already maps by status alone.
- Remove `summary`; its text becomes a `/** */` comment on each registry key.
- Remove `endpointRegistries` (only the OpenAPI build read it).
- Keep `params`, `query`, `body`, `response`, `method`, `path`.
- Add `encoding?: 'json' | 'multipart'` (default `json`) and
  `responseType?: 'json' | 'blob'` (default `json`). A blob endpoint declares
  `response: z.instanceof(Blob)`, and the types require a Blob response
  schema when `responseType` is `'blob'`. File fields in a multipart body use
  `z.file()`.
- Each `*.endpoints.ts` file header says its keys follow the mockup's
  `api/*.js` function names (moved from the deleted API services).
- `ApiErrorSchema` gets a doc comment: provisional, mirrors the mockup's
  `ApiError` until the backend publishes its error schema.

### `EndpointClient` (`apps/lms/src/app/core/http/endpoint-client.ts`)

- `@Service()`, stateless. One public method:
  `call<E>(endpoint: E, ...input: CallArgs<E>): Observable<z.output<E['response']>>`.
- `CallInput<E>` has `params`, `query` and `body`, each required when the
  endpoint declares it and forbidden (`?: never`) otherwise. An endpoint
  with none of them takes no second argument. Types come from `z.input` of
  each schema.
- Verb from `endpoint.method`; URL from `toUrl(endpoint, params)`.
- **Query:** not parsed. Converted to `HttpParams`: `null`/`undefined`
  skipped, arrays repeat the key, other values through `String(v)`.
- **Body, JSON:** sent exactly as passed, not parsed.
- **Body, multipart:** converted to `FormData`. The body must be flat:
  each value is `string | number | boolean | File | Blob` or an array of
  those. Arrays repeat the key, numbers and booleans become strings,
  `null`/`undefined` are skipped, and a nested object throws an `Error` (a
  client bug). The client never sets `Content-Type` for multipart.
- **Response:** `responseType: 'blob'` requests a blob. Every response,
  including a blob, is parsed with `endpoint.response`. On mismatch, a
  `ContractError` is created, passed to `ErrorHandler.handleError`, then
  thrown, so `toAppError` still yields the Vietnamese message.
- Every request carries the endpoint object in
  `ENDPOINT: HttpContextToken<AnyEndpoint | null>` (exported next to the
  client). Today only the dev mock reads it.
- `parseResponse` becomes an internal detail of the client (or is inlined).
- No builder and no per-call options. A per-call options bag may be added
  when a real need appears.
- Known limit: an HTTP error on a blob endpoint arrives as a `Blob` body, so
  `toAppError` shows the default message for its kind.

### Stores

- Every store that injected an API service injects `EndpointClient` and calls
  `client.call(xEndpoints.key, { … })` inside its `serverData` /
  `serverMutation` / `rxResource` factories: admin-org stores, session,
  login, profile, shell, dev toolbar.
- `AdminOrgApi`, `AuthApi`, `NavCountsApi` and their specs are deleted.

### `FileSaver` (`apps/lms/src/app/core/files/file-saver.ts`)

- `@Service()` with `save(blob: Blob, filename: string): void`. Uses
  `inject(DOCUMENT)`, `URL.createObjectURL`, a temporary `<a download>`,
  then `URL.revokeObjectURL`.
- Called by a store from a mutation's `onSuccess`. The store names the file;
  `Content-Disposition` is not read.

### Removing Prism and OpenAPI

- Delete `apps/mock-api` (build-spec and the Prism target) and the
  `@stoplight/prism-cli` dependency. Remove the `mock` script; `dev` becomes
  `nx serve lms`.
- `apps/lms/proxy.conf.json` keeps proxying `/api`, with its target marked
  `TODO(backend)` for the backend's dev origin.
- Remove `mockScenarioInterceptor`'s `Prefer` header logic and
  `ROLE_EXAMPLE_ENDPOINTS`. Keep the offline simulation as its own
  interceptor in `DEV_FEATURES.interceptors`.
- ESLint: drop the `type:mock-server` constraint.

### `@lms/mocks`

- Stays as typed fixtures: `default`, role examples and the mockup's specific
  error bodies (`loginLocked`, `saveUserInvalid` with field `details`, …),
  each parsed by its schema in a spec.
- The "every endpoint has an example" rule and the error-status cross-checks
  are removed.
- Exports `MOCK_FIXTURES: ReadonlyMap<AnyEndpoint, EndpointExamples>`, built
  from the registries that the mocks library lists itself.

### In-app dev mock

- `mockApiInterceptor` in `apps/lms/src/app/core/dev/mock-api/`. It reads
  `req.context.get(ENDPOINT)` and looks it up in `MOCK_FIXTURES` by object
  identity, then answers `200` with `roles[role] ?? default`, where `role` is
  `MockScenario.role$()`. No delay, no state, no per-request error
  simulation. A request without a fixture goes to `next(req)` and logs one
  `console.warn` per endpoint.
- Config: `mockScenarios` is renamed `mockApi` (`environment.ts` true;
  staging and production false).
- **Wiring (fixtures never in staging or production):** only
  `apps/lms/src/environments/environment.ts` imports the mock module, which
  imports `@lms/mocks`. The staging and production environment files do not,
  so their builds cannot contain it. `app.config.ts` registers the
  interceptor that the environment provides, when `mockApi` is true.
- Interceptor order: offline simulation → mock API → `apiBaseUrl`.
- ESLint: a narrow override lets
  `apps/lms/src/environments/environment.ts` and
  `apps/lms/src/app/core/dev/mock-api/**` depend on `type:mocks`. Every other
  app file keeps the existing rule.
- `tools/check-production-bundle.mjs` gets a fixture marker (for example
  `admin@demo.cb`). Both production and staging builds must pass that marker.
- Dev toolbar: the role select drives the mock and is shown only when
  `mockApi` is true. Against a real backend, switching role means signing in
  with a demo account (`loginDemo`). Offline, session-expired and
  forbidden-URL simulations stay.

### Docs

- `angular.md`: §5 diagram (`EndpointClient ─► Store ─► Component`), §5.1
  rewritten from "API service layer" to "Calling endpoints", naming table
  drops the `API service` row, §14 checklist line on API calls.
- `contracts-and-mocks.md`: remove OpenAPI, Prism, error lists and
  `summary`; add `encoding`/`responseType`, the multipart rule, the query
  rule, `EndpointClient`, the in-app mock and its wiring, the provisional
  `ApiErrorSchema` and the blob-error limit. Extension rule: a new transport
  kind is a new endpoint field plus a branch in the client, never a new API
  service or a direct `HttpClient` call in a store.
- `AGENTS.md` stack line: drop "Stoplight Prism mock API".
- `workspace.md`: remove `apps/mock-api` and `type:mock-server`; describe the
  mocks exception.
- `mockup-to-angular.md`: rows that mention XApi or Prism.

## Testing Decisions

Tests assert external behaviour through public interfaces only.

1. **Page and store specs (existing).** They already drive real stores
   against `HttpTestingController` with `@lms/mocks` fixtures. They must pass
   without edits, apart from replacing an injected API service where a spec
   provides one. The PR lists any other edit and why.
2. **`endpoint-client.spec.ts` (new; replaces `auth.api.spec` and
   `nav-counts.api.spec`).** Endpoints are declared inside the spec with
   `defineEndpoint`; no fake endpoint goes into the real registry. Covers:
   verb from the registry; path params; query rule; JSON body passed through
   unchanged; multipart conversion (flat values, arrays, skipped nulls, a
   nested object throws, no manual `Content-Type`); blob response;
   response mismatch → `ContractError` reaches `ErrorHandler` and the stream
   errors; `ENDPOINT` context set. Type-level cases (missing params, body on
   a GET) are checked with `@ts-expect-error`.
3. **`mock-api.interceptor.spec.ts` (new).** Lookup by endpoint object; role
   example, then default; untagged or unknown endpoint falls through with one
   warning; offline simulation wins over the mock.
4. **`file-saver.spec.ts` (new).** With a stub `DOCUMENT`: creates an object
   URL, clicks a link with the given `download` name, revokes the URL.
5. **Bundle check.** `npm run check` builds production; staging is checked
   with the new fixture marker.

Prior art: `server-data.spec.ts`, `server-mutation.spec.ts`,
`api-base-url.interceptor.spec.ts`, `mock-scenario.interceptor.spec.ts`.

## Out of Scope

- 401 in the middle of a session (end the session, go to `/login?next=`):
  separate work together with architecture review #04 (return-to module).
  It will be able to exempt `authEndpoints.profile` through the `ENDPOINT`
  context.
- A stateful mock, simulated latency, per-request error simulation.
- Reading an error message out of a blob error body.
- A screen that actually uploads or downloads. This change only builds the
  base; the first screen that needs it uses it.
- A real backend URL in the proxy or environments.
- Retry, timeout, logging per endpoint.

## Further Notes

- Origin: architecture review of 15/10/2026, candidate 02 ("one HTTP
  adapter instead of 22 copies of the ritual"), grilled on 16/10/2026. That
  session decided: no builder (no value yet), no client-side body parse,
  query supported, OpenAPI and Prism removed in favour of an in-app mock,
  everything shipped as one pull request.
- Done means: `npm run check` is green, the angular.md §14 checklist passes,
  the new specs above exist, and a smoke test with the in-app mock covers
  sign-in, the users, org and roles screens, and switching role in the
  toolbar, with screenshots. Production and staging bundles contain no
  fixture marker.
