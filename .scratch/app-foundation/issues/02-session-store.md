# 02: Session store, boot restore and role home

**What to build:** `SessionStore` in `core/session/` (state: profile; selectors `user$`, `role$`, `perms$`, `isSignedIn$`; commands `restore`, `signIn`, `signInDemo`, `signOut`) on `AuthApi`; boot restore through an app initializer (401 → anonymous); the `HOME` role map and the `/` redirect. Thin end to end: reload keeps the user, `/` lands on the role home placeholder. See spec.

**Blocked by:** None (can start immediately)

**Status:** done (browser side-by-side and own PR criteria left unticked)

- [x] Role and permissions read only from the profile
- [x] Boot shows a loading state, then the app; a non-401 failure renders `ui-error-state` with retry
- [x] Token handling kept behind store commands (interceptor spec plugs in later)
- [x] Specs with `HttpTestingController` and `@lms/mocks`: restore, anonymous, sign-in, demo sign-in, sign-out, home redirect per role
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark, keyboard only
- [x] `npm run check` green; own pull request
