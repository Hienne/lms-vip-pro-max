# 06: Header, nav counts and user menu

**What to build:** header with global search (`role="search"`, routes per role), notification bell (dot and "Thông báo, n chưa đọc" label), user menu (name · email, Hồ sơ cá nhân, Thông báo, Đăng xuất with `confirm()`), inbox count on the sidebar item; contract `GET /api/me/nav-counts` `{ notifications, inbox }` with fixtures and Prism examples, loaded by a shell store. See spec.

**Blocked by:** 05 — App shell, sidebar and layouts

**Status:** ready-for-agent

- [ ] Endpoint, schema, fixtures and examples follow `contracts-and-mocks.md`
- [ ] Sign-out confirmation copy and success toast match the mockup
- [ ] Specs cover search routing per role, counts and labels, menu items and sign-out
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark, keyboard only
- [ ] `npm run check` green; own pull request
