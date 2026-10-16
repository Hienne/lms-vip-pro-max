# Spec: One screen table for routes, menus and navigation

Status: ready for implementation · Labels: `ready-for-agent`

## Problem Statement

What the app knows about one screen is spread over up to five tables that agree
only because the same strings are typed in each of them. For `/admin/users`:

- `ROUTE_DEFS` (core routing) holds the path, the page title, the layout, the
  menu that grants it and the mockup page it replaces.
- `SCREENS` (the app routes) maps the same path, as a plain string key, to the
  migrated component's loader.
- `MENU_CATALOG` (core menu) holds the sidebar entry of the menu: key, `href`,
  icon, label, section and badge.
- `SEARCH_PATHS` (header search) pairs a menu with a path the search sends to.
- The shell and the dev toolbar navigate to path literals.

A **menu** (`MenuKey`, 22 keys in the contract) is the unit of access the
server grants to a role. It covers several **routes** (37 in the table): every
sub-route of a menu is open to whoever holds it, and the menu has exactly one
sidebar entry, which links to its entry route. Five rules connect the tables,
and nothing checks any of them:

1. Every `MenuKey` has exactly one sidebar entry. `MENU_CATALOG` is typed as an
   array, so a key added to the contract and missing from the catalog still
   compiles. A role granted that menu then shows no sidebar item, the role
   form offers no checkbox for it, and the 403 page names the raw key.
2. Every menu `href` is a route. A typo sends the sidebar link to 404, and the
   item is never marked current.
3. The route a menu `href` points to requires that same menu. Otherwise the
   user who holds the menu clicks its sidebar item and lands on 403.
4. Every `SCREENS` key is a route path. A typo silently keeps the placeholder
   on a screen the migration board may already call done.
5. Every navigation literal (search, shell, dev toolbar) is a route that
   requires the menu it is paired with. Renaming a route leaves them pointing
   at 404.

All five hold today. The risk is the next ~30 screen migrations, each of which
touches these tables, and the new menus the remaining admin screens may add.

## Solution

One table, in core routing, declares every screen once. It is grouped by menu:
each menu key owns its sidebar entry, its search target and its screens, and
the first screen of a group is where the sidebar entry links to. Screens that
belong to no menu sit in one separate group. The loader of a migrated screen is
written on the screen itself.

Rules 2 and 3 then hold by construction: a menu's `href` is its first screen,
and a screen's menu is the group it is written in. There is no second table to
disagree with. Rule 1 is a compile error (the groups are keyed by `MenuKey`).
Rule 4 disappears with the separate loader map. Rule 5 is a compile error for
the shell and the dev toolbar (they navigate through a helper that only takes
static paths of the table) and disappears for search (the target is a field of
the menu group). What types cannot catch is checked by a spec.

Everything the router, the guards, the sidebar, the role form, the 403 page and
the header search read is derived from the table. Their behaviour does not
change, and neither do the functions they call.

## User Stories

