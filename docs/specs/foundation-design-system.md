# Spec: Foundation, design system page, migration checklist and dark mode

Status: ready for implementation · Labels: `ready-for-agent` (not yet published
to the issue tracker; the tracker is not configured).

## Problem Statement

The Angular workspace is configured but empty. Before any mockup screen can be
converted, the team needs the shared foundation every screen builds on: the
design tokens, the base styles, the atoms of the design system and the
light/dark theme. Without it, each developer would port CSS from the mockup
on their own, invent their own class names and colours, and the screens would
drift from each other and from the mockup.

The mockup's tokens do not line up with Tailwind CSS v4's theme namespaces in
several places (font weights, spacing, chart colours, durations, z-index,
layout sizes) and its breakpoints are six inconsistent `max-width` values.
Developers using Tailwind utilities would therefore either reach for
Tailwind's defaults (off-brand colours, off-scale spacing) or hard-code values.

Several people will convert screens in parallel. Today there is no shared
view of what has been migrated, who is working on what, and whether a "done"
piece was actually verified in both themes, at every width and with the
keyboard. Two people could convert the same screen, and a piece could be
called done without passing the verify step.

The mockup's Design System v2 page is also a competition deliverable (README
item H, criteria E1–E3), so the Angular app must ship an equivalent living
catalogue.

## Solution

A foundation layer and a living catalogue:

- One theme, ported from the mockup's tokens, in which every token has
  exactly one name, chosen from Tailwind v4's namespaces. Tailwind utilities
  and component SCSS read the same variables, Tailwind's default theme is
  removed entirely, the spacing scale is restricted to the mockup's 4px steps,
  and the breakpoints are reduced to four mobile-first steps.
- Base styles on top of Tailwind's preflight, carrying the mockup's
  typography, focus ring, skip link and reduced-motion behaviour.
- Every atom from the component inventory, built directive-first in `@lms/ui`,
  plus the segmented control molecule needed for the theme switch.
- Dark mode with three choices (System, Light, Dark), remembered per browser,
  applied before the app boots so the page never flashes the wrong theme, and
  implemented purely through token values.
- A public `/design-system` route that ports the mockup's catalogue: every
  section, live examples of each built piece in light and dark, a live
  contrast checker, and a clear "not migrated yet" marker for pieces that do
  not exist yet.
- A typed migration checklist that tracks every component and every route
  with status, owner, pull request and verify checks. Tests fail when a new
  component or route is missing from it. A progress board renders it in
  development and staging, never in production.
- A pull request template and code owners so every contribution updates the
  checklist and runs the same checks.

## User Stories

### Learners and other end users

1. As a learner, I want the app to follow my operating system's light or dark
   setting by default, so that it matches the rest of my desktop without any
   setup.
2. As a learner, I want to choose Light, Dark or System explicitly, so that I
   can override my operating system when I prefer a different look for the
   LMS.
3. As a learner, I want my theme choice remembered on this browser, so that I
   do not have to pick it again on every visit.
4. As a learner, I want to return to "follow the system" after picking a fixed
   theme, so that a one-off choice does not lock me out of automatic
   switching.
5. As a learner, I want the page to load directly in my chosen theme, so that
   I never see a white flash before the dark theme appears.
6. As a learner using System mode, I want the app to switch theme when my
   operating system switches (for example at sunset), so that it stays in sync
   without a reload.
7. As a learner, I want the theme to keep working when my browser blocks site
   storage, so that a privacy setting never breaks the page.
8. As a learner with low vision, I want every text and control colour pair to
   meet WCAG AA in both themes, so that I can read everything.
9. As a keyboard user, I want a visible focus ring on every interactive
   element in both themes, so that I always know where I am.
10. As a keyboard user, I want a skip link to the main content, so that I do
    not tab through the navigation on every page.
11. As a user sensitive to motion, I want animations disabled when my system
    asks for reduced motion, so that the interface does not make me
    uncomfortable.
