# 06: Make `openDrawer` internal, update docs, acceptance

**What to build:** `uiDrawer` becomes the only way to show a drawer. The design-system drawer demo uses the directive (both sides, with a footer), and its catalogue entry for the drawer is updated. `openDrawer` is no longer exported from `@lms/ui`; `DrawerContext` stays exported. `angular.md` §5 says a drawer is closed by clearing its state in `onSuccess`, and that a store never takes a `TemplateRef`, never holds an overlay handle and injects `Dialog` only for `confirm()`. `ui-library.md` lists `uiDrawer` in the overlays table and `ui-form-actions` among the molecules. See spec: Implementation Decisions → `openDrawer`, Docs; Further Notes → Done means.

**Blocked by:** 03, 04, 05

**Status:** done

- [x] No store in the app imports `TemplateRef` or `openDrawer`; `openDrawer` is absent from the `@lms/ui` public API
- [x] Design-system demo opens a drawer through `uiDrawer`
- [x] `angular.md` §5 and `ui-library.md` updated as above; §14 checklist passes
- [x] Browser smoke test with screenshots: add and edit on users, user detail, roles, units and groups; a failed save keeps the drawer open with inline errors; Esc is blocked during a save; the mobile navigation drawer opens and closes on navigation
- [x] `npm run check` green
