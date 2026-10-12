# Contracts, zod and the Prism mock API

One chain keeps types, runtime validation and the mock server in sync:

```text
@lms/contracts (zod schemas + endpoint registry)
   ├─► apps/lms XApi services      parse every response with the endpoint's schema
   └─► apps/mock-api build-spec  ─► openapi.json (+ examples from @lms/mocks) ─► Prism :4010
```

Zod is the single source of truth. OpenAPI is generated from it and never
edited by hand; TypeScript types come from `z.infer`, never written twice.

## Schemas (`libs/contracts`)

- One folder per domain, mirroring the mockup's `core/types.js`:
  `libs/contracts/src/lib/<domain>/<domain>.schema.ts` and `<domain>.endpoints.ts`.
- Naming: schema `CourseSchema`, type `export type Course = z.infer<typeof CourseSchema>`.
  Commands and queries: `SaveCourseCommandSchema` / `SaveCourseCommand`,
  `CourseListQuerySchema` / `CourseListQuery`.
- Unions are `z.enum([...])` (`RoleSchema = z.enum(['learner', 'instructor', 'admin', 'viewer'])`);
  no TypeScript enums. Display labels (`'Học viên'`) live in the app, not in contracts.
- Dates cross the wire as ISO strings (`z.iso.datetime()`) and are formatted by a pipe.
- `z.unknown()` and narrowing instead of `z.any()`. No `.passthrough()`.
- **One schema per audience** when the server hides fields: the learner's
  `QuizQuestionSchema` has no `correct` field; the author's `QuestionSchema`
  does. Answer keys never appear in a learner payload, fixture or example.
- Contract schemas carry no UI copy. Forms add Vietnamese messages on top (below).
- Verify the installed zod major before writing: the v4 API (`z.iso.*`,
  `{ error }` params, `.meta()`) differs from v3.

## Endpoint registry

Each domain declares its endpoints once; the API service and the OpenAPI build
both read the same object.

```ts
export const courseEndpoints = {
  getCourse: defineEndpoint({
    method: 'get',
    path: '/api/courses/{courseId}',
    summary: 'Course detail with chapters and lessons',
    params: z.object({ courseId: z.string() }),
    response: CourseDetailSchema,
    errors: [401, 403, 404],
  }),
} as const;
```

- Endpoint keys and XApi method names keep the mockup's `api/*.js` function
  names (`dashboard`, `submitAttempt`, `saveProgress`), so every Angular call
  traces back to the mockup function that specifies it.
