# Contracts, zod and the in-app mock API

Question Excel import on `/admin/questions` uses the program selected outside the drawer.
`programAssessmentEndpoints.importQuestions` calls the existing multipart endpoint
`POST /api/v1/questions/import?programId&dryRun&overwrite`, part `file`, without `courseId`.
The course editor uses the same shared drawer through `QUESTION_IMPORT_HOST`; it additionally sends
its fixed `courseId` as authorization context, while questions remain in the program bank. The bank page
does not require a course or fetch a course picker. The legacy course endpoint contract remains separate.
Download the actual workbook through
`GET /api/v1/questions/import-template`; the same verified workbook is bundled with the dev mock.
The drawer checks the file first and enables import only for the checked file/program/overwrite
settings. Any changed input invalidates the check. Server errors such as `Questions[3].dap_an_dung`
are shown as row/column messages in the drawer. The mock still simulates three fixed imported rows
and does not parse Excel contents; real workbook parsing/atomicity is verified in `QuestionTransferApiIT`.

Course drafts send nullable `finalQuizId`; the backend validates a final exam of that same course and stores it
per revision. `CourseDetail.finalQuizId` and `completionRule.finalQuizId` reflect that saved selection. The learner
page explains required quizzes and renders server progress; it never awards completion locally. Only passing
required quiz lessons and the selected final exam, together with required content, can complete the enrollment.
The backend upgrade `2026-11-05-required-final-quiz.sql` must precede deployment of this contract.

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
  - `encoding: 'binary'` sends the body, one `Blob` (`body: z.instanceof(Blob)`), as
    `application/octet-stream`, not parsed: a part of a chunked upload.
  - `responseType: 'blob'` receives a file. The response schema must be
    `z.instanceof(Blob)`; the types reject any other schema.
  - `responseType: 'ndjson'` streams newline-delimited JSON events; `response` describes one event
    and the endpoint is read with `EndpointClient.stream` (below), which `call` rejects at type
    level.
- An optional `headers` schema (`z.object({ 'X-Part-SHA256': z.string() })`) names request headers the
  caller must send; an endpoint without it takes none.

## Calling endpoints (in the app)

Stores call `EndpointClient.call(endpoint, input)` (`core/http/endpoint-client.ts`);
angular.md §5.1 shows the usage. There is no API service per domain.

- **Types.** `input` has `params`, `query`, `body` and `headers`, each required exactly
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
- **Body, binary** must be a `Blob` (anything else throws an `Error`, a client bug). The client sends
  it untouched with `Content-Type: application/octet-stream`.
- **Headers** are sent as given (`String(value)`, `null` and `undefined` skipped), not parsed. Passing
  `headers` to an endpoint that declares none, or leaving them out of one that declares them, throws
  an `Error` at the call (a client bug); the types reject both first.
- **Response.** Every response, a blob included, is parsed with the endpoint's
  schema. A mismatch creates a `ContractError` with the zod issues, passes it to
  the global `ErrorHandler` (`core/errors/app-error-handler.ts`,
  `provideAppErrorHandler()`) so the console shows which field was wrong, then
  rethrows it; `toAppError` still turns it into the usual Vietnamese message.
- **Envelope.** See "Response envelope" below: `envelopeInterceptor` unwraps it before the
  parse above, so a schema describes the payload only.
- **Tag.** Every request carries its endpoint object in the `ENDPOINT`
  `HttpContextToken` (exported by the client). `envelopeInterceptor`, `sessionExpiryInterceptor`, `bearerInterceptor` and the dev mock read it.