1. As a developer migrating a screen, I want to wire its component by adding a loader to its entry in the screen table, so that registering a migrated screen is one edit in one place.
2. As a developer migrating a screen, I want a mistyped path to be impossible when wiring the component, so that a finished screen can never silently keep the placeholder.
3. As a developer, I want a screen without a loader to show the placeholder naming its mockup page, so that unmigrated routes keep working as today.
4. As a developer adding a sub-route to an existing menu, I want to add one screen to that menu's group, so that the route, its title, its layout and its access rule are declared together.
5. As a developer adding a menu key to the contract, I want the build to fail until the screen table has a group for it, so that no menu a role can be granted lacks a sidebar entry.
6. As a developer, I want a menu's sidebar link to be its first screen, so that the link cannot point at a route that does not exist.
7. As a developer, I want a screen's required menu to be the group it is declared in, so that a sidebar link can never lead its own menu's holder to 403.
8. As a developer, I want the sidebar label to default to the title of the menu's first screen, so that I only write a label where the sidebar wording differs from the page title.
9. As a developer, I want the four menus whose sidebar label differs from their page title to keep their current sidebar wording, so that the UI copy stays as in the mockup.
10. As a developer, I want sidebar order and section grouping to follow the order of the groups in the table, so that the sidebar is read off the table top to bottom.
11. As a developer, I want the header search target to be a field of the menu group, so that adding a searchable list is declared beside the menu it belongs to.
12. As a developer, I want a search target that is a route with parameters (the reports detail) to be checked against the screens of its own group, so that search cannot send a user to a page their menu does not open.
13. As a developer, I want the search priority to follow table order, so that there is no separate priority list to keep in step.
14. As a developer, I want the shell and the dev toolbar to navigate through a helper that only accepts static screen paths, so that renaming a screen breaks the build instead of a link.
15. As a developer, I want the root redirect, the design system, the dev-only routes and the not-found route to stay outside the table, so that the table holds only screens and the production build still drops the dev routes.
16. As a developer, I want screens that belong to no menu (login, profile, notifications, quiz result, 403) declared in the same table, so that every screen with a path is declared in one place.
17. As a developer, I want the login screen to keep being public, visitor-only and bare, so that sign-in behaves as today.
18. As a developer, I want a spec to fail when two groups declare the same path, so that the one duplicate types cannot see is still caught.
19. As a developer, I want a spec to fail when a menu's first screen has a route parameter, so that every sidebar link is a concrete URL.
20. As a developer flipping a route entry to done on the migration board, I want a spec to fail when that screen has no loader, so that "done" always means the real component renders.
21. As a developer, I want core to be unable to import feature code statically, so that the only link from core to features is the lazy loader in the screen table.
22. As a developer reading the conventions, I want angular.md and the migration guide to point at the screen table, so that the docs describe how screens are registered now.
23. As a learner, I want my sidebar to show the same items, in the same sections and order, so that nothing moves after the change.
24. As a custom-role user, I want to see exactly the menus my role holds, so that access shown in the sidebar still matches what the server grants.
25. As a user on a sub-route (for example creating a course), I want the sidebar to mark the menu the page belongs to and not its parent's overview, so that I can tell where I am.
26. As a user opening a page outside my menus, I want to land on 403 with the name of the menu it belongs to, so that I know what to ask an administrator for.
27. As an anonymous visitor, I want any protected page to send me to sign in and bring me back afterwards, so that deep links still work.
28. As a user, I want the header search to send me to the first list my menus open, so that search behaves as in the mockup.
29. As an administrator editing a role, I want the menu checkboxes grouped and labelled as in the sidebar, so that I grant the menus I see.
30. As a user, I want page titles and layouts (focus for lesson and quiz-taking, bare for login) unchanged, so that every screen looks as before.
31. As a user, I want the profile, notifications and sign-out choices in the user menu to go where they did, so that the header still works.

## Implementation Decisions

- **Screen table.** A new core routing module holds the only declaration of
  screens. Its shape:
  - A `menus` group keyed by `MenuKey` and checked with `satisfies` against a
    record of every key, so a missing key is a compile error. Key order is
    sidebar order; menu keys are non-numeric strings, so object order is
    insertion order.
  - Each menu group has `nav` (icon, section, optional badge, optional label),
    an optional `search` (with an optional `href` for a parametrised target)
    and a non-empty, ordered list of `screens`. The first screen is the menu's
    entry: the sidebar `href` and the default search target.
  - An `open` list holds the screens that require no menu.
  - Each screen has `path` (no leading slash), `title`, `mockupPage`, optional
    `layout` (default `app`), optional `public` and `guestOnly` (login only),
    and an optional `load` (a lazy `import()` of the route component). No
    `load` means the route placeholder.
  - The table is declared `as const` so that two path types derive from it:
    `ScreenPath` (every path) and `StaticScreenPath` (paths without a `:param`).
- **Sidebar labels.** `nav.label` defaults to the title of the group's first
  screen. Four groups override it to keep the current sidebar copy:
  `admin.home` ("Tổng quan"), `content.import` ("Nhập dữ liệu"),
  `admin.assignments` ("Giao học & hạn") and `reports` ("Báo cáo").
- **Search.** `learn.catalog`, `content.courses` and `reports` carry `search`;
  `reports` sets `href` to its learners report. Priority is table order, which
  equals today's order. `searchTarget` and `searchPlaceholder` keep their
  signatures; the placeholder wording stays a choice by `MenuKey` beside them.
  `SEARCH_PATHS` is removed.
- **Derived interfaces keep their signatures.** `navFor`, `allSections`,
  `menuLabel` and `activeHref` (core menu) and `menuOf` (core routing) are
  re-implemented on the table and return the same `NavSection` / `MenuItem`
  shapes. Consumers (sidebar, role form, roles page, user detail, profile, 403
  page, guards) do not change, or change only an import.
- **Removed:** `ROUTE_DEFS`, `RouteDef`, the array `MENU_CATALOG`, the `SCREENS`
  loader map in the app routes, `SEARCH_PATHS`.
- **App routes.** `createAppRoutes` maps every table screen to a route exactly
  as `toRoute` does today (`pathMatch: 'full'`, title, `data` with `menu`,
  `layout`, `mockupPage`, `authGuard` + `menuGuard` unless public,
  `guestGuard` when visitor-only, `unsavedChangesGuard`, `load` or the
  placeholder). Because every screen matches the full path, route order is not
  significant. The root redirect, `design-system`, the dev routes and the
  wildcard stay as they are, with `HOME_META` and `NOT_FOUND_META`.
