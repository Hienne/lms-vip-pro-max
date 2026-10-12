# 08: Breadcrumb and page header

**What to build:** `ui-breadcrumb` (nav landmark, separators hidden from assistive technology, last item `aria-current="page"`, items as router links) and `ui-page-header` organism (eyebrow, `h1` title, description, actions slot, breadcrumb slot, wrapping on narrow widths). Demos replace placeholders in **Điều hướng**. See spec: UI pieces.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Breadcrumb semantics as above; long trails truncate without horizontal scroll at 375 px
- [ ] Page header slots match the mockup's `UI.PageHeader`
- [ ] Specs cover ARIA, current item, slot projection
- [ ] Demos and checklist entries updated; checked at 375/768/1280, light/dark
- [ ] `npm run check` green; own pull request
