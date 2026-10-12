# 07: Titles, focus, skip link, scroll, offline banner and unsaved guard

**What to build:** `TitleStrategy` ("… · Core Banking Academy"), focus on the page `h1` after navigation, skip link "Bỏ qua tới nội dung chính" to `main`, scroll restoration, `unsavedChangesGuard` + `beforeunload` for components implementing `hasUnsavedChanges()`, network status store and offline banner. See spec.

**Blocked by:** 05 — App shell, sidebar and layouts

**Status:** ready-for-agent

- [ ] Confirm copy: "Rời trang khi chưa lưu?", "Rời trang", "Ở lại", warning tone
- [ ] Banner copy and "Kết nối lại" match `core/shell.js`; announced with `role="alert"`
- [ ] Specs cover title, focus target, guard allow/deny and banner on offline/online events
- [ ] Documented in `angular.md` or `workspace.md` where routes are described
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark, keyboard only
- [ ] `npm run check` green; own pull request
