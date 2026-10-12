# 02: Identity schemas and fixtures

**What to build:** The shared identity domain ported from the mockup: `RoleSchema`, `AccountStatusSchema`, `PublishStatusSchema`, unit, group and user schemas in `@lms/contracts`, and fixtures in `@lms/mocks` for the seed's units, groups and users (every README demo account included). A fixtures spec parses every fixture. See spec: Domain schemas, Fixtures.

**Blocked by:** 01 — Contract toolkit tracer bullet

**Status:** done

- [x] Schemas mirror `core/types.js` (enums as `z.enum`, ISO date strings, nullable `adminScope`, `lastLoginAt`); types via `z.infer`
- [x] Fixtures hold the seed's units, groups and users with the mockup's ids, names and roles
- [x] Fixtures spec parses every fixture and asserts the README demo accounts exist
- [x] Display labels (Vietnamese role names) stay out of contracts
- [ ] `npm run check` green; own pull request (skipped: delivered on a local integration branch, no PR)
