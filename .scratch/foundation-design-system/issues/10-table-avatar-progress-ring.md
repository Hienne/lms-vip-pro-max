# 10: Table, avatar, progress and ring atoms

**What to build:** `uiTable` on native tables (with a responsive wrapper,
numeric columns and the mockup's header and row styles), `ui-avatar`
(initials from a name, sizes, avatar group overlap), `ui-progress` (value,
tones, small size, accessible progressbar) and `ui-ring` (SVG ring with the
value in the centre). They fill the **Hiển thị dữ liệu** section of
`/design-system`, with the sample table inside a `uiCard`. The data table
organism (sorting, paging, selection) and KPI molecule stay placeholders.
See the spec: `@lms/ui` atoms.

**Blocked by:** 09 — Badge, chip, card, skeleton and spinner atoms

**Status:** ready-for-agent

- [ ] Table look matches the mockup, including numeric alignment and the responsive wrapper; native table semantics kept
- [ ] Avatar derives initials from a name (Vietnamese names included), supports sizes and groups, and has an accessible name
- [ ] Progress exposes `role="progressbar"` with value and range; tones `success`, `warning`, `danger`, `reward` and the small size match the mockup; width set through a CSS variable binding
- [ ] Ring draws the value as an SVG arc in token colours, with the value readable by assistive technology
- [ ] Specs cover table classes, initials, progress ARIA and tones, and ring value
- [ ] **Hiển thị dữ liệu** section demos replace their placeholders; data table and KPI demos remain placeholders
- [ ] Checklist entries `done` with owner, pull request and the checks performed
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [ ] `npm run check` green; merged through its own pull request
