# 01: Format pipes and clock token

**What to build:** in `libs/ui`, pure pipes porting `fmt.*` from `lms-mockup/src/core/html.js`: `fmtNum`, `fmtPct`, `fmtScore`, `fmtDate`, `fmtDatetime`, `fmtTime`, `fmtMinutes`, `fmtBytes`, `fmtRelative`, `fmtDaysLeft`, all `vi-VN`, plus a `NOW` injection token defaulting to `Date.now`. See spec: `docs/specs/app-foundation.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Output matches the mockup for every helper, including `—` for empty values
- [ ] `fmtRelative` and `fmtDaysLeft` read `NOW`; no direct `Date.now()` in pipes
- [ ] Specs cover each pipe at fixed inputs, thresholds (`< 60` minutes, `> 1 MB`, 30 days) and empty values
- [ ] Exported from `@lms/ui`; documented in `ui-library.md`
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark, keyboard only
- [ ] `npm run check` green; own pull request
