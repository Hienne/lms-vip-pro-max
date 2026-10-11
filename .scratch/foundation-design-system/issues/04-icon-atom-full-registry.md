# 04: Icon atom with the full icon registry

**What to build:** `ui-icon`, the only wrapper around `@lucide/angular`, with
a registry holding every icon the mockup uses under its Lucide name (per the
icon table in the migration doc, each checked against the installed package
and, for starred rows, against the mockup's SVG). An unregistered name fails
type-checking and only registered icons are bundled. Icons are decorative by
default and become a labelled image when given a label; sizes `sm | md | lg |
xl` and stroke width 1.75 match the mockup. The **Icon** section of
`/design-system` shows every icon with its name. See the spec: `@lms/ui`
atoms.

**Blocked by:** 02 — Migration checklist and progress board

**Status:** ready-for-agent

- [ ] Every mockup icon name has a registry entry; the migration doc icon table is corrected where the installed Lucide names differ
- [ ] An unknown icon name is a type error; no other project imports `@lucide/angular`
- [ ] Decorative by default (`aria-hidden`); with a label it has `role="img"` and an accessible name
- [ ] Sizes and stroke width match the mockup's icon classes
- [ ] Spec covers decorative vs labelled, each size, and rendering a registered icon
- [ ] **Icon** section lists every registered icon with its mockup and Lucide names; placeholder removed
- [ ] Checklist entry `done` with owner, pull request and the checks performed
- [ ] Checked in the browser against the mockup's icon grid, light and dark
- [ ] `npm run check` green; merged through its own pull request
