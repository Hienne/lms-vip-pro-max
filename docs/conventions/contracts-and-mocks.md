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
- Unions are `z.enum([...])` (`AccountStatusSchema = z.enum(['active', 'suspended', 'locked', 'inactive'])`);
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
- `defineEndpoint`, `toUrl(endpoint, params)` and the response envelope
  (`EnvelopeSchema`, `UNAUTHENTICATED_CODE`, `MESSAGE_CODE_KIND`) live in
  `libs/contracts/src/lib/http/`.
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
  `HttpContextToken` (exported by the client). `envelopeInterceptor`, `sessionExpiryInterceptor`, `bearerInterceptor` and the dev mock read it.
- **Files.** A `blob` endpoint returns a `Blob`; the store names it and calls
  `FileSaver.save(blob, filename)` (`core/files/`) from a mutation's `onSuccess`.
  `Content-Disposition` is not read.
- `apps/lms/src/app/core/errors/app-error.ts` exports `toAppError(unknown): AppError`,
  the one place that maps `ApiError` (an `ERROR` envelope, whatever its HTTP status),
  `HttpErrorResponse` (no envelope in the body), `ContractError` and offline status 0 to `AppError`
  (`offline | unauthorized | forbidden | server | contract | unknown`;
  status 0 is `offline`, 401 `unauthorized`, 403 `forbidden`, any other HTTP status `unknown`
  with the default message).
  `AppError` is `{ kind, message, title?, messageCode?, httpStatus?, responseId? }`. From an
  `ApiError` the `message` and `title` are the backend's, verbatim (the Vietnamese default
  replaces only a missing `message`; a missing `title` stays absent), `messageCode`,
  `httpStatus` and `responseId` are kept, and the kind comes from one table: a code in
  `MESSAGE_CODE_KIND`, else the HTTP status (401 `unauthorized`, 403 `forbidden`), else `server`. A new kind is added only when a screen must behave differently for a
  backend code, together with that code's entry in the table.
  `serverData` and `serverMutation` expose their error as an `AppError`; components render it with retry.
  A `serverMutation` with `errors: 'toast'` appends "Mã tra cứu: <responseId>" to the toast of a
  system failure (HTTP 5xx).
- **Expired session.** `sessionExpiryInterceptor` (`core/http/`, first in the chain,
  all environments) treats a 401 (an `ApiError` with HTTP status 401, e.g. `CORE-UNAUTHENTICATED`, or a bare 401) from any endpoint except
  `authV1Endpoints.me`, `login` and `logout` as the session ending (those mean anonymous visitor,
  wrong credentials, or a token already revoked at logout). It matches by endpoint identity through the `ENDPOINT` context
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

The backend (`BaseResponse`) wraps every answer in the same envelope (`EnvelopeSchema` in
`libs/contracts/src/lib/http/envelope.ts`): `responseId`, `timestamp`, `status`
(`SUCCESS` | `ERROR`), `messageCode`, `messageTitle`, `message` and `data`. The payload of a
success is in `data` (HTTP 200, or 201 for a create); an endpoint's `response` schema describes
that payload, never the wrapper. Validation and business refusals are HTTP 200 with `status:
'ERROR'`; authentication (401), permission (403), protocol (400, 404, 405, 406, 415, 429) and
system (500) failures use their own HTTP status **and still carry the envelope in the body**. A
body `errors[]` (per-field details) is deliberately not read (decision D10): forms show only
their own validators' messages, and a backend refusal is a toast.

- **Success test.** `status === 'SUCCESS'` and nothing else (`CORE-SUCCESS` is the success code, but
  `messageCode` is not used to decide).
