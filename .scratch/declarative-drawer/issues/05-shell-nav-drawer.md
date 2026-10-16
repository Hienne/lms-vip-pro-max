# 05: Shell navigation drawer from state

**What to build:** On a narrow screen the navigation drawer opens from the menu button and closes on the next navigation, as today, now driven by state. `ShellStore` replaces `openNav(body)` with `openNav()` and adds `closeNav()`; it drops the drawer handle and the `effect` that closed it on navigation. `navOpen` in `state` becomes a `linkedSignal` over the current path, so it resets to false whenever the path changes. The shell template puts `uiDrawer` on the navigation template with `navOpen$()`, side `start`, title "Điều hướng chính", no footer, and dismiss → `closeNav()`. See spec: Implementation Decisions → Stores (`ShellStore`), Views.

**Blocked by:** 01

**Status:** done

- [x] `ShellStore` imports neither `TemplateRef` nor `openDrawer`, and has no `effect` that closes the drawer
- [x] App shell spec passes without changed assertions (open from the menu button, close on navigation)
- [x] `npm run check` green
