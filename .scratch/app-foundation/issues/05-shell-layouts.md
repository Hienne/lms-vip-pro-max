# 05: App shell, sidebar and layouts

**What to build:** in `layout/`, the `app` layout (sidebar + main), `focus` and `bare` layouts chosen from `data.layout`; sidebar with brand, role line, typed `NAV` per role (`routerLinkActive`, `aria-current`, longest-prefix match), design-system link and footer; below `lg` the sidebar opens in the drawer from a header menu button. See spec.

**Blocked by:** 03 — Route table, guards, appCan and placeholders

**Status:** ready-for-agent

- [ ] `NAV` copied from `core/shell.js` for all four roles; every link resolves to a route
- [ ] Drawer traps and restores focus; closes on navigation
- [ ] Specs cover nav per role, active item, layout per route and the mobile drawer
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark, keyboard only
- [ ] `npm run check` green; own pull request
