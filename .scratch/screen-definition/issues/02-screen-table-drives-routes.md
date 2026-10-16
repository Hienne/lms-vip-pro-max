# 02: Tracer bullet: the screen table drives every route

**What to build:** Every screen with a path is declared once, in a screen table in core routing, and the router is built from it. The table has a `menus` group keyed by `MenuKey` and checked against a record of every key (a missing key is a compile error), each group holding its ordered `screens`, and an `open` list for screens that need no menu (login, profile, notifications, quiz result, 403). A screen has `path`, `title`, `mockupPage`, optional `layout`, optional `public` / `guestOnly` (login only) and an optional `load` (lazy `import()` of the component; absent means the placeholder). The table is `as const` and exports `ScreenPath` and `StaticScreenPath`. `createAppRoutes` maps each screen exactly as `toRoute` does today; the root redirect, design-system, dev routes and wildcard stay as they are. `ROUTE_DEFS`, `RouteDef` and the `SCREENS` loader map are removed; `menuOf`, `RouteMeta`, `HOME_META` and `NOT_FOUND_META` keep their meaning. The sidebar and search still read their own tables in this ticket (03 and 04 move them). angular.md §10 and the migration guide point at the screen table. See spec: `docs/specs/screen-definition.md`, Implementation Decisions → Screen table, App routes, Removed, Docs.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Every one of the 37 mockup routes is in the table, under the menu that grants it today or in `open`
  - The table has 38 routes, not 37: the old `ROUTE_DEFS` had 38 and all are kept.
- [x] Removing a `MenuKey` group from the table fails `typecheck`
- [x] The seven migrated screens (login, profile, admin users, user detail, org, roles, 403) render their components; every other screen renders the placeholder naming its mockup page
  - Browser: login, 403, users, user detail, org and roles checked; profile is covered by its own spec only, not opened in the browser.
- [x] Route-table spec reads paths from the table and compares the mockup route list as a set
- [x] Route-table spec: no path appears twice in the table
- [ ] Every existing route-table spec case (visitor to login with `next`, menu holder enters, custom role, open screens, 403 with menu, `data` carries menu and layout) passes without changed assertions
  - Not met as written: the "carries the menu and layout in route data" case read `ROUTE_DEFS` and was rewritten to read `createAppRoutes` data. The other cases pass unchanged.
- [x] Migration-registry spec: every `done` route entry that targets a table screen points at a screen with `load`
- [x] App-shell spec passes unchanged
- [x] angular.md §10 says screens are lazy-loaded from the screen table; the migration guide's `routes[]`, `layout` and `public` rows point at the table, `roleGuard` and per-feature `*.routes.ts` are gone, and the "Route module" step ends with adding `load` to the screen
- [x] Browser: the learner, instructor and admin demo accounts each reach their home and a menu screen; a menu the role lacks goes to 403; `/lesson/…` is focus layout and `/login` is bare
- [x] `npm run check` green
