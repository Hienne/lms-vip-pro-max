# 01: Contract toolkit tracer bullet (health endpoint end to end)

**What to build:** One endpoint travels the whole chain. `@lms/contracts` gets `defineEndpoint`, `toUrl` and `ApiErrorSchema`; the existing health check is redeclared as a registered endpoint; `build-spec` generates the OpenAPI document by walking endpoint registries instead of hard-coding the health operation; the app gets `parseResponse`, `ContractError`, `AppError` and `toAppError` plus a global error handler. A spec calls the health endpoint through `HttpClient` and the new operators. See spec: Contract toolkit, Mock server, App HTTP layer.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `defineEndpoint` captures method, `/api/` path, summary, params/query/body/response schemas and declared error statuses; `toUrl` fills path params and rejects missing ones at type level
- [ ] `ApiErrorSchema` is `{ message, details? }` with field-to-message details
- [ ] `build-spec` emits operations from every registry (health included) with request/response schemas and `default` examples; Prism starts and answers `/api/health` through the proxy
- [ ] `parseResponse` throws `ContractError` with zod issues on mismatch
- [ ] `toAppError` maps status 0 → `offline`, 401 → `unauthorized`, 403 → `forbidden`, 404 → `not-found`, 422 → `invalid` (keeps details), 423 → `locked`, `ContractError` → `contract`, anything else → `unknown`, each with a Vietnamese default message from the mockup
- [ ] Global error handler reports unexpected errors
- [ ] Specs: `toUrl`, schema cases, `toAppError` table, health call success and contract mismatch with `HttpTestingController`
- [ ] Contracts-and-mocks doc updated where the implementation differs
- [ ] `npm run check` green; own pull request