- **`envelopeInterceptor`** (`core/http/`, second in the chain, after `sessionExpiryInterceptor`
  and before the dev features and the mock) is the one place that knows the wrapper. It acts only
  on requests with an `ENDPOINT` tag and skips `blob` endpoints. `SUCCESS` continues with `data`;
  `ERROR` throws an `ApiError` (`messageCode`, `title`, `serverMessage`, `httpStatus`,
  `responseId`); the same happens for an envelope in the body of a 4xx/5xx
  `HttpErrorResponse`; a 2xx body that is not an envelope throws `ContractError` (and goes to
  `ErrorHandler`). A non-2xx without an envelope (offline, a gateway's error page) passes through
  as `HttpErrorResponse`.
- **`requestIdInterceptor`** sends `X-Request-Id` (a UUID, or random hex on a plain-HTTP page) on
  every `/api/` call; the backend returns it as `responseId`.
- **`toAppError`** reads an `ApiError`: a code in `MESSAGE_CODE_KIND` gives that kind
  (`CORE-UNAUTHENTICATED` is `unauthorized`, `CORE-ACCESS_DENIED` is `forbidden`), otherwise
  the HTTP status does (any 401 is `unauthorized`, any 403 `forbidden`), and any other
  failure is `server`. The session-expiry interceptor ends the session on `unauthorized`
  through this same function, so the two cannot disagree. The `AppError` keeps the
  backend's `title`, `message` (verbatim, the Vietnamese default only when it sent none) and
  `messageCode`. A wrong password is `IDENTITY-CREDENTIALS_INVALID` in a 401: an `unauthorized`
  error (the login endpoint is exempt from session expiry) whose message is the backend's "Tên đăng nhập hoặc mật khẩu không đúng.".
  Add a code to `MESSAGE_CODE_KIND` only when a screen must behave differently for it.
- **Display is not decided here.** No interceptor shows a toast: a `serverMutation` with
  `errors: 'toast'` shows `title` as the heading and `message` as the detail.
- **Paging and PATCH.** `PageSchema(item)` (`http/page.ts`) is the backend's `PageResponse`
  (`items`, 0-based `page`, `size` 1..100, `totalElements`, `totalPages`). `toPatch` (`http/patch.ts`) builds a PATCH body of the changed fields only: a field left out is
  kept by the server and `null` clears it.
- **Mock and specs.** The in-app mock answers `envelopeOk(fixture)`. A spec flushes
  `envelopeOk(data)`, or a refusal from `backendRefusal(key)` (`@lms/mocks`: the real HTTP status,
  code, title and message of every backend refusal) with that status, through
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
- The endpoints the backend lacks are declared `served: 'mock'` on their definition and
  answered by `FakeBackend` (`lib/backend/fake-backend.ts`) from these fixtures: role CRUD against
  seeded, stateful roles (a save or delete changes the next list), a user's courses, attempts and
  activity, the shell's nav counts. Their refusals are `ERROR` envelopes in HTTP 200 using the
  placeholder `MOCK_REFUSAL_CODE` (`lib/error-envelopes.ts`), which is mock-only and unconfirmed
  with the backend. Messages are the mockup's; titles are placeholders, and field hints the mockup
  sent as `details` are dropped (the forms validate shape themselves). Moving an endpoint to the
  backend is one edit: delete its `served: 'mock'`.
- `libs/mocks/src/fixtures.spec.ts` checks that `FakeBackend` answers every declared endpoint and
  that the mock-only reads parse with their schema. A fixture that drifts from the contract fails
  the test suite.
- Store and component specs import fixtures from `@lms/mocks` instead of
  inventing inline data.
- Responses the mockup computes on its fake server (dashboard aggregates, scores,
  progress %) become fixed fixtures of the computed result. Never reimplement
  that computation in the frontend: it is backend logic, and the mockup's
  `api/*.js` is its spec.

## In-app mock API (development only)

`npm start` runs the app against mocks inside the browser; no second process and no OpenAPI
document. Two switches in `AppConfig` choose, per endpoint, who answers:

- **`mockApi`: endpoints the backend lacks (`served: 'mock'`).** `mockApiInterceptor`
  (`core/dev/mock-api/`) reads the request's `ENDPOINT` tag and, for an endpoint declared
  `served: 'mock'` (`adminOrgEndpoints`: the role CRUD screen and the user-detail
  Courses/Attempts/Activity tabs; `shellEndpoints.navCounts`), has `MockBackend` answer it. A
  store asks `EndpointClient.isServed(endpoint)` whether the build can answer an endpoint instead
  of reading `mockApi`, and a menu group lists the endpoints it `requires`: while one is not
  served the function is left out of the user's menus. These endpoints are not on the backend yet.
- **`mockBackend`: endpoints the backend has.** `MockBackend` (also the mock-only answerer) extends `FakeBackend`
  (`@lms/mocks/backend`), an in-memory, **stateful** copy of the backend seeded from its data
  (`seed.ts`: the 7 demo users, orgs, teams, roles, the 16 functions). It answers the v1 identity,
  organisation and auth endpoints with the real HTTP status and envelope, so a POST changes what
  the next GET returns, the caller's scope is enforced, and a refusal is an `ERROR` envelope
  (`backendRefusal(key)` in `backend-responses.ts`). A 4xx or 5xx is thrown as an
  `HttpErrorResponse`, which `envelopeInterceptor` turns into an `ApiError` as it does for the real
  backend. `postman.contract.spec.ts` replays the backend's Postman request bodies against it and
  parses every answer with the endpoint schema. Passwords are `SEED_PASSWORD`.
- An endpoint that neither answers goes on to the network, with one `console.warn` per endpoint.
- **Wiring, so mocks never ship:** only `environments/environment.ts` imports the mock module (and
  through it `@lms/mocks`); it exports `mockInterceptors`. The staging and production environment
  files export an empty list and import nothing from the mock, so their builds cannot contain it.
  `app.config.ts` registers, in order: `sessionExpiryInterceptor`, `envelopeInterceptor`,
  `bearerInterceptor`, `requestIdInterceptor`, the dev interceptors (offline simulation),
  `mockInterceptors` (only when `mockApi` is true), `apiBaseUrlInterceptor`. A narrow ESLint
  override lets only specs, `*.testing.ts`, `environment.ts` and `core/dev/mock-api/**` depend on
  `type:mocks`.
- **Specs** that need a working backend use `provideMockBackendHttp()` and
  `signInToMockBackend(username)` (`core/dev/mock-api/mock-backend.testing.ts`) and spy on
  `MockBackend.handle` to assert the request's `params`, `query` and `body`. The older specs flush
  `envelopeOk(data)` from `HttpTestingController` instead.
- `tools/check-production-bundle.mjs` looks for a fixture marker (`admin@demo.cb`): `npm run check`
  builds production and staging and fails if either contains it (staging is checked with
  `--fixtures-only`, since it keeps the dev toolbar on purpose). A development build fails the
  check.
- To use the real backend, set `mockApi` and `mockBackend` to false in `environment.ts`; the dev
  proxy (`apps/lms/proxy.conf.mjs`) sends `/api` to `http://localhost:8019`. Sign in with a real
  account; the toolbar's account list is the seeded one and only works against the mock backend.
  The offline, session-expired and forbidden-URL simulations stay. The toolbar is not part of the
  production build.
- Mid-session 401: see "Expired session" under error handling.

## Identity and organisation contract decisions

- **Access is by function code.** The backend's 16 function codes (`PROFILE`, `COURSE_LEARNING`,
  `USER_MANAGEMENT`, ...) are the menu keys everywhere: the route table (`core/routing/screens.ts`),
  the sidebar, the guards and the role form. `MenuKeySchema` is gone. `Me.functionDetails` carries each
  function's name, route and `sortNo`; the sidebar lists them in `sortNo` order, and `homePath` is
  the first function's route excluding `PROFILE`, else `/profile`. Eleven FE screens have no
  function (catalog, leaderboard, assistant, flashcards, saved, certificates, instructor home and
  inbox, content catalog, import, admin home) plus `notifications`: they are `open` routes for any
  signed-in user and not in the sidebar.