12. As a Vietnamese reader, I want the self-hosted Be Vietnam Pro font with
    correct diacritics, so that text renders properly even on networks that
    block Google Fonts.
13. As a screen-reader user, I want decorative icons hidden and meaningful
    icons labelled, so that I hear only useful information.
14. As a screen-reader user, I want icon-only buttons to always have an
    accessible name, so that I know what each one does.
15. As a screen-reader user, I want the theme switch announced as a group of
    three options with the current one selected, so that I can change it
    without seeing it.

### Competition judges and stakeholders

16. As a judge, I want a public `/design-system` page in the Angular app, so
    that I can assess criteria E1–E3 the same way as in the mockup.
17. As a judge, I want the page to show the principles and the v1 → v2 change
    log, so that I can see the design rationale.
18. As a judge, I want colour swatches that show each token's name, current
    value and purpose, so that I can see the palette is semantic.
19. As a judge, I want a contrast table computed live from the current theme,
    so that I can verify AA compliance in light and dark myself.
20. As a judge, I want typography, spacing, radius, shadow and motion samples,
    so that I can see the scales the product uses.
21. As a judge, I want every icon shown with its name, so that I can see the
    icon set is consistent.
22. As a judge, I want live, interactive examples of buttons, form controls,
    badges, cards, tables, progress and avatars, so that I can try their
    states (hover, focus, disabled, loading).
23. As a judge, I want sections whose components are not converted yet to say
    so clearly, so that I do not mistake an empty area for a bug.
24. As a stakeholder, I want the page to switch theme from its own table of
    contents, so that I can compare light and dark without an app shell.

### Developers converting screens

25. As a developer, I want every colour, font size, weight, radius, shadow,
    spacing step, breakpoint and animation available as a Tailwind utility
    with the project's value, so that I lay out screens with utilities
    instead of custom CSS.
26. As a developer, I want Tailwind's default palette, spacing and font sizes
    removed, so that an off-brand utility such as `bg-red-500` or `p-7`
    produces nothing and I notice the mistake.
27. As a developer, I want each token to have exactly one name used by both
    Tailwind and SCSS, so that I never wonder which alias is current.
28. As a developer, I want a lookup table from mockup token names to the new
    names, so that I can translate mockup CSS quickly and correctly.
29. As a developer, I want four mobile-first breakpoints derived from the
    mockup, with a note on how the mockup's other widths map onto them, so
    that responsive behaviour is consistent across screens.
30. As a developer, I want the mockup's layout helpers (stack, row, grid,
    margins, text helpers) replaced by documented Tailwind equivalents, so
    that I do not port helper classes.
31. As a developer, I want atoms as attribute directives on native elements
    (button, anchor, input, select, textarea, checkbox, table, span, article),
    so that forms, routing, `type`, `disabled` and `aria-*` keep working
    natively.
32. As a developer, I want component atoms only where the atom owns DOM (icon,
    avatar, progress, ring, brand flower), so that I write the least markup.
33. As a developer, I want variants named `variant`, `tone` and `size` with
    typed string unions on every atom, so that the API is predictable and
    typos fail type-checking.
34. As a developer, I want an icon-only button that does not compile without a
    label, so that I cannot ship an unnamed control.
35. As a developer, I want `ui-icon` to accept only registered icon names, so
    that an unknown or misspelled icon fails type-checking and unused icons
    are not bundled.
36. As a developer, I want all mockup icons registered under their Lucide
    names from the start, so that I can convert any screen without touching
    the registry.
37. As a developer, I want a segmented control built on `@angular/aria`, so
    that I get correct keyboard and ARIA behaviour for single-choice toggles.
38. As a developer, I want dark mode to need no work in my screens, so that
    using tokens is all it takes for a screen to support both themes.
39. As a developer, I want a test failure if I write a `dark:` utility in a
    template, so that theme logic stays in the tokens.
40. As a developer, I want a test failure if I write a design-system block
    class (such as `btn btn--primary`) outside `@lms/ui`, so that I use the
    atom instead.