- **Streams.** `EndpointClient.stream(endpoint, input)` returns an `Observable` of the events of an
  `ndjson` endpoint. It sends `Accept: application/x-ndjson, application/json` with
  `reportProgress`, reads `DownloadProgress.partialText` as it grows, parses each complete line
  with the endpoint's schema (a mismatch is a `ContractError`, as for `call`) and emits it; the
  final response flushes a last line without `\n`. Unsubscribing aborts the request. An
  `application/x-ndjson` answer passes through `envelopeInterceptor` untouched; a refusal before
  the first line is the usual JSON envelope (an `ApiError`).
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
- **File endpoints and refusals:** a `blob` endpoint passes a file through, but
  `envelopeInterceptor` reads a body whose `Content-Type` is `application/json`
  as an envelope, on a 2xx or an HTTP error, so a refusal (for example the
  export's `LEARNING-EXPORT_TOO_LARGE`) is an `ApiError` with the server's
  message instead of a saved file. An HTTP error without an envelope still
  shows the default message for its kind.
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

Environment files are validated by `AppConfigSchema` at bootstrap. The API is
always called on the app's own origin: see `workspace.md` → Environments. Endpoint paths in the registry always start
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
- **`mockBackend`: specs only.** No environment file sets it, so the running app sends every
  endpoint the backend has to the real backend. `MockBackend` (also the mock-only answerer) extends `FakeBackend`
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
  `mockInterceptors` (only when `mockApi` is true). A narrow ESLint
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
- The running app always uses a real backend: the dev proxy (`apps/lms/proxy.conf.mjs`) sends `/api`
  to the shared one, or to a local one with `LMS_API_TARGET=http://localhost:8019 npm start`. Sign
  in with a real account; the toolbar has no demo-account list. The offline, session-expired and
  forbidden-URL simulations stay. The toolbar is not part of the production build.
- Mid-session 401: see "Expired session" under error handling.

## Identity and organisation contract decisions

- **Access starts with function code.** The backend function codes (`PROFILE`, `COURSE_LEARNING`,
  `USER_MANAGEMENT`, ...) are the menu keys everywhere: the route table (`core/routing/screens.ts`),
  the sidebar, the guards and the role form. `FunctionCodeSchema` is the supported vocabulary, including assistant and community functions. `Me.functionDetails` carries each
  function's name, route and `sortNo`; the sidebar lists them in `sortNo` order, and `homePath` is
  the first eligible function's route excluding `PROFILE`, else `/profile`. Secondary screens
  (catalog, leaderboard, flashcards, saved, certificates, instructor home/inbox, content catalog,
  import and admin home) reuse a function through `Screen.access` without adding a sidebar entry.
  `notifications` remains available to signed-in users; its learner reads are conditional.
  `canOpenFunction` also checks the explicit business-role requirements of the implemented Java
  APIs. It only narrows the functions `/me` supplied and is not a substitute for server authorization.
- **Grants** are `{ roleId, scope: GLOBAL | ORG | TEAM | OWN, orgId?, teamId? }`, with numeric ids.
  `userId` is the staff code, a string whose leading zeros matter. A user has many grants; the
  profile and the user page list all of them. Status is `active | inactive | locked`.
- **Who may do what is the server's call.** The app renders what the backend returns and shows a
  refusal as a toast (`title` as the heading, `message` as the detail); no form maps `errors[]` to a
  field, so the form validators must match the backend's rules (lengths, password 6 to 72 UTF-8
  bytes, `q` up to 100 characters).
- **Paging.** Lists are paged by the server (`PageSchema`, 0-based `page`, `size` up to
  `MAX_PAGE_SIZE`). The users list sorts on the server (`sort=id,asc`). The org tree reads one
  level at a time from `GET /orgs/tree` (no `parentId` for the roots in scope, then `parentId`),
  each level paged; only a node with `hasChildren` can open, and a root whose parent is out of
  scope stays a root. Selectors and search keep `GET /orgs`. The panel of the picked node is one
  `GET /orgs/{id}/contents` (node, direct administrators, a page of teams). A team lists at most
  five members and links to `/admin/users?teamId=` for the rest.
- **Org import.** The "Nhập từ tệp" drawer on `/admin/org` downloads `GET /orgs/import-template`
  (a `blob` endpoint) and sends the `.xlsx` to `POST /orgs/import` as multipart part `file`, first
  with `dryRun=true` (the check), then `dryRun=false`. The app checks only the extension and the
  size (`ORG_IMPORT_LIMITS`); every refusal, `ORGANIZATION-IMPORT_INVALID` included, is the usual
  toast and its `errors[]` are not read. The mock does not parse Excel: a file name containing
  `loi`, a wrong type, a file over 5 MiB or a repeated import is refused.
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
  `Authorization: Bearer <token>` to `/api/` requests except `authV1Endpoints.login`. At boot an unexpired
  token restores the user through `me`; a missing or expired token is anonymous with no request.
  `SessionStore.expire()` removes the stored token.

## Done criteria for a contract change

