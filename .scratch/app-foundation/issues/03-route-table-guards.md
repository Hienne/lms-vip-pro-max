# 03: Route table, guards, appCan and placeholders

**What to build:** every route of the mockup's `routes[]` registered with `data.roles` and `data.layout`; `authGuard` (anonymous → `/login?next=`), `roleGuard` (→ `/403` with allowed roles), `permissionGuard`; `*appCan` directive; `RoutePlaceholder` for unmigrated routes (mockup page name, link to `/dev/migration` in dev). See spec.

**Blocked by:** 02 — Session store, boot restore and role home

**Status:** ready-for-agent

- [x] Route list matches the mockup and the checklist route ids
- [x] `*appCan` accepts one permission or a list (all required) and updates when the session changes
- [x] Router specs with `RouterTestingHarness`: anonymous, wrong role, allowed role, `next` preserved
- [x] `*appCan` spec per permission
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark, keyboard only
- [x] `npm run check` green; own pull request
