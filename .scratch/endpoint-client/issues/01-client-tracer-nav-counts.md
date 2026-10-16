# 01: Tracer bullet: `EndpointClient` through the shell nav counts

**What to build:** The app's `core/http` gets `EndpointClient` with one method, `call(endpoint, input)`, plus the exported `ENDPOINT` `HttpContextToken`. The call takes the verb from `endpoint.method` and the URL from `toUrl`. It sends query objects with the documented rule (skip null/undefined, repeat the key for arrays, `String(v)` otherwise), sends a JSON body unchanged, and parses the response with `endpoint.response`. A mismatch creates a `ContractError`, passes it to `ErrorHandler.handleError`, then rethrows. `CallInput` makes `params`/`query`/`body` required exactly when the endpoint declares them and forbidden otherwise. The shell store calls `client.call(shellEndpoints.navCounts)`; `NavCountsApi` and its spec are deleted. Multipart and blob are not part of this ticket (see 04). See spec: `docs/specs/endpoint-client.md`, Implementation Decisions → `EndpointClient`.

**Blocked by:** None (can start immediately)

**Status:** open

- [ ] `endpoint-client.spec.ts` with endpoints declared inside the spec: verb from the registry; path params; query rule; JSON body passed through; response mismatch reaches `ErrorHandler` and errors the stream; `ENDPOINT` context set; `@ts-expect-error` for missing params and for a body on an endpoint without one
- [ ] `ShellStore` uses the client; `NavCountsApi` and `nav-counts.api.spec.ts` deleted
- [ ] App shell spec passes without edits beyond the injected service
- [ ] `npm run check` green
