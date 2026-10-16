# Contracts, zod and the in-app mock API

One chain keeps types, runtime validation and the dev mock in sync:

```text
@lms/contracts (zod schemas + endpoint registry)
   ├─► apps/lms EndpointClient   sends each call as its endpoint says, parses the response with its schema
   └─► @lms/mocks fixtures ─► in-app mock API (development only, answers the tagged request)
```

Zod is the single source of truth. TypeScript types come from `z.infer`, never
written twice.

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

Each domain declares its endpoints once; `EndpointClient` reads the same object.

```ts
export const courseEndpoints = {
  /** Course detail with chapters and lessons. */
  getCourse: defineEndpoint({
    method: 'get',
    path: '/api/courses/{courseId}',
    params: z.object({ courseId: z.string() }),
    response: CourseDetailSchema,
  }),
} as const;
```

- Endpoint keys keep the mockup's `api/*.js` function names (`dashboard`,
  `submitAttempt`, `saveProgress`); each `*.endpoints.ts` header names the
  mockup file, so every Angular call traces back to the function that specifies
  it. What an endpoint does goes in a `/** */` comment on its key.
- `defineEndpoint`, `toUrl(endpoint, params)` and `ApiErrorSchema` live in
  `libs/contracts/src/lib/http/`. `ApiErrorSchema` (`{ message, details? }`) is
  **provisional**: it mirrors the mockup's `ApiError` until the backend
  publishes its error schema.
- `defineEndpoint` accepts `params`, `query` and `body` as optional; `toUrl`
  requires the params argument only when the endpoint declares `params`, and
  throws on a missing path segment.
- An endpoint does not list its error statuses: a backend may answer any status
  from any endpoint, and `toAppError` maps by status or by the envelope's `messageCode`.
- Two optional fields choose the transport; both default to `'json'`:
  - `encoding: 'multipart'` sends the body as `FormData`. File fields use
    `z.file()`.
  - `responseType: 'blob'` receives a file. The response schema must be
    `z.instanceof(Blob)`; the types reject any other schema.

## Calling endpoints (in the app)

Stores call `EndpointClient.call(endpoint, input)` (`core/http/endpoint-client.ts`);
angular.md §5.1 shows the usage. There is no API service per domain.

- **Types.** `input` has `params`, `query` and `body`, each required exactly
  when the endpoint declares it and forbidden otherwise (an endpoint with none
  takes no second argument). Types come from `z.input` of each schema; the
  result is `z.output` of the response schema.
- **Verb and URL** come from the registry only.
- **Query** is not parsed. `null` and `undefined` are skipped, an array repeats
  the key (`?tag=a&tag=b`), any other value goes through `String(v)`.
- **Body, JSON** is sent exactly as passed, not parsed, so a schema transform
  never rewrites a payload.
- **Body, multipart** must be flat: each value is `string | number | boolean |
File | Blob` or an array of those. Arrays repeat the key, numbers and booleans
  become strings, `null`/`undefined` are skipped, and a nested object throws an
  `Error` (a client bug). The client never sets `Content-Type` for multipart.
- **Response.** Every response, a blob included, is parsed with the endpoint's
  schema. A mismatch creates a `ContractError` with the zod issues, passes it to
  the global `ErrorHandler` (`core/errors/app-error-handler.ts`,
  `provideAppErrorHandler()`) so the console shows which field was wrong, then
  rethrows it; `toAppError` still turns it into the usual Vietnamese message.
- **Envelope.** See "Response envelope" below: `envelopeInterceptor` unwraps it before the
  parse above, so a schema describes the payload only.
- **Tag.** Every request carries its endpoint object in the `ENDPOINT`
  `HttpContextToken` (exported by the client). `envelopeInterceptor`, `sessionExpiryInterceptor` and the dev mock read it.
- **Files.** A `blob` endpoint returns a `Blob`; the store names it and calls
  `FileSaver.save(blob, filename)` (`core/files/`) from a mutation's `onSuccess`.
  `Content-Disposition` is not read.
