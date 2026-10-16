# 02: Every store on `EndpointClient`; API services deleted

**What to build:** The session, login, profile and dev-toolbar stores and the five admin-org stores call `EndpointClient` instead of `AuthApi` / `AdminOrgApi`, inside their existing `serverData` / `serverMutation` / `rxResource` factories, with unchanged behaviour. `AuthApi`, `AdminOrgApi` and `auth.api.spec.ts` are deleted. Each `*.endpoints.ts` header says its keys follow the mockup's `api/*.js` function names. After this ticket nothing in the app injects `HttpClient` for `/api` calls except `EndpointClient`. See spec: `docs/specs/endpoint-client.md`, Implementation Decisions → Stores.

**Blocked by:** 01 (client tracer)

**Status:** open

- [ ] No `*.api.ts` left under `apps/lms/src/app`
- [ ] Session, login, profile, dev toolbar, users, org, roles and user-detail specs pass; any edit besides swapping the injected service is listed with its reason
- [ ] `npm run check` green
