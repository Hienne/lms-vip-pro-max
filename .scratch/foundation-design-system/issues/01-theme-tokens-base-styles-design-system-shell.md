# 01: Theme tokens, base styles and the `/design-system` shell

**What to build:** The tracer bullet through the whole styling stack. The
mockup's tokens become the project theme in `@lms/ui`, with every token named
in a Tailwind v4 namespace, so Tailwind utilities and component SCSS read the
same variables. Tailwind's default theme is gone, spacing is limited to the
mockup's 4px steps, and breakpoints are mobile-first `sm` 640 · `md` 720 ·
`lg` 1100 · `xl` 1280. Base styles carry the mockup's typography, links,
`kbd`, focus ring, skip link and reduced motion on top of Tailwind's
preflight. A public `/design-system` route opens with its own layout (sticky
table of contents on the left, content on the right) and a working **Màu
sắc** section: swatches read from live tokens and a contrast table computed
from the current computed values. See the spec: Theme and tokens, Base
styles, `/design-system` route.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Every mockup token exists in the theme with its mockup value and exactly one name; light values are emitted even when no utility uses them
- [ ] Renamed tokens follow the spec (font weights, chart colours in the colour namespace, named spacing steps 1, 2, 3, 4, 5, 6, 8, 10, 12 with no base multiplier, animations and transition duration, z-index and layout sizes)
- [ ] All Tailwind default theme namespaces are reset: `bg-red-500` and `p-7` generate no CSS; `bg-primary`, `text-text-muted`, `p-4`, `rounded-lg`, `fill-chart-1` resolve to project values
- [ ] Breakpoints are `sm` 640, `md` 720, `lg` 1100, `xl` 1280; Tailwind's defaults are gone
- [ ] Mockup dark-mode token values are present behind the same two conditions as the mockup (explicit dark, system dark unless light was chosen); nothing outside the theme mentions a theme
- [ ] Base layer ports the mockup rules that differ from preflight (headings, links, `kbd`, `:focus-visible`, skip link, tabular numbers, reduced motion); keyframes `enter`, `reward-pop`, `shimmer`, `spin` are named animations
- [ ] Be Vietnam Pro is the sans font in utilities and base styles
- [ ] `/design-system` is a public route with its own layout and a table of contents linking to every section the page will have; the **Màu sắc** section shows swatches (name, token, live value, purpose) and the live contrast table with WCAG grade, copy taken from the mockup
- [ ] Template-scan spec fails on a `dark:` utility anywhere and on a design-system block class written outside `@lms/ui`
- [ ] Route spec (router testing harness) renders `/design-system` with the colour section and contrast rows
- [ ] UI library conventions corrected: mockup → new token name table, breakpoint mapping (900/1000/1024 → nearest step), mockup helper → Tailwind utility table
- [ ] Checked in the browser at 375/768/1280 px against the mockup's colour section; contrast ratios match the mockup's
- [ ] `npm run check` green; merged through its own pull request