- `apps/lms/src/app/core/errors/app-error.ts` exports `toAppError(unknown): AppError`,
  the one place that maps `ApiError` (an `ERROR` envelope), `HttpErrorResponse`,
  `ContractError` and offline status 0 to `AppError`
  (`offline | unauthorized | forbidden | not-found | invalid | locked | server | contract | unknown`;
  status 0 is `offline`, 423 is `locked` for blocked or suspended accounts).
  `AppError` is `{ kind, message, title?, messageCode?, details? }`. From an `ApiError` the
  `message` and `title` are the backend's, verbatim (the Vietnamese default replaces only a
  missing `message`; a missing `title` stays absent), `messageCode` is kept, and the kind is
  `server` unless the code is in `MESSAGE_CODE_KIND`. From an `HttpErrorResponse` the message
  is the body's `ApiErrorSchema.message` when it parses, else the default; `details` (field to
  message) is kept on `invalid` only. The old status-based kinds stay until the contract step
  of the envelope work removes them.
  `serverData` and `serverMutation` expose their error as an `AppError`; components render it with retry.
- **Expired session.** `sessionExpiryInterceptor` (`core/http/`, first in the chain,
  all environments) treats a 401, or an `ApiError` with `CORE-0401`, from any endpoint except `authEndpoints.profile`,
  `login` and `loginDemo` as the session ending (those mean anonymous visitor and
  wrong credentials). It matches by endpoint identity through the `ENDPOINT` context
  token, never by URL, and hands over to `SessionExpiry` (`core/session/`), which, only
  while someone is signed in, forgets the user, shows the expiry message once and
  navigates to `/login?next=<current url>`. The failing call still errors to its store
  (a `serverMutation` with `errors: 'toast'` adds its own toast). The dev toolbar's
  "session expired" uses `SessionExpiry` too. `core/routing/return-to.ts` builds
  (`returnToParams`) and reads (`readReturnTo`, rejects external or unsafe paths)
  `?next=`.
- **Known limit:** an HTTP error on a `blob` endpoint arrives as a `Blob` body,
  so `toAppError` shows the default message for its kind.
- **Extension rule:** a new transport kind (another body encoding, streaming…)
  is a new optional field on `defineEndpoint` plus a branch in `EndpointClient`,
  never a new API service and never a direct `HttpClient` call in a store.

## Response envelope

The backend answers every call with HTTP 200 and the same wrapper (`EnvelopeSchema` in
`libs/contracts/src/lib/http/envelope.ts`): `responseId`, `timestamp`, `status`
(`SUCCESS` | `ERROR`), `messageCode`, `messageTitle`, `message` and `data`. The payload of a
success is in `data`; an endpoint's `response` schema describes that payload, never the wrapper.

- **Success test.** `status === 'SUCCESS'` and nothing else. (`CORE-0000` is the success code, but
  `messageCode` is not used to decide.)
- **`envelopeInterceptor`** (`core/http/`, second in the chain, after `sessionExpiryInterceptor`
  and before the dev features and the mock) is the one place that knows the wrapper. It acts only
  on requests with an `ENDPOINT` tag and skips `blob` endpoints. `SUCCESS` continues with `data`;
  `ERROR` throws an `ApiError` (`messageCode`, `title`, `serverMessage`); a body that is not an
  envelope throws `ContractError` (and goes to `ErrorHandler`). Non-2xx responses (offline,
  gateway errors, a real 401) pass through as `HttpErrorResponse`.
- **`toAppError`** reads an `ApiError`: a code in `MESSAGE_CODE_KIND` (today only
  `CORE-0401 → unauthorized`) gives that kind, any other code is `server`. The `AppError` keeps the
  backend's `title`, `message` (verbatim, the Vietnamese default only when it sent none) and
  `messageCode`. Add a code to `MESSAGE_CODE_KIND` only when a screen must behave differently for it.
- **Display is not decided here.** No interceptor shows a toast: a `serverMutation` with
  `errors: 'toast'` shows `title` as the heading and `message` as the detail.
- **Mock and specs.** The in-app mock answers `envelopeOk(fixture)`. A spec flushes
  `envelopeOk(data)` or `envelopeError(code, title, message)` (from `@lms/mocks`) through
  `provideEnvelopeHttpClient()` (`core/http/http.testing.ts`), which installs the interceptor.

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
- `endpointExamples` (`lib/examples.ts`) lists, per endpoint key, a `default`
  success body, optional `roles` bodies (`learner`, `admin`, ...) and optional
  `errors` (the mockup's specific `ApiError` bodies, such as `loginLocked` or
  `saveUserInvalid` with field `details`). `MOCK_FIXTURES` is the same data
  keyed by the endpoint object, built from the registries that the mocks
  library lists itself. A new domain registers its `xEndpoints` there.
