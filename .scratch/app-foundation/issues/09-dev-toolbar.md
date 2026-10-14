# 09: Dev toolbar and production bundle check

**What to build:** in `core/dev/`, the dev toolbar replacing the mockup's "Demo" menu (switch role via demo sign-in + `Prefer: example=<role>`, simulate offline, session expiry and a forbidden URL, open the design system) and `mockScenarioInterceptor`; loaded only when `devTools` is true. Adds a scripted check that `dist/apps/lms` contains neither the toolbar nor the migration board, and fixes the board's route so it passes. See spec.

**Blocked by:** 06 — Header, nav counts and user menu

**Status:** ready-for-agent

- [ ] No dev code or owner names in the production build (check runs in `npm run check` or CI)
- [x] Role switch updates shell, nav and home
- [x] Specs cover the interceptor's `Prefer` header and each toolbar action
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark, keyboard only
- [ ] `npm run check` green; own pull request
