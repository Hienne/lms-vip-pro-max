# Spec: App foundation (session, routing, shell, error pages, login, dev toolbar)

Status: ready for implementation · Labels: `ready-for-agent`

## Problem Statement

The app has a design system, contracts, an HTTP error model and `AuthApi`,
but no way to be used: there is no session, no route table, no shell, no
login, no 403/404 and no shared formatting. Its only routes are
`/design-system` and `/dev/migration`. No business screen can start until
these exist, and if each screen improvised its own navigation, permission
checks or date formats, the team would diverge on the first day.

## Solution

Port the mockup's application frame (`core/router.js`, `core/shell.js`,
`core/html.js` `fmt`, `pages/auth.js` login/home/403/404 and the "Demo" menu)
once:

- Formatting pipes in `@lms/ui`, backed by an injectable clock.
- A session store that restores the signed-in user at boot and drives
  sign-in, sign-out and the role home redirect.
- The full route table with role guards, a permission directive, and every
  mockup route registered with a placeholder page until its screen is built.
- The app shell (sidebar per role, header, mobile drawer) and the focus and
  bare layouts, plus the offline banner.
- The mockup's router behaviours: titles, focus on `h1`, skip link, scroll,
  unsaved-changes guard.
- 403 and 404 pages, the login screen and the dev toolbar.

## User Stories

1. As a learner, I want numbers, percentages, scores, dates, times, durations, file sizes and relative times formatted in Vietnamese exactly as the mockup shows them, so that every screen reads the same.
2. As a developer, I want those formats as pure pipes with an injectable clock, so that templates stay declarative and specs are deterministic.
3. As a user, I want to stay signed in when I reload the page, so that I do not lose my place.
4. As a user, I want `/` to take me to my role's home (`/learn`, `/instructor`, `/admin`, `/reports`), so that I land where my work is.
5. As a visitor, I want any protected URL to send me to the login page and back to that URL after signing in, so that deep links work.
6. As a user, I want a page outside my role to show "Bạn không có quyền truy cập trang này" with the roles it belongs to, so that I understand why.
7. As a user, I want an unknown URL to show a 404 page with the path and a way home, so that I am never stuck.
8. As a developer, I want one route table carrying each route's roles and layout, so that navigation and guards read the same source, as in the mockup.
9. As a developer, I want `*appCan="'content.write'"` to show an element only when the server granted that permission, so that permission checks in templates are one line.
10. As a developer, I want every mockup route registered with a placeholder page until it is migrated, so that sidebar links never break.
11. As a user, I want a sidebar listing my role's sections and pages with the current page marked, so that I can navigate.
12. As an instructor or admin, I want the inbox item to show the number of new items, so that I see pending feedback.
13. As a user, I want a header with a global search that searches the right place for my role, a notification bell with unread count and a user menu, so that common actions are one click away.
14. As a user, I want sign-out to ask for confirmation first, so that I do not sign out by accident.
15. As a mobile user, I want the sidebar in a drawer opened from the header menu button, so that it does not take the whole screen.
16. As a learner in a lesson or quiz, I want a focus layout without sidebar and header, so that I can concentrate.
17. As a user, I want a banner when the network is lost, telling me my input is kept, so that I know why actions fail.
18. As a screen-reader user, I want the page title to change and focus to move to the page heading on navigation, so that I know where I am.
19. As a keyboard user, I want a "Bỏ qua tới nội dung chính" skip link, so that I can bypass the navigation.
20. As an admin editing a form, I want to be asked "Rời trang khi chưa lưu?" before leaving with unsaved changes, including on reload or closing the tab, so that I do not lose work.
21. As a user, I want to sign in with email and password and see field errors, the locked-account message and the "continue to the page you requested" notice, so that sign-in failures are clear.
22. As a tester, I want one-click sign-in with each demo account on the login page, so that I can try every role.
23. As a developer, I want a dev toolbar to switch role, simulate offline, session expiry and a forbidden URL, and pick Prism examples, so that I can reach every state without a backend.
24. As a release manager, I want the dev toolbar absent from production builds, so that users never see it.
25. As a tech lead, I want each route and piece's checklist entry updated in its own pull request, so that the board stays true.

## Implementation Decisions

