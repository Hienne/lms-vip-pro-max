# 05: Docs and acceptance

**What to build:** The docs describe the new shape, and the whole change ships as one pull request. In angular.md, §5 shows `EndpointClient ─► Store ─► Component`, §5.1 becomes "Calling endpoints", the naming table drops `API service`, and the §14 checklist line on API calls is updated. contracts-and-mocks.md drops OpenAPI, Prism, error lists and `summary`. It adds `encoding` / `responseType`, the multipart and query rules, `EndpointClient`, the in-app mock and its wiring, the provisional `ApiErrorSchema`, the blob-error limit, and the extension rule: a new transport kind means a new endpoint field plus a client branch, never a new API service or a direct `HttpClient` call. The AGENTS.md stack line drops Prism. workspace.md drops `apps/mock-api` and `type:mock-server` and describes the mocks exception. mockup-to-angular.md updates its XApi and Prism rows. See spec: `docs/specs/endpoint-client.md`, Docs and Further Notes.

**Blocked by:** 03 (in-app mock), 04 (multipart, blob, FileSaver)

**Status:** done

- [x] No doc mentions XApi, API service methods, Prism, OpenAPI, `errors` or `summary` as current practice (`grep` clean apart from history)
- [x] Full smoke test with the in-app mock, with screenshots
- [x] `npm run check` green and the angular.md §14 checklist passes
- [x] Pull request opened; it states the known limits and the hand-off of mid-session 401 to the return-to work