- **Grants** are `{ roleId, scope: GLOBAL | ORG | TEAM | OWN, orgId?, teamId? }`, with numeric ids.
  `userId` is the staff code, a string whose leading zeros matter. A user has many grants; the
  profile and the user page list all of them. Status is `active | inactive | locked`.
- **Who may do what is the server's call.** The app renders what the backend returns and shows a
  refusal as a toast (`title` as the heading, `message` as the detail); no form maps `errors[]` to a
  field, so the form validators must match the backend's rules (lengths, password 6 to 72 UTF-8
  bytes, `q` up to 100 characters).
- **Paging.** Lists are paged by the server (`PageSchema`, 0-based `page`, `size` up to
  `MAX_PAGE_SIZE`). The users list sorts on the server (`sort=id,asc`), and the org tree reads one
  level at a time (`rootOnly`, then `parentId`), each level paged. A team lists at most five members
  and links to `/admin/users?teamId=` for the rest.
- **PATCH sends the diff only** (`toPatch`): profile (`PATCH /auth/me`), user, org and team. A field
  left out is kept, `null` clears it, an empty PATCH is not sent. `orgType` and `parentId` of an org
  cannot change after creation.
- **Passwords.** `mustChangePassword` (from `/me`) closes every route but `/change-password`
  (`passwordChangeGuard`). Changing it (`PUT /auth/password`, from the profile or the forced screen)
  clears the token and returns to `/login`. A 403 `IDENTITY-PASSWORD_CHANGE_REQUIRED` on a stale
  profile is only a toast: nothing redirects at runtime.
- **Roles.** The grant forms read `GET /api/v1/roles`. The role CRUD screen is still on the mock API
  (`adminOrgEndpoints.roles`, `saveRole`, `deleteRole`) until the backend has the endpoints.
- **Session.** The access token and its `expiresAt` live in `localStorage` behind `TokenStore`
  (storage errors and malformed entries count as no token). `bearerInterceptor` adds
  `Authorization: Bearer <token>` to `/api/` requests except `authV1Endpoints.login`, and runs
  before `apiBaseUrlInterceptor` so the `/api/` test sees the relative path. At boot an unexpired
  token restores the user through `me`; a missing or expired token is anonymous with no request.
  `SessionStore.expire()` removes the stored token.

## Done criteria for a contract change

- Schema, endpoint (with its doc comment), fixture (success, plus the mockup's specific errors as `ERROR` envelopes) all updated.
- `npx nx test contracts mocks` green (fixtures parse).
- `npm start` shows the endpoint answering its example in the app.
