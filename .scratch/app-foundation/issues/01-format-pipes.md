# 01: Format pipes and clock token

**What to build:** in `libs/ui`, pure pipes porting `fmt.*` from `lms-mockup/src/core/html.js`: `fmtNum`, `fmtPct`, `fmtScore`, `fmtDate`, `fmtDatetime`, `fmtTime`, `fmtMinutes`, `fmtBytes`, `fmtRelative`, `fmtDaysLeft`, all `vi-VN`, plus a `NOW` injection token defaulting to `Date.now`. See spec: `docs/specs/app-foundation.md`.

**Blocked by:** None (can start immediately)

**Status:** done (browser side-by-side and own PR criteria left unticked)

- [x] Output matches the mockup for every helper, including `—` for empty values
- [x] `fmtRelative` and `fmtDaysLeft` read `NOW`; no direct `Date.now()` in pipes
- [x] Specs cover each pipe at fixed inputs, thresholds (`< 60` minutes, `> 1 MB`, 30 days) and empty values
- [x] Exported from `@lms/ui`; documented in `ui-library.md`
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark, keyboard only
- [x] `npm run check` green; own pull request
