# 08: Login screen

**What to build:** in `features/auth`, the login page on the `bare` layout ported from `pages/auth.js`: brand panel, `ui-field` email and password with show/hide toggle, `next` notice, 422 details on fields, 401/423 on the password field with "Không đăng nhập được", demo account grid (`demoAccounts`), "Thử đăng nhập tài khoản đã bị khóa", success toast and redirect to `next` or role home. Signed-in users visiting `/login` go home. See spec.

**Blocked by:** 03 — Route table, guards, appCan and placeholders

**Status:** done (browser side-by-side and own PR criteria left unticked)

- [x] Signal Forms with the form schema derived from `LoginCommandSchema`
- [x] Submit button busy state; error summary focus on failure
- [x] Specs cover success, 422, 401, 423, `next` and demo sign-in
- [ ] Checklist entry `route-login` done
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark, keyboard only
- [ ] `npm run check` green; own pull request
