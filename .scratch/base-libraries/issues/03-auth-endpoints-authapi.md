# 03: Auth endpoints, examples and AuthApi

**What to build:** The login screen's backend contract, mockable today. Auth endpoints `login`, `loginDemo`, `logout`, `profile`, `demoAccounts` are declared with their statuses (login 401/422/423, loginDemo 404/423, profile 401). Fixtures provide each success and each error body with the mockup's Vietnamese messages, plus role examples for `profile`. Prism serves them, selectable with `Prefer`. The app gets `AuthApi` with the same method names, parsing every response. See spec: Auth endpoints, App HTTP layer.

**Blocked by:** 02 — Identity schemas and fixtures

**Status:** ready-for-agent

- [ ] Endpoints, command and response schemas declared; names match `api/auth.js`
- [ ] Examples: `default`, one per declared status, role-named examples for `profile`
- [ ] `Prefer: code=423` and `Prefer: example=admin` return the right bodies through the dev proxy (checked and recorded in the pull request)
- [ ] `AuthApi` methods call the registry URLs and parse with the endpoint schema
- [ ] Spec with `HttpTestingController` and `@lms/mocks` fixtures: success per method, 422 keeps field details, 423 → `locked`, 401 → `unauthorized`, contract mismatch → `contract`
- [ ] `npm run check` green; own pull request
