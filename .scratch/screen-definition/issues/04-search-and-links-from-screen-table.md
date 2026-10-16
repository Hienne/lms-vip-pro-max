# 04: Header search and navigation links go through the screen table

**What to build:** The header search target and the shell's and dev toolbar's links can no longer drift from the routes. `learn.catalog`, `content.courses` and `reports` groups carry `search`; without `href` search goes to the group's first screen, and `reports` sets `href` to its learners report. Search priority is table order (today's order). `searchTarget` and `searchPlaceholder` keep their signatures; `SEARCH_PATHS` is removed. A `screenHref` helper takes a `StaticScreenPath` and returns the URL with a leading slash; the shell store (profile, notifications, login after sign-out) and the dev toolbar (the admin URL check) navigate through it. `/design-system` stays a literal. No parametrised variant. See spec: `docs/specs/screen-definition.md`, Implementation Decisions → Search, `screenHref`.

**Blocked by:** 02 (Tracer bullet: the screen table drives every route)

**Status:** done

- [x] Route-table spec: every `search.href` matches a screen of its own group
- [x] Search-target spec passes with its cases unchanged
- [x] `screenHref` rejects a parametrised or unknown path at `typecheck` (checked with a `@ts-expect-error` case in a spec)
- [x] The shell store and the dev toolbar contain no screen path literal other than `/design-system`
- [x] App-shell spec passes without changed assertions: search routing and placeholder per role, empty search ignored, user menu opens profile and notifications, sign-out lands on login
- [x] Dev-toolbar spec passes unchanged
- [x] Browser: search from a learner, a content admin and a reports-only role lands on the catalog, the courses list and the learners report
  - The "content admin" case used the demo admin, who holds `content.courses`; no separate content-only role was tried.
- [x] `npm run check` green
