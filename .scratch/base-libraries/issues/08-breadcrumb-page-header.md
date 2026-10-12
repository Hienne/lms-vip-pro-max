# 08: Breadcrumb and page header

**What to build:** `ui-breadcrumb` (nav landmark, separators hidden from assistive technology, last item `aria-current="page"`, items as router links) and `ui-page-header` organism (eyebrow, `h1` title, description, actions slot, breadcrumb slot, wrapping on narrow widths). Demos replace placeholders in **Điều hướng**. See spec: UI pieces.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Breadcrumb semantics as above; long trails truncate without horizontal scroll at 375 px
- [x] Page header slots match the mockup's `UI.PageHeader`
- [x] Specs cover ARIA, current item, slot projection
- [x] Demos and checklist entries updated; checked at 375/768/1280, light/dark
- [ ] `npm run check` green; own pull request (skipped: delivered on a local integration branch, no PR)