- **Placement** follows `workspace.md`: pipes and the clock token in `libs/ui` (generic); session, guards, `appCan`, title strategy and network status in `apps/lms/src/app/core/`; shell and layouts in `apps/lms/src/app/layout/`; login in `features/auth`, 403/404 and route placeholders in `features/errors`; dev toolbar in `core/dev/`.
- **Pipes** port `fmt.*` one-for-one: `num`, `pct`, `score`, `date`, `datetime`, `time` (seconds → `mm:ss`), `minutes`, `bytes`, `relative`, `daysLeft`, all `vi-VN` with `—` for empty values. Pipe names carry a `fmt` prefix (`fmtDate`) so they never shadow Angular's `date`. `relative` and `daysLeft` read a `NOW` injection token (defaulting to `Date.now`); remaining-ui ticket 11 reuses it. `initials` already lives in `ui-avatar`.
- **Session store** (`core/session/`) owns the profile as state and exposes `user$`, `role$`, `perms$`, `isSignedIn$`. A bootstrap step calls `AuthApi.profile()`; `unauthorized` means anonymous, any other error renders the error state. `signIn`, `signInDemo`, `signOut` call `AuthApi` and reload the profile. Role and permissions come only from the profile (server-evaluated `perms`).
- **Token transport is out of scope.** The backend uses Bearer JWT; how the token is stored, attached and refreshed is decided in a separate interceptor spec once the backend answers the open questions. The session store keeps its token handling behind its own commands so that spec plugs in without changing callers.
- **Route table** ports the mockup's `routes[]`: each route's `data` carries `roles` and `layout` (`app | focus | bare`). `authGuard` (canMatch) sends anonymous users to `/login?next=<url>`; `roleGuard` sends a wrong role to `/403` with the allowed roles in navigation state; the wildcard renders 404. `/` redirects to the role home map `HOME` from `pages/auth.js`. Unmigrated routes load a `RoutePlaceholder` that names the mockup page and links to `/dev/migration` in dev builds.
- **`*appCan`** is a structural directive taking one `Permission` or a list (all required), reading `SessionStore.perms$`. It hides UI only; the server enforces permissions (AGENTS.md). A `permissionGuard` uses the same check for routes.
- **Shell.** The `NAV` per role is a typed constant (`Record<Role, NavSection[]>`) using `routerLink` and `routerLinkActive` (`aria-current="page"`, longest-prefix match as the mockup's `activeHref`). Global search routes per role (learner → `/catalog?q=`, viewer → `/reports/learners?q=`, others → `/admin/courses?q=`). The user menu uses the existing menu organism; sign-out uses `confirm()` with the mockup's copy. Below the `lg` breakpoint the sidebar opens in the existing drawer.
- **Nav counts** (unread notifications, new inbox items) are server-computed: a new `GET /api/me/nav-counts` endpoint `{ notifications, inbox }` in a `shell` contracts domain, with fixtures and Prism examples, loaded by a shell store after sign-in and on navigation.
- **Network status** is a root store fed by the window `online`/`offline` events and by the dev toolbar's simulation; the banner copies the mockup's message and "Kết nối lại" action.
- **Router behaviours.** A custom `TitleStrategy` appends " · Core Banking Academy"; after each navigation the layout focuses the page `h1` (`tabindex="-1"`); `withInMemoryScrolling` restores scroll; an `unsavedChangesGuard` (canDeactivate) calls `hasUnsavedChanges()` on components that implement it and asks with `confirm()` ("Rời trang khi chưa lưu?", "Rời trang", "Ở lại", warning tone), and a `beforeunload` listener covers reload and tab close.
- **Login** ports `pages/auth.js` → login: brand panel, `ui-field` form with show/hide password, 422 details mapped to fields, 401/423 shown on the password field with the summary "Không đăng nhập được", the `next` notice, the demo account grid and the "try locked account" link, then success toast and redirect.
- **Dev toolbar** replaces the mockup's "Demo" menu, registered only when `devTools` is true (dynamic import inside the guard so production has no chunk): switch role (demo sign-in plus `Prefer: example=<role>` for profile), simulate offline, session expiry and a forbidden URL, and open the design system. Its `mockScenarioInterceptor` (documented in `contracts-and-mocks.md`) is the only interceptor in this spec.
- **Copy** is Vietnamese from the mockup.

## Testing Decisions

Tests assert external behaviour only. Seams, highest first:

1. **Router seam** with `RouterTestingHarness` and a stubbed `SessionStore`: redirects for anonymous, wrong role, unknown URL and `/`; layout chosen per route; title; focus on `h1`; unsaved-changes prompt.
2. **Session store** with `HttpTestingController` and `@lms/mocks` fixtures: boot restore, anonymous on 401, sign-in, sign-out, demo sign-in.
3. **Components through a host**: shell nav per role and `aria-current`, counts and bell label, search routing, drawer on small screens, offline banner, `*appCan` per permission, login states (422, 401, 423, `next`), 403 and 404 copy.
4. **Pipes**: each format at fixed inputs and a fixed `NOW`, including empty values and the `minutes`/`bytes`/`relative` thresholds.
5. **Contracts and fixtures**: the nav-counts endpoint and examples.
6. **Production bundle check**: the build output contains no dev toolbar or migration board chunk (scripted check over `dist/`, also closing the foundation gap).

## Out of Scope

- Interceptors for the Bearer token, refresh and session expiry (separate spec after the backend answers).
- Notification, profile and role home screens themselves (they stay placeholders).
- Business screens and their contracts beyond `nav-counts`.
- The other foundation gaps (pull request links, board layout, closing foundation tickets) except the production bundle check above.

## Further Notes

- Pipes have no dependencies and unblock remaining-ui tickets 06 and 11.
- Error pages and placeholders can be built in parallel with the session once the route table exists.