- `defineEndpoint`, `toUrl(endpoint, params)` and `ApiErrorSchema`
  (`{ message, details? }`, matching the mockup's `ApiError`) live in
  `libs/contracts/src/lib/http/`.
- `defineEndpoint` accepts `params`, `query` and `body` as optional; `toUrl`
  requires the params argument only when the endpoint declares `params`, and
  throws on a missing path segment. Declared `errors` are drawn from
  `400 | 401 | 403 | 404 | 409 | 422 | 423 | 500`.
- `libs/contracts` exports `endpointRegistries` (an array of every registry);
  `build-spec` walks it, so a new domain registers its `xEndpoints` there.
  The operation id is the registry key.
- Each endpoint lists the error statuses it can return; those become documented
  responses in OpenAPI and the states the UI must render.

## API services (in the app)

The service from angular.md §5.1, with the URL and schema taken from the registry:

```ts
@Service()
export class CourseApi {
  private readonly http = inject(HttpClient);

  getCourse(courseId: string): Observable<CourseDetail> {
    const endpoint = courseEndpoints.getCourse;
    return this.http.get<unknown>(toUrl(endpoint, { courseId })).pipe(parseResponse(endpoint.response));
  }
}
```

- Every response goes through `parseResponse(schema)` (an RxJS operator in
  `apps/lms/src/app/core/http/`). A failed parse throws a `ContractError` (same
  folder) with the zod issues, and is reported, not swallowed: the global
  `ErrorHandler` (`core/errors/app-error-handler.ts`, `provideAppErrorHandler()`)
  logs every unexpected error.
- `apps/lms/src/app/core/errors/app-error.ts` exports `toAppError(unknown): AppError`,
  the one place that maps `HttpErrorResponse`, `ContractError` and offline
  status 0 to `AppError`
  (`offline | unauthorized | forbidden | not-found | invalid | locked | contract | unknown`;
  status 0 is `offline`, 423 is `locked` for blocked or suspended accounts).
  `AppError` is `{ kind, message, details? }`: the message is the server's
  `ApiError.message` when the body parses, else the mockup's Vietnamese default;
  `details` (field to message) is kept on `invalid` only.
  Stores expose `toAppError(resource.error())`; components render it with retry.

## Forms

- A form whose fields match a command schema validates with Signal Forms'
  Standard Schema support (zod implements Standard Schema). Check the
  `@angular/forms/signals` exports for the validator name first.
- The form schema lives beside the component in `<route>.form.ts`, derived from
  the contract (`SaveCourseCommandSchema.pick(...).extend(...)`) with Vietnamese
  messages, together with the pure `toXFormValue` / `toXCommand` adapters.
  Spec those adapters and the messages.

## Runtime config

Environment files are validated by `AppConfigSchema` at bootstrap, and the
API origin per environment is applied by `apiBaseUrlInterceptor`: see
`workspace.md` → Environments. Endpoint paths in the registry always start
with `/api/` and never contain a host.

## Fixtures (`libs/mocks`)

- Port `lms-mockup/src/data/seed.js` into typed fixtures:
  `libs/mocks/src/lib/<domain>/<domain>.fixtures.ts`. Keep the mockup's people,
  units, courses and the seven learner states, so the README's demo accounts
  still describe the data.
- `libs/mocks/src/fixtures.spec.ts` parses every fixture with its schema. A
  fixture that drifts from the contract fails the test suite.
- Store and component specs import fixtures from `@lms/mocks` instead of
  inventing inline data.
- Responses the mockup computes on its fake server (dashboard aggregates, scores,
  progress %) become fixed fixtures of the computed result. Never reimplement
  that computation in the frontend: it is backend logic, and the mockup's
  `api/*.js` is its spec.

## Prism (`apps/mock-api`)

- `build-spec` walks every endpoint registry, converts schemas to OpenAPI 3.1
  (zod v4's `z.toJSONSchema`, which emits the JSON Schema dialect OpenAPI 3.1 uses),
  attaches named examples from `@lms/mocks`, and writes
  `dist/apps/mock-api/openapi.json`. `serve` runs it first, then
  `prism mock` on port 4010 with static examples.
- `GET /api/health` is a registered endpoint (`healthEndpoints`) like any other:
  Prism refuses to start on a document without operations.
- Examples come from `@lms/mocks`: `endpointExamples[operationId]` (`default`
  plus optional `roles`) and `errorExamples[status]` (generic `ApiError` bodies
  using the mockup's messages). `build-spec` fails when an endpoint has no
  example, and `libs/mocks/src/fixtures.spec.ts` parses all of them.
- Every endpoint has a `default` success example plus one example per declared
  error status. Role-dependent endpoints add examples named after the role
  (`learner`, `admin`, `instructor`, `viewer`, `unit-admin`).
- Pick a response from the client with Prism's `Prefer` header:
  `Prefer: example=admin`, `Prefer: code=403`. A dev-only
  `mockScenarioInterceptor` in `core/dev/` sets it from a small dev toolbar. That
  toolbar replaces the mockup's "Demo" menu (switch role, offline, session
  expired, forbidden) and is excluded from production builds.
- Prism is stateless: a POST does not change what the next GET returns. Stores
  apply the mutation response to their own state (angular.md §5.2), which is
  also the correct behaviour against the real backend.
- Prism validates requests against the spec and answers 422 for a bad payload:
  treat that as a bug in the client, not in the mock.

## Done criteria for a contract change

- Schema, endpoint, fixture (success + each error) and XApi method all updated.
- `npx nx test contracts mocks` green (fixtures parse).
- `npx nx serve mock-api` serves the endpoint; a request returns the example.