- Schema, endpoint (with its doc comment), fixture (success, plus the mockup's specific errors as `ERROR` envelopes) all updated.
- `npx nx test contracts mocks` green (fixtures parse).
- `npm start` shows the endpoint answering its example in the app.

## Java integration audit (2026-11-01)

Source of truth: the current controllers, `AssessmentRequests` / `AssessmentViews`,
`LearningAccessPolicy`, `LearningAssessmentAccess.reportScope`, `IdentityAccessPolicy`
and `AuthorizationService` in the sibling `corebanking-academy` repository. The audit
matched the existing backend-served registry methods/paths to the Java source, including
auth, identity, organization, course/media, learning, learner quizzes, knowledge,
assistant and community. Missing optional community filters (`resolutionStatus` on
articles and `reviewThreadId` on comments) were added. This is source verification,
not evidence that a deployed server runs the same revision.

The normal development proxy uses the shared target in `apps/lms/proxy.conf.mjs`;
`LMS_API_TARGET=http://localhost:8019` selects a local backend. No credentials or
remote grants were changed. Local health and the configured target's public OpenAPI
were unavailable during this audit, so authenticated live integration is still pending.

### Assessment administration: actual Java DTOs

`assessmentV1Endpoints` now serves the question bank and quiz configuration as well as
the course editor's quiz picker. The older `assessmentEndpoints` and
`assessmentSqlEndpoints` remain explicitly mock-only historical proposals; the admin
screens no longer call them. Removing `served: 'mock'` from one of those proposals
would not convert its DTO into the Java DTO. Keep wire models and view/form adapters
separate and verify every caller before promoting an endpoint.

All IDs here are JSON numbers except staff codes. Enum values are uppercase.
DTO keys are camelCase (`correctCount`, `contentVersion`, `rowVersion`,
`timeLimitMinutes`, `passPercent`); SQL column names do not travel over HTTP.
Request bodies are sent directly, without a `data` wrapper. Response examples below
are the `data` after envelope unwrapping.

| API                                  | Request                                                                                                                       | Response / semantics                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/competencies`           | Optional `status=ACTIVE/INACTIVE`                                                                                             | Array of `CompetencyView`; ID and label are distinct.                                                                     |
| `GET /api/v1/questions`              | Required `courseId`; optional `q`, `lessonId`, `competencyId`, `questionType`, `difficulty`, `status`, `page`, `size`, `sort` | `PageResponse<QuestionSummary>`; counts/previews only, no options. Sort allowlist: `id`, `code`, `updateTime`.            |
| `GET /api/v1/questions/{id}`         | Numeric question ID                                                                                                           | `QuestionDetail`, including full options, correctness, `usedInQuizzes`, and `rowVersion`. Only fetched when editing.      |
| `POST /api/v1/questions`             | `QuestionRequest` below                                                                                                       | Created `QuestionDetail`. Blank code lets Java generate it.                                                               |
| `PUT /api/v1/questions/{id}`         | `expectedVersion` in query; `QuestionRequest` body                                                                            | Updated `QuestionDetail`. Existing option IDs are preserved; new options omit `id`.                                       |
| `POST /api/v1/questions/bulk-status` | `{ids: number[], status: ACTIVE/INACTIVE}`                                                                                    | `{affected: number}`; one atomic bulk operation, maximum 100 IDs.                                                         |
| `POST /api/v1/questions/bulk-delete` | `{ids: number[]}`                                                                                                             | `{affected: number}`; Java refuses in-use questions.                                                                      |
| `GET /api/v1/quizzes`                | Required `courseId`, page/filter/sort                                                                                         | `PageResponse<QuizSummary>`; includes `gradedAttempts`, `passedAttempts`, `poolSize`, version and schedule.               |
| `GET /api/v1/quizzes/{id}`           | Numeric quiz ID                                                                                                               | `{quiz: QuizView, pool: PoolEntry[], activePoolSize}`.                                                                    |
| `POST /api/v1/quizzes`               | `QuizRequest`                                                                                                                 | `QuizDetail`; always creates a DRAFT. Status and pool are separate operations.                                            |
| `PUT /api/v1/quizzes/{id}`           | `expectedVersion` query + `QuizRequest`                                                                                       | `QuizDetail` with its new `rowVersion`.                                                                                   |
| `PUT /api/v1/quizzes/{id}/questions` | `expectedVersion` query; `{items:[{questionId,sortNo,points}]}`                                                               | `QuizDetail`; `points:null` uses the question default. Existing point overrides and pool order are preserved by the form. |
| `POST /api/v1/quizzes/{id}/publish`  | `{expectedVersion}`                                                                                                           | `QuizDetail`; Java checks active pool size and scheduling.                                                                |
| `POST /api/v1/quizzes/{id}/close`    | `{expectedVersion}`                                                                                                           | `QuizDetail`; Java submits running attempts with their saved answers. The UI asks for confirmation.                       |

Example update: `PUT /api/v1/questions/12?expectedVersion=3`:

```json
{
  "courseId": 1,
  "lessonId": null,
  "competencyId": 2,
  "code": "CH-CIF-01",
  "questionType": "SINGLE",
  "content": "Khi khách hàng đổi CCCD, cần làm gì?",
  "explanation": "Cập nhật trên CIF hiện có.",
  "difficulty": "MEDIUM",
  "points": 1.25,
  "status": "ACTIVE",
  "options": [
    { "id": 31, "content": "Tạo CIF mới", "correct": false },
    { "id": 32, "content": "Cập nhật CIF hiện có", "correct": true }
  ]
}
```

The detail response also carries `id`, `contentVersion`, option `sortNo`,
`usedInQuizzes`, `rowVersion`, `createTime` and `updateTime`. The list summary instead
carries `contentPreview`, `competencyName`, `optionCount`, `correctCount` and
`usedInQuizCount`. Do not fake option arrays from a summary.

`QuizRequest` fields are `courseId`, `title`, `description`, `quizType`
(`PRACTICE/FINAL_EXAM`), `selectionMode` (`FIXED/RANDOM_POOL`), `questionCount`,
`shuffleQuestions`, `shuffleOptions`, `timeLimitMinutes`, nullable `openAt/closeAt`,
`graceSeconds`, `passPercent`, `scoringMode` (`ALL_OR_NOTHING/PARTIAL`), `scoreMethod`
(`BEST/LAST`), `reviewPolicy` (`NEVER/AFTER_SUBMIT/AFTER_PASS/AFTER_CLOSE`),
`maxAttempts`, `retakeWaitHours`, `allowRetakeAfterPass`, `requireLessonsCompleted`.
The form renders and preserves these settings. It converts local dates to ISO only
at submission. A draft may be saved before its pool is ready; publishing enforces
readiness. Saving settings then the pool is **two transactions**: if the second
fails, the FE reports the partial save, preserves input and retries using the
receipt's ID/version instead of creating another draft. It does not retry another
user's version conflict silently.

### Reporting: do not equate training mock aggregates with assessment data

The implemented Java reporting API is `/api/v1/reports/assessment`:

| Read                 | Filters beyond paging                                           | Response                                                                                                                           |
| -------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /overview`      | `orgId`, `teamId`, `courseId`, `quizId`, `from`, `to`           | `gradedAttempts`, `learners`, `passedLearners`, nullable `passRate/averageScore`, `inProgressAttempts`, `byQuiz`, `byOrg`.         |
| `GET /results`       | Common filters + `userId`, attempt `status`, `passed`           | Page of attempts with learner names, historical org/team, score and result.                                                        |
| `GET /learners`      | **Required `quizId`**, `orgId`, `teamId`, `learnerStatus`       | Page including people who have not attempted the quiz, attempts left and BEST/LAST/final scores. No date/course filter is applied. |
| `GET /competency`    | Common filters + `groupBy=user/org`                             | Page by `(groupKey, competencyId)`, with `correctCount`, raw/max score and percent.                                                |
| `GET /questions`     | Common filters                                                  | Page by `(questionId, questionVersion)`, including served/correct/blank counts and `wrongPercent`.                                 |
| `GET /{type}/export` | Same applicable filters/sort as its read, **without page/size** | CSV blob; type is `results/learners/competency/questions`. JSON refusals still go through the envelope interceptor.                |

`from` is inclusive and `to` exclusive, by submission time. All filters only narrow
Java's caller scope. Org/team on results are historical snapshots; learner status
uses the enrollment snapshot. A global header search for a report-only account
opens `/reports/results?userId=<staff code>`, not a nonexistent free-text report
search. The report screen accepts that parameter.

The report UI uses those four dimensions and actual assessment KPI labels. It does
not label exam scores as course-completion percentages, invent weekly series or
send an unsupported training dimension to an assessment endpoint. Old training
report proposals remain mock-only; unsupported deep links show an explicit state.
Report filters currently accept IDs because no general read-only scoped report
lookup API was found; do not call admin-only identity lists for REPORT_VIEWER users.

### Permission and route matrix

`/me.functions` is required for a menu. `canOpenFunction` then narrows it to the
explicit Java role prerequisites below. Both checks operate on effective `/me`
grants; a role and scope must come from the **same** grant. The FE never expands
ORG descendants or supplies actor/scope fields to prove access. Java remains the
security boundary on every list, detail, media download and mutation.

| Function / screen                                                  | Display prerequisites                                        | Java operation boundary                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Learning, progress, quiz-taking and their secondary learner routes | `LEARNER + OWN`                                              | Own enrollment/attempt, currently valid learning access; no learner answer key before permitted review.                   |
| Courses, lessons, question bank, quiz configuration                | `SUPER_ADMIN + GLOBAL`, or ADMIN/INSTRUCTOR grant            | Managed course/resource according to the grant's GLOBAL/ORG subtree/TEAM/OWN policy.                                      |
| Users, organization, audit                                         | `SUPER_ADMIN + GLOBAL`, or `ADMIN + GLOBAL/ORG`              | Identity boundary; response `editable`, grant `revocable` and role `assignableScopes` still decide individual UI actions. |
| Reports                                                            | SUPER_ADMIN/ADMIN/INSTRUCTOR/REPORT_VIEWER + GLOBAL/ORG/TEAM | Read-only scoped rows; OWN alone does not grant reporting.                                                                |
| Community                                                          | Supplied community function                                  | Membership/dynamic grants and response capabilities; not inferred from a learner role.                                    |
| Saved                                                              | Corresponding learner function **and** served integration    | Still no Java endpoint; direct routes are closed with mock API disabled.                                                  |
| Certificates                                                       | `LEARNING_PROGRESS`                                          | Own completed enrollment cycle only; any other id answers `LEARNING-NOT_FOUND`. No download: the browser prints it.       |

Secondary aliases: catalog/saved -> COURSE_LEARNING; leaderboard/certificates ->
LEARNING_PROGRESS; flashcards -> QUIZ_TAKING; instructor/inbox/content-catalog/import
-> COURSE_MANAGEMENT; admin overview -> USER_MANAGEMENT. Aliases do not add sidebar
items. Normal profile and notifications remain available to signed-in users.
SUPER_ADMIN is not an unconditional FE bypass and no real grants were assigned.

Remaining contract gaps: role-definition CRUD (role assignment is already real),
personal notes/bookmarks, old training aggregates, and admin user
learning/activity tabs remain mock proposals. In addition, the assignment target
picker currently reads admin-only identity lists: an INSTRUCTOR without identity
administration can be denied despite having assignment scope. This requires a
scoped, read-only learning target lookup contract; **do not grant ADMIN or relax
IdentityAccessPolicy merely to populate a selector**. It was not converted into a
fabricated backend endpoint in this audit.

### Verification of this integration change

- Static method/path reconciliation: 197 registry entries, 153 backend entries matched
  current Java controller mappings, 44 retained mock proposals, zero unmatched
  backend entries. DTO-level changes focus on assessment authoring/reporting and
  the two missing community query fields; this is not a live conformance check of
  every deployed response.
- 156 relevant Angular tests passed across the affected routing/session/header,
  shell, assessment, report, leaderboard and expiry suites. Additional complete
  library runs passed: contracts 194, mocks 265 and UI 511 tests.
- Nx lint, typecheck, production/staging builds and bundle guards passed for the
  four projects (10 tasks). Initial production bundle remains above its warning
  threshold (about 950 kB), below the 1 MB hard limit. Existing lint/template
  warnings remain outside this change.
- `npm run check` stops at 1,093 pre-existing formatting warnings; none of the
  changed/new source files is in that warning set. The full LMS suite was also
  attempted but did not complete reliably within this environment; its success
  is not claimed. Related suites were rerun separately with limited workers.
- Browser checks on the isolated mock review build: admin question edit with
  decimal points, advanced quiz settings save, report-viewer filtering/CSV,
  report-viewer denial of an admin URL, learner denial of a reporting URL, and
  the default course selector. Console error log was empty on the final review.
- The review build is `dist/api-review/browser`, served locally at
  `http://127.0.0.1:4311`; screenshots are in `dist/api-review/evidence`.
  Only that development artifact uses a mock backend. Source `environment.ts`
  retains its original `mockBackend: false`; production/staging contain no mocks.
- Java source, database schema/data, passwords and real role grants were not
  modified. Live authorization/data-scope tests still require an available
  backend and authorized test accounts.

## Program question bank integration (2026-11-04)

A question belongs to a program; a quiz remains attached to a course. The course
editor and bank reuse trainingCatalogEndpoints.listPrograms:
GET /api/v1/training-catalog/programs?ownerOrgId=<session.org.id>&page=0&size=100.
Further pages are loaded before local name/code search and 50-item selector paging.

programAssessmentEndpoints is the program DTO audience of the actual v1
QuestionController. It shares quiz endpoints with assessmentV1Endpoints and has
no mock-only paths or readiness flag. Full-mock development uses one authoring
state so course lists, program questions and quiz pool versions stay consistent.
Legacy course DTOs remain available for existing clients/import tools.

| API                                                  | Input                                                                                                                 | Unwrapped data                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| GET /api/v1/questions                                | programId; optional courseId for the quiz picker; q, questionType, difficulty, competencyId, status, page, size, sort | Page<ProgramQuestionSummary>                      |
| GET /api/v1/questions/{id}                           | numeric id                                                                                                            | ProgramQuestionDetail                             |
| POST /api/v1/questions                               | ProgramQuestionRequest                                                                                                | ProgramQuestionDetail                             |
| PUT /api/v1/questions/{id}?expectedVersion=N         | id/version + same request                                                                                             | updated detail with rowVersion                    |
| POST /api/v1/questions/bulk-status                   | {ids:[1,9],status:"INACTIVE"}                                                                                         | {affected:2}                                      |
| POST /api/v1/questions/bulk-delete                   | {ids:[1,9]}                                                                                                           | {affected:2}; questions used in pools are refused |
| PUT /api/v1/quizzes/{id}/questions?expectedVersion=N | {items:[{questionId:9,sortNo:0,points:null}]}                                                                         | QuizDetailV1 with new rowVersion                  |

Request example (direct JSON, no envelope):

```json
{
  "programId": 2,
  "competencyId": 1,
  "code": "CT2-001",
  "questionType": "SINGLE",
  "content": "Nội dung câu hỏi?",
  "explanation": "Giải thích đáp án",
  "difficulty": "EASY",
  "points": 1,
  "status": "ACTIVE",
  "options": [
    { "content": "Phương án A", "correct": true },
    { "content": "Phương án B", "correct": false }
  ]
}
```

Detail adds id, programId, contentVersion, rowVersion, createTime, updateTime,
usedInQuizzes; options gain numeric id and sortNo. Backend detail also retains
nullable courseId/lessonId for legacy origins; the program view omits them.
Summary adds contentPreview, competencyName, optionCount, correctCount and
usedInQuizCount. Existing option IDs and expectedVersion are preserved on edit;
a refused save leaves the form open. Question ownership cannot move programs.
Single and bulk deactivation cannot make a published pool too small.

Direct program-bank authoring requires SUPER_ADMIN/GLOBAL or ADMIN/INSTRUCTOR
with GLOBAL/ORG covering the program's real owner org. Course OWN/TEAM scope does
not grant writes to a shared bank. Legacy questions with a course origin retain
their existing course authorization for ID/bulk compatibility. The quiz picker passes courseId as context:
the server checks course management, the actual latest revision's program, and
matching owner org before returning shared candidates. It can select a question
from another course of that program or one created without a course. A different
program is refused. FE menu eligibility mirrors this; actual grants are unchanged.

Quiz creation accepts the context link /admin/quizzes/new?programId=...:
the course picker calls /api/v1/instructor/courses with programId, and the form
still posts the selected courseId to /api/v1/quizzes. The question bank links to
this route; quiz management also filters courses by program. A conflicting
courseId/programId deep link blocks the builder until a matching course is
selected. Changing program preserves quiz settings and clears incompatible
selected questions; a partially created draft locks its scope while retrying the
pool save. Inactive candidates cannot be added, and the publish action explains
when the saved pool has too few active questions, using the server's activePoolSize.

The backend upgrade docs/sql/upgrade/2026-11-04-program-question-bank.sql must run
before deploying the Java change. Existing course origins are retained; programId
is backfilled only when absent and determinable from the latest revision. Unmapped
legacy questions stay on the course API until reviewed. Rollback refuses
course-less questions and cross-course pools rather than discarding them. No
migration was applied to a shared database. Deployment/proxy configuration must
point at the upgraded backend; source environment.mockBackend stays false.
