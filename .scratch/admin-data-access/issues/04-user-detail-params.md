# 04: User page on the primitives, with keyed reads

**What to build:** `serverData` accepts `params`: while they are `undefined` the read stays idle; when they change (compared by value) the last value is dropped; on an invalidation reload or `reload()` it is kept. The user page (`UserDetailStore`) reads the user by route id with the editor's token, so going from one user's page to another never shows the previous user, while an edit or lock on the current user keeps the details on screen during the reload. The custom linked signal goes away. See spec: `docs/specs/admin-data-access.md`.

**Blocked by:** 03 (user editor exposes its invalidation token)

**Status:** ready-for-agent

- [ ] Primitive spec extended: idle while params are undefined; value dropped on a params change; value kept on an invalidation reload with the same params
- [ ] `UserDetailStore` uses only the primitives for API calls
- [ ] User-detail page spec passes without edits
- [ ] Smoke test against Prism: switch between two users' pages; lock the current user and see the page reload in place
- [ ] `npm run check` green
