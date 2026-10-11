# 02: Migration checklist and progress board

**What to build:** The shared record of migration progress for a team working
in parallel. A typed registry validated by zod lists every row of the
component inventory and every mockup route, each with kind, mockup source,
Angular target, atomic level (components), README checklist codes, status
(`todo` / `in-progress` / `done`), owner (GitHub username), pull request link
and verify checks (light/dark, 375/768/1280, keyboard, error states). Tests
keep it in sync with the code. `/design-system` sections render a "Chưa
migrate" placeholder for every demo whose entry is not done, so later tickets
only add an entry and swap a placeholder for a demo. A progress board route
shows the registry in development and staging only, gated by a new
`devTools` flag in the runtime config. A pull request template and code
owners make every contribution follow the same steps. See the spec:
Migration checklist, Runtime config, Collaboration.

**Blocked by:** 01 — Theme tokens, base styles and the `/design-system` shell

**Status:** ready-for-agent

- [ ] Registry contains every component inventory row and every route of the mockup router; all start as `todo` except pieces already built (`done`, only performed checks ticked)
- [ ] Schema rules enforced: owner required unless `todo`; `done` requires every applicable verify check
- [ ] Spec fails when an `@lms/ui` export has no component entry, when a route has no route entry, and when an entry targets an export or route that does not exist
- [ ] Every remaining `/design-system` section from the mockup (1–13, section 14 dropped) is present with a heading and a "Chưa migrate" placeholder for each demo, driven only by the registry; production shows the status only, never owner or pull request
- [ ] `AppConfigSchema` has `devTools`: true in development and staging, false in production; the config spec covers all three environment files
- [ ] Progress board route is registered only when `devTools` is true; it groups entries by kind and status, shows owner, pull request link, verify checks and summary counts
- [ ] Route spec: board present with `devTools` true, absent with false; placeholders render for `todo` entries
- [ ] Pull request template lists `npm run check`, angular.md §14, the migration verify step and the checklist update
- [ ] Code owners cover the UI library, the contracts library and the docs (repository owner for now, with a note to add reviewers)
- [ ] Migration doc points to the registry as the single record of progress and explains how to claim and complete an entry; workspace doc documents `devTools`
- [ ] Board checked on a staging build and absent from a production build
- [ ] `npm run check` green; merged through its own pull request