41. As a developer, I want to read and change the current theme through one
    store, so that a future header toggle reuses the same logic as the design
    system page.
42. As a developer, I want each atom demonstrated on `/design-system` in every
    variant, size and state, so that I can copy a working usage.
43. As a developer, I want to open the migration board in my local app, so
    that I can see what is free to pick up.
44. As a developer, I want to mark a component or route as in progress with my
    GitHub username, so that teammates do not start the same piece.
45. As a developer, I want each checklist item to list the verify checks
    (light and dark, 375/768/1280 widths, keyboard, error states), so that
    "done" means the same thing for everyone.
46. As a developer, I want a test to fail when I export a new `@lms/ui` symbol
    or add a route without a checklist entry, so that the checklist cannot
    fall out of date.
47. As a developer, I want a test to fail when a checklist entry points at a
    component or route that does not exist, so that renames are caught.
48. As a developer, I want checklist items linked to the README's
    competition checklist codes, so that I know which judged criteria my
    screen must still satisfy.
49. As a developer, I want to update the checklist in the same pull request as
    the work, so that the status and the code always match in review.
50. As a developer, I want a pull request template that lists `npm run check`,
    the verify steps and the checklist update, so that I do not forget a
    step.

### Reviewers and the tech lead

51. As a reviewer, I want checklist changes to be one-line edits in a typed
    file, so that diffs are easy to read and merge conflicts are rare.
52. As a reviewer, I want the checklist validated by a schema, so that a
    malformed entry (unknown status, missing owner on an in-progress item,
    done without verify checks) fails CI.
53. As a reviewer, I want code owners on the design system, contracts and
    docs, so that changes to shared foundations always get the right review.
54. As a tech lead, I want the progress board on staging, so that I can follow
    progress without running the app locally.
55. As a tech lead, I want the progress board absent from production builds,
    so that internal names and pull request links never reach end users.
56. As a tech lead, I want the board to summarise progress by kind (components,
    routes) and status, so that I can see at a glance how far the migration
    has come.
57. As a tech lead, I want the design system page's "not migrated yet" markers
    driven by the same checklist, so that the catalogue and the board never
    disagree.

### Designers

58. As a designer, I want tokens to keep the mockup's exact values and the
    same light/dark pairs, so that the Angular app looks identical to the
    approved mockup.
59. As a designer, I want to compare the Angular `/design-system` with the
    mockup's page side by side, so that I can sign off visual parity.

## Implementation Decisions

### Theme and tokens

- The theme is ported once from the mockup's tokens into `@lms/ui` and is the
  single source of truth. Light values sit in Tailwind's static theme block so
  every token is emitted even when no utility uses it.
- Every token gets one name in a Tailwind v4 namespace. Renames from the
  mockup: weights move to the font-weight namespace; chart colours move into
  the colour namespace (giving `fill-chart-1`, `stroke-chart-grid`, …);
  `--space-N` becomes named spacing steps 1, 2, 3, 4, 5, 6, 8, 10, 12 with no
  base `--spacing` multiplier, so off-scale steps produce no utility;
  durations and keyframes become the animation and transition namespaces;
  z-index and layout sizes (sidebar width, header height, content max,
  control heights, touch minimum) get documented names. The exact mapping is
  published as a table in the UI library conventions.
- All of Tailwind's default theme namespaces are reset, not only colours.
  Font families are redefined (Be Vietnam Pro for sans, the mockup's mono
  stack).
- Breakpoints are mobile-first: `sm` 640px, `md` 720px, `lg` 1100px, `xl`
  1280px. The mockup's 900/1000/1024 widths map to the nearest step; any
  visible difference is accepted and noted in the conversion report.
- The statement in the UI library conventions that mockup token names
  already match Tailwind is corrected.

### Base styles

- Tailwind's preflight is kept. The mockup's base rules that differ (heading
  scale, link colour and underline offset, `kbd`, `:focus-visible` ring, skip
  link, tabular numbers, reduced-motion override) go into the base cascade
  layer.
