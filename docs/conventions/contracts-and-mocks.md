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
- Unions are `z.enum([...])` (`AccountStatusSchema = z.enum(['active', 'suspended', 'locked'])`);
  no TypeScript enums. Display labels (`'Đang hoạt động'`) live in the app, not in contracts. Roles are data, not an enum: their names come from the server.
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
- Examples come from `@lms/mocks`: `endpointExamples[operationId]` (`default`,
  optional `roles`, optional `errors` with endpoint-specific `ApiError` bodies)
  and `errorExamples[status]` (generic bodies used when an endpoint has no
  `errors` entry; both use the mockup's messages). `build-spec` fails when an endpoint has no
  example, and `libs/mocks/src/fixtures.spec.ts` parses all of them.
- Every endpoint has a `default` success example plus one example per declared
  error status. Role-dependent endpoints add examples named after the role
  (`learner`, `admin`, `instructor`, `viewer`, `unit-admin`).
- Pick a response from the client with Prism's `Prefer` header:
  `Prefer: example=admin`, `Prefer: code=403`. `mockScenarioInterceptor`
  (`core/dev/`, used only when `mockScenarios` is true) sets
  `Prefer: example=<role>` on the GET endpoints that have role examples
  (`ROLE_EXAMPLE_ENDPOINTS`; a spec fails when it differs from the endpoints
  with role examples in `@lms/mocks`) from the role chosen in the dev
  toolbar, kept for the tab. While the toolbar simulates a lost connection it
  also fails every request with status 0. The toolbar replaces the mockup's
  "Demo" menu (switch role, offline, session expired, forbidden URL, design
  system) and is not part of the production build.
- Prism is stateless: a POST does not change what the next GET returns. Stores
  apply the mutation response to their own state (angular.md §5.2), which is
  also the correct behaviour against the real backend.
- Prism validates requests against the spec and answers 422 for a bad payload:
  treat that as a bug in the client, not in the mock.

## Auth contract decisions

- Access is granted **per menu**, not per action. A role is `{ id, name, description, system, menus[] }`
  (`RoleSchema`); `MenuKeySchema` has one key per sidebar entry (`admin.users`, `reports`, ...).
  Holding a menu allows its screen, its sub-routes and everything done on them. The mockup's
  `PERMS` table is gone: there is no `Permission` type and no `*appCan`.
- Each user has exactly one `roleId` and a separate `scopeUnitId` (`null` = whole system). The scope
  limits **data** and is enforced by the server; the app only renders what it gets.
- `profile` keeps server-evaluated values the app must not recompute: `roleName`, `menus`, `homePath`
  (where `/` and the login page send the user), `unitName`, `groupName` and `scopeName`
  (unit name, or the server's "Toàn hệ thống" for system-wide users).
- `roleText` in the app adds "đơn vị" to the name of an `admin` limited to one unit (the mockup's
  "Quản trị viên đơn vị"); the demo accounts therefore carry `roleName` and `scopeUnitId`.
- Prism's role examples (`profile`, `navCounts`) exist for the four system roles and the unit admin
  only (`learner`, `instructor`, `admin`, `viewer`, `unit-admin`). A custom role has no example, and
  the mock cannot keep one across a reload because Prism is stateless.
- `logout` answers `true` (200), like the mockup; `login` and `loginDemo`
  answer `{ id, roleId }`. The session token is a server concern (cookie), not
  part of the payload.
- `loginDemo` is `POST /api/auth/demo-accounts/{userId}/login`.
- One 423 example per endpoint (the locked wording). The mockup's separate
  "suspended" wording reaches the UI through the server's `message`, which
  `toAppError` already preserves.

### Verified against Prism

Smoke-tested with `npx nx serve mock-api` (Prism on `127.0.0.1:4010`):

- `POST /api/auth/login` with `Prefer: code=423` answers 423 with the locked
  message; `code=401` and `code=422` answer their examples.
- `GET /api/auth/profile` with `Prefer: example=admin` answers user `a1`,
  role `admin`.
- `POST /api/auth/demo-accounts/{userId}/login` (`loginDemo`) answers 404 and
  423 with `Prefer: code=404` / `code=423`.

`apps/mock-api/src/openapi.spec.ts` guards the document itself: every endpoint
of `endpointRegistries` is present with a `default` example for 200 and for each
declared error status.

## Admin organisation contract decisions

- Everything under `/api/admin/users` and `/api/admin/meta` is reached through the `admin.users`
  menu; the server also cuts every answer to the caller's `scopeUnitId` and refuses what a
  unit-limited caller may not do (grant the whole system, create a unit, assign a role holding
  `admin.roles`). The app never decides this: it renders `adminMeta` (units, groups and **the roles
  the caller may assign**) and shows the 403/422 the server sends.
- `UserDetail` is `{ user, role, courses, attempts, audit }`. The mockup's `perms` matrix became
  `role` (with its `menus`); its `competency` (the radar) is left out until the charts are migrated.
- Mutations answer the changed record, but the list and detail stores **reload** instead of
  patching it in, because the server is the source of truth and Prism is stateless (it always
  answers the same example).
- Prism has role examples for `users`, `adminMeta` and `org` (`admin`, `unit-admin`); `user` answers one
  fixed user whatever `userId` is.
- The roles screen (`roles`, `saveRole`, `deleteRole`) sits behind the `admin.roles` menu and has no
  mockup page. `Role.system` and `Role.locked` are what the screen may rely on: the app hides edit
  on a locked role and delete on a system one, and disables delete while `userCount` is above zero,
  but the server enforces all three (and protects the last administrator), so a refusal arrives as
  a 403/422 and is shown as a toast or a field message. A role is saved as a name, a description and
  menu keys; there is nothing finer than the menu to grant.
- The org screen (`org`, `saveUnit`, `setUnitStatus`, `saveGroup`, `deleteGroup`) sits behind the
  `admin.org` menu. `org` rows carry what the screen shows (admins, member counts, groups with
  members, shared courses) so the app computes none of it; `admins[].scope` is `unit` or `system`.
  A unit-limited caller may edit its own unit but the server refuses `saveUnit` without an `id` and
  decides who may pause a unit. Deleting a group that still has members is a 422 whose message the
  app shows as a toast. The mutations answer one record and the store reloads `org`.

## Done criteria for a contract change

- Schema, endpoint, fixture (success + each error) and XApi method all updated.
- `npx nx test contracts mocks` green (fixtures parse).
- `npx nx serve mock-api` serves the endpoint; a request returns the example.
