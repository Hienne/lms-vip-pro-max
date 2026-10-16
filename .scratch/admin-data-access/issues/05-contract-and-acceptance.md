# 05: Contract: tighten the checklist and accept

**What to build:** With every admin-org store migrated, the convention becomes enforceable: the angular.md §14 checklist line reads "Every API call goes through `serverData`/`serverMutation`, or `rxResource` with a stated reason", and no admin-org store calls `rxResource` directly. The whole change is verified end to end and proposed as one pull request, with mutation concurrency recorded as a known limitation and offered as separate follow-up work. See spec: `docs/specs/admin-data-access.md`, Further Notes.

**Blocked by:** 02 (org screen), 04 (user page)

**Status:** ready-for-agent

- [ ] §14 checklist updated; every remaining raw `rxResource` in the app (session, shell, login, profile) has a comment giving the reason, or is listed in the PR as out of scope
- [ ] The four admin-org page specs are unchanged against `main`
- [ ] Full smoke test against Prism over the roles, org, users and user pages
- [ ] `npm run check` green and the angular.md §14 checklist passes
- [ ] Pull request opened; it states the concurrency limitation and the hand-offs to architecture review #02 and #03