- The mockup's layout and text helpers are not ported; the conventions list
  their Tailwind equivalents.
- Keyframes `enter`, `reward-pop`, `shimmer` and `spin` become named
  animations.

### Dark mode

- Three preferences: `system`, `light`, `dark`. The effective theme is
  derived; in `system` it follows `prefers-color-scheme` live.
- Dark values stay exactly as in the mockup and apply in the same two cases:
  explicit dark, and system dark when the user has not chosen light.
- The preference is stored in browser storage under `lms.theme`; every read
  and write tolerates storage being unavailable. Absence means `system`.
- A small inline script in the document head reads the stored preference and
  sets the theme attribute on the root element before the app boots. If a
  strict content security policy is introduced later, the script gets a hash
  entry.
- A root `ThemeStore` in the app's core owns the preference: a readonly
  preference selector, an effective-theme selector and one command to set the
  preference. It is the only code that writes the theme attribute. Nothing
  else in the app or library mentions a theme.
- Tailwind's `dark:` variant is configured to match the same attribute logic
  for completeness, but its use in templates is forbidden and enforced by a
  test.
- Until the app shell exists, the theme switch lives in the design system
  page's table of contents; the header will reuse the same store and control.

### `@lms/ui` atoms and the segmented molecule

- Atoms follow the component inventory and the directive-first ladder:
  attribute directives for button, icon button, link button, input, select,
  textarea, checkbox, switch, badge, chip, card (with header and body parts),
  skeleton, spinner and table; components for icon, avatar, progress, ring,
  brand flower and flower badge.
- Each atom's look is one SCSS partial per BEM block, ported from the mockup's
  component styles into the components cascade layer and applied only by the
  atom's host class. Variants use the `variant`, `tone`, `size` inputs and
  boolean attribute flags as defined in the UI library conventions.
- The icon button requires a label that becomes its accessible name and
  tooltip text.
- The icon atom wraps `@lucide/angular` (the only importer of it), registers
  every mockup icon under its Lucide name per the migration icon table, is
  decorative by default and becomes a labelled image when given a label.
- The segmented control is built ahead of its first screen as a deliberate
  exception, on the `@angular/aria` pattern that fits a single-value choice
  (checked against the installed exports). It exposes the selected value as
  a two-way model and takes options with label and optional icon.
- Every public symbol is exported from the library's public API.

### Runtime config

- `AppConfigSchema` gains a boolean `devTools` flag: true in development and
  staging, false in production. It is distinct from `mockScenarios`, which
  stays development-only because Prism exists only there.

### `/design-system` route

- A public feature route with its own layout: a sticky table of contents with
  the brand mark and the theme switch on the left, content on the right. It
  does not depend on the app shell.
- It ports the mockup page's sections 1–13: principles and v1 → v2 change
  log, colour, typography, spacing/radius/shadow/motion, icons, buttons,
  forms, badges and status, data display, navigation, system feedback,
  learning components, charts. The mockup's section 14 (porting to React or
  Angular) is dropped.
- The contrast table computes ratios from the live computed token values
  after render and recomputes when the effective theme changes.
- Any demo whose component is not built yet renders a "Chưa migrate"
  placeholder, decided by the migration checklist, never by hand. In
  production the placeholder shows only the status, never owner or pull
  request.
- UI copy is Vietnamese and taken from the mockup page.

### Migration checklist

- A typed registry validated by zod lives in the design system feature. Each
  entry has: an id, a kind (`component` or `route`), the mockup source, the
  Angular target (the `@lms/ui` export names for components, the route path
  for routes), the atomic level for components, the README checklist codes it
  serves, a status (`todo`, `in-progress`, `done`), an owner (GitHub
  username), a pull request link, and verify checks (light/dark, 375/768/1280
  widths, keyboard, error states).
- Schema rules: an owner is required unless the status is `todo`; `done`
  requires every applicable verify check to be ticked.