- `libs/mocks/src/fixtures.spec.ts` parses every example with its schema. A
  fixture that drifts from the contract fails the test suite.
- Store and component specs import fixtures from `@lms/mocks` instead of
  inventing inline data.
- Responses the mockup computes on its fake server (dashboard aggregates, scores,
  progress %) become fixed fixtures of the computed result. Never reimplement
  that computation in the frontend: it is backend logic, and the mockup's
  `api/*.js` is its spec.

## In-app mock API (development only)

`npm start` runs the app against a mock inside the browser; no second process
and no OpenAPI document.

- `mockApiInterceptor` (`core/dev/mock-api/`) reads the request's `ENDPOINT`
  tag, finds the endpoint object in `MOCK_FIXTURES` and answers `200` with a
  `SUCCESS` envelope around `roles[role] ?? default`, where `role` is `MockScenario.role$()`, the role
  chosen in the dev toolbar and kept for the tab. No delay, no state, no
  per-request error simulation.
- A request whose endpoint has no fixture (or no tag) goes on to the network,
  with one `console.warn` per endpoint, so partial mocking is possible and visible.
- **Wiring, so fixtures never ship:** only `environments/environment.ts`
  imports the mock module (and through it `@lms/mocks`); it exports
  `mockInterceptors`. The staging and production environment files export an
  empty list and import nothing from the mock, so their builds cannot contain
  it. `app.config.ts` registers `mockInterceptors` when `mockApi` is true, in
  the order: offline simulation, mock API, `apiBaseUrlInterceptor`. A narrow
  ESLint override lets only `environment.ts` and `core/dev/mock-api/**` depend
  on `type:mocks` outside specs.
- `tools/check-production-bundle.mjs` looks for a fixture marker
  (`admin@demo.cb`): `npm run check` builds production and staging and fails if
  either contains it (staging is checked with `--fixtures-only`, since it keeps
  the dev toolbar on purpose). A development build fails the check.
- To use a backend instead, set `mockApi` to false in `environment.ts` and put
  the backend's dev origin in `apps/lms/proxy.conf.mjs`; no code changes. The
  toolbar's role list is then hidden (it only drives the mock): switch role by
  signing in with a demo account (`loginDemo`). The offline, session-expired
  and forbidden-URL simulations stay. The toolbar replaces the mockup's "Demo"
  menu and is not part of the production build.
- The mock is stateless: a POST does not change what the next GET returns.
  Stores apply the mutation response to their own state or reload (angular.md
  §5.2), which is also the correct behaviour against the real backend.
- Mid-session 401: see "Expired session" under error handling.

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
- The mock's role examples (`profile`, `navCounts`) exist for the four system roles and the unit admin
  only (`learner`, `instructor`, `admin`, `viewer`, `unit-admin`). A custom role has no example (the
  default answers), and the mock cannot keep one across a reload because it is stateless.
- `logout` answers `true` (200), like the mockup; `login` and `loginDemo`
  answer `{ id, roleId }`. The session token is a server concern (cookie), not
  part of the payload.
- `loginDemo` is `POST /api/auth/demo-accounts/{userId}/login`.
- One 423 example per endpoint (the locked wording). The mockup's separate
  "suspended" wording reaches the UI through the server's `message`, which
  `toAppError` already preserves.

## Admin organisation contract decisions

- Everything under `/api/admin/users` and `/api/admin/meta` is reached through the `admin.users`
  menu; the server also cuts every answer to the caller's `scopeUnitId` and refuses what a
  unit-limited caller may not do (grant the whole system, create a unit, assign a role holding
  `admin.roles`). The app never decides this: it renders `adminMeta` (units, groups and **the roles
  the caller may assign**) and shows the 403/422 the server sends.
- `UserDetail` is `{ user, role, courses, attempts, audit }`. The mockup's `perms` matrix became
  `role` (with its `menus`); its `competency` (the radar) is left out until the charts are migrated.
- Mutations answer the changed record, but the list and detail stores **reload** instead of
  patching it in, because the server is the source of truth and the mock is stateless (it always
  answers the same example).
- The mock has role examples for `users`, `adminMeta` and `org` (`admin`, `unit-admin`); `user` answers one
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

- Schema, endpoint (with its doc comment), fixture (success, plus the mockup's specific errors) all updated.
- `npx nx test contracts mocks` green (fixtures parse).
- `npm start` shows the endpoint answering its example in the app.
