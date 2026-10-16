# 03: The sidebar and menu labels come from the screen table

**What to build:** Each menu group in the screen table gets `nav` (icon, section, optional badge, optional label), and the sidebar, the role form and the 403 page read it through the functions they already call. The sidebar `href` of a menu is its first screen; `nav.label` defaults to that screen's title, and four groups override it to keep today's copy: `admin.home` "Tổng quan", `content.import` "Nhập dữ liệu", `admin.assignments` "Giao học & hạn", `reports` "Báo cáo". Group order is sidebar order and equals today's order. `navFor`, `allSections`, `menuLabel` and `activeHref` keep their signatures and the `NavSection` / `MenuItem` shapes; the array `MENU_CATALOG` is removed. See spec: `docs/specs/screen-definition.md`, Implementation Decisions → Screen table, Sidebar labels, Derived interfaces.

**Blocked by:** 02 (Tracer bullet: the screen table drives every route)

**Status:** done

- [x] Route-table spec: the first screen of every menu group has no `:param`
- [x] New pure spec: `navFor` returns sections in today's order and grouping for a role; `allSections` lists all 22 menus; `menuLabel` returns the four overridden labels and the screen title elsewhere
- [x] App-shell spec passes without changed assertions: sidebar per demo role and custom role, longest-match `aria-current` (`/admin/courses/new` marks "Khóa học"), current mark moves on navigation, inbox badge
- [x] Role form groups and labels menus as before; the 403 page names the menu as before; profile and user detail list menus as before
  - Role form checked in the browser; the 403, profile and user-detail menus are covered by their unchanged specs, not opened in the browser after this ticket.
- [x] No consumer of the menu functions changes beyond an import
- [ ] Browser: sidebar of the learner, instructor and admin demo accounts and one custom role matches the current build item for item
  - Learner, instructor and admin sidebars match item for item; the custom-role sidebar was not checked in the browser (the app-shell spec covers a custom role and passes).
- [x] `npm run check` green