- Initial content: every row of the migration doc's component inventory and
  every route of the mockup router. All start as `todo`; the pieces built in
  this work are `done` with only the checks actually performed ticked.
- The progress board is a route under the dev area, registered only when
  `devTools` is true. It lists entries grouped by kind and status, with
  owner, pull request link and verify checks, plus summary counts.
- The migration doc points to the registry as the single record of progress;
  no Markdown copy is generated.

### Collaboration

- The work is split into tickets (vertical slices). Each ticket lands through
  its own branch and pull request into `main`, so tickets without a blocking
  edge between them can be picked up in parallel by different people.
- A pull request template lists: `npm run check` green, angular.md §14
  checklist, the migration verify step for converted screens, and the
  checklist update.
- Code owners cover the design system library, the contracts library and the
  docs; initially only the repository owner, with a note to add reviewers.

## Testing Decisions

A good test exercises a piece the way its consumer does and asserts only what
the consumer can observe: rendered classes, attributes, ARIA, text, emitted
outputs, the theme attribute on the root element, and validation results. It
does not reach into private fields, signals or internal methods, and it
survives a refactor that keeps behaviour unchanged. Fixtures come from
`@lms/mocks` when a test needs domain data; this work needs none.

The agreed seams, highest first:

1. **The `/design-system` route**, rendered through the router testing
   harness. It shows all thirteen sections in order; demos of unbuilt pieces
   show the "Chưa migrate" placeholder; the progress board route exists when
   `devTools` is true and does not when it is false; the theme switch changes
   the root theme attribute. Prior art: the app's existing smoke spec.
2. **The `@lms/ui` public API**, one spec per atom and for the segmented
   control, using a small host component in the consumer's style. It covers
   classes and ARIA for each variant, tone and size, boolean flags, required
   inputs (icon button label), icon decorative vs labelled, and the segmented
   control's keyboard selection and model updates. Required by the UI library
   done criteria, so it is not folded into seam 1.
3. **`ThemeStore`** through its selectors and command, with fake storage and
   a fake `matchMedia`: default `system`; explicit choices persist and are
   restored; system mode follows a media-query change; unavailable storage
   does not throw. Prior art: the store pattern in angular.md.
4. **The migration registry**: every entry parses; the set of component
   targets equals the set of `@lms/ui` exports; the set of route targets
   equals the app's route paths; status rules hold.
5. **`AppConfigSchema`**: the existing spec is extended so all three
   environment files parse with the new `devTools` flag and production has it
   false.
6. **Template scan**: no template or component file uses a `dark:` utility,
   and no file outside `@lms/ui` writes a design-system block class.

Not automated: the inline pre-boot theme script. It is verified in the
browser by reloading in each of the three preferences with the system theme
both light and dark, and the result is recorded in the pull request.

Manual verification for the pull request: `/design-system` side by side with
the mockup's page at 375, 768 and 1280 px in light and dark; keyboard-only
pass over the page and the theme switch; contrast table values match the
mockup's. `npm run check` must be green.

## Out of Scope

- App shell, sidebar, header and layouts other than the design system page's
  own layout.
- Session, login, role guard, global error handling, and the 403/404 pages.
- Molecules other than the segmented control, all organisms, charts and
  domain UI. Their sections on `/design-system` show placeholders until a
  screen needs them.
- Any contract, fixture or Prism change.
- Converting any mockup screen other than the design system page.
- Publishing this spec to the issue tracker (not configured yet), CI or
  branch protection changes, and deployment.
- Visual regression tooling.

## Further Notes

- Each ticket updates the docs its change touches in its own pull request:
  the token naming table and breakpoints with the theme, theme rules with dark
  mode, the checklist workflow and the `devTools` flag with the checklist.
- When the app shell is built, the theme switch moves to the header using the
  same store and control; the design system page keeps its own copy in the
  table of contents.
- If the team prefers GitHub Issues later, each checklist entry's pull request
  field can hold an issue link instead; the registry stays the source of
  truth for status.