- **`screenHref`.** A helper takes a `StaticScreenPath` and returns the URL with
  a leading slash. The shell store (profile, notifications, login after
  sign-out) and the dev toolbar (the admin URL check) navigate through it. No
  parametrised variant is built until a caller needs one. `/design-system` is
  outside the table and stays a literal.
- **Import direction.** The screen table is the one core module that names
  feature code, and only through `import()` (the dev features module already
  does the same for the migration board). An ESLint `no-restricted-imports`
  rule on core forbids static imports from features; it does not apply to
  dynamic `import()`, so the loaders stay legal. Confirm that behaviour of the
  rule while implementing.
- **Migration registry.** Stays a separate table. Its route `target` stays a
  string: it also names routes outside the screen table (`design-system/…`,
  `dev/migration`), and `todo` / `in-progress` entries may name routes that do
  not exist yet. The existing spec that walks `createAppRoutes` keeps catching
  drift.
- **Access stays on the server.** The table only declares which menu a route
  belongs to. Which menus a user holds still comes from the session the server
  returns; nothing in the table evaluates permissions.
- **Docs.**
  - angular.md §4: core may reference features only through the lazy loaders
    of the screen table; static imports are blocked by lint.
  - angular.md §10: screens are lazy-loaded from the screen table, not
    declared in the app routes.
  - Migration guide: the `routes[]`, `layout` and `public` rows point at the
    screen table and its fields; drop `roleGuard` and per-feature
    `*.routes.ts`; the "Route module" step ends with adding `load` to the
    screen's entry.

## Testing Decisions

- A good test here drives the app the way the router, the shell and a user do,
  and asserts what they observe: which component renders, where a guard
  redirects, which sidebar items exist and which is current, where search goes.
  It does not assert the table's internal shape.
- **Router seam (existing route-table spec, renamed for the screen table).**
  Through `RouterTestingHarness` on `createAppRoutes`: visitor to login with
  `next`, menu holder gets the screen or placeholder, custom role sees only its
  menus' screens, open screens for any signed-in user, 403 with the menu,
  route `data` carries menu and layout. The "every mockup route" assertion reads
  paths from the table and compares as a set, since the table is grouped by
  menu and no longer in mockup order. New table invariants here: no duplicate
  path; every group's first screen has no `:param`; every `search.href`
  matches a screen of its own group.
- **Shell seam (existing app-shell spec).** Must pass with no assertion
  changed: sidebar per role and custom role, longest-match `aria-current`,
  current mark moving on navigation, search routing and placeholder per role,
  the inbox badge, the user menu's profile / notifications / sign-out. This is
  the main regression proof.
- **Migration registry spec (existing).** One new case: every route entry that
  is `done` and targets a screen of the table points at a screen with `load`.
- **Pure functions.** The search-target spec keeps its cases unchanged. A small
  spec covers what the shell spec does not: `navFor` section order and grouping
  for a role, `allSections` listing every menu, and the four overridden labels
  through `menuLabel`.
- **Lint.** The core import rule is verified by `npm run check`; no spec.
- Prior art: the route-table spec (`RouterTestingHarness`, fake session),
  the app-shell spec (host component, demo profiles from `@lms/mocks`), the
  search-target spec (`it.each` over menus), the migration-registry spec
  (walking `createAppRoutes`).
- Done means `npm run check` green, the angular.md §14 checklist, and a browser
  pass: the sidebar of the learner, instructor and admin demo accounts and one
  custom role; `/admin/courses/new` marks "Khóa học"; a menu the role lacks
  goes to 403; search goes to the expected list.

## Out of Scope

- The return-to (`?next=`) half of the architecture review's candidate 4: core
  routing already owns both ends of it.
- Merging the migration registry into the screen table, or typing its targets.
- A parametrised `screenHref`.
- Moving the root redirect, design-system, dev or not-found routes into the
  table.
- Any change to who may open what: role → menu stays a server decision.
- Candidates 01–03 of the architecture review (admin collection module, endpoint
  call adapter, drawer editor); this change touches none of their files.

## Further Notes

- Source: architecture review of 15 Oct 2026, candidate 4 ("Một screen
  definition thay cho 5 bảng đường dẫn rời nhau"), settled in a grilling
  session on 16 Oct 2026. The review proposed one table; keeping two tables
  joined by types was considered and rejected because a link between two tables
  can still be bypassed, while grouping by menu leaves nothing to link.
- The change is independent of the open admin-org work and can ship as its own
  pull request.
- Expected diff for a future migrated screen after this lands: one `load` line
  in the screen table plus its migration registry entry.
