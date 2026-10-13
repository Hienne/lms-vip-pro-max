# Spec: Drop Tailwind CSS, style with SCSS only

Status: implemented · Labels: `ready-for-agent` (not yet published
to the issue tracker; the tracker is not configured).

## Problem Statement

The app styled with two systems at once: Tailwind CSS v4 utilities in
templates (about 690 class tokens across 58 files, mostly `flex`, `gap-*`,
`items-center`, `text-sm`, `text-text-muted`, `grid md:grid-cols-2`) and SCSS
for atoms and route styles (57 files reading `var(--token)`). The project is
small, and the second system cost more than it gave: a PostCSS pipeline, a
plain-CSS entry that could not go through Sass, a theme file written in
Tailwind's `@theme` dialect, cascade-layer ordering rules so utilities beat
global SCSS, block names that had to dodge Tailwind utility names (`.ring`
became `.progress-ring`), and docs that translated every mockup helper into a
Tailwind utility. Developers converting a mockup screen had to think in the
mockup's helpers, in Tailwind and in SCSS at the same time.

## Solution

Style with SCSS only, and use what Sass offers: maps, functions, mixins and
compile-time errors.

- Design tokens are declared once as SCSS maps and emitted as the same CSS
  custom properties the app reads today, light and dark. Nothing that reads
  `var(--…)` changes, and neither does the theme switch.
- A Sass module `ui` from `@lms/ui` gives every stylesheet token functions
  (which fail the build on an unknown key), a breakpoint mixin and layout,
  typography and motion mixins. Using it emits no CSS.
- Templates carry semantic class names. A closed set of about ten layout
  helpers from the mockup (`stack`, `row`, `row-between`, `grow`, `grid-2/3/4`,
  `span-2`, `sr-only`, `skip-link`) covers the plain wrappers that only
  arrange their children; everything else is a BEM class styled with mixins
  in the component's `.scss`.
- Tailwind, its PostCSS plugin, PostCSS and their config leave the workspace.
- The guard spec enforces the new rules, and a compile test locks the style
  library's contract.
- The UI looks the same before and after, on every route, light and dark,
  desktop and phone width.

## User Stories

1. As a developer, I want one styling language in the repo, so that I never decide between a utility, a helper and SCSS for the same rule.
2. As a developer, I want no PostCSS step in the build, so that the toolchain is lighter and has fewer moving parts.
3. As a developer, I want every design token declared once in SCSS maps, so that there is a single source of truth for colours, spacing, type, radius, shadow, motion and breakpoints.
4. As a developer, I want the emitted CSS custom properties to keep their current names, so that every existing `var(--…)` in component styles keeps working untouched.
5. As a developer, I want dark values declared next to the light ones in SCSS, so that both themes come from the same source.
6. As a user, I want light, dark and system themes to behave exactly as before, so that the switch to SCSS is invisible to me.
7. As a developer, I want `ui.space(3)`, `ui.color(primary)` and their siblings to return the matching `var(--…)`, so that component SCSS reads tokens by key.
8. As a developer, I want the build to fail when I pass a key that is not a token, so that "tokens only" is checked at compile time, not in review.
9. As a developer, I want `@use 'ui';` to work from any stylesheet in the app or the UI library without relative paths, so that importing the library is one line.
10. As a developer, I want `@use 'ui';` to emit no CSS, so that a component never duplicates tokens or global rules.
11. As a developer, I want a breakpoint mixin `ui.bp(md)` reading the `sm / md / lg / xl` map, so that media queries never carry literal widths outside the token source.
12. As a developer, I want `ui.row`, `ui.stack` and `ui.grid` mixins with token gaps, so that layout in component SCSS is one line.
13. As a developer, I want `ui.grid` to take column counts per breakpoint, so that a component can declare its own responsive grid.
14. As a developer, I want typography mixins (`ui.text(size, tone)`, `ui.eyebrow`, `ui.num`, `ui.mono`, `ui.truncate`, `ui.clamp(n)`), so that the mockup's text helpers become one include each.
15. As a developer, I want `ui.animate(enter)` and the other motion mixins to honour reduced motion, so that animations stay accessible.
16. As a developer, I want a closed set of layout helper classes taken from the mockup, so that a wrapper `div` that only arranges children needs no invented name.
17. As a developer converting a mockup screen, I want `.stack`, `.row`, `.row-between`, `.grow`, `.grid-2/3/4` and `.span-2` to mean what they mean in the mockup, so that conversion stays close to 1:1.
18. As a developer, I want each helper built from the same mixin a component would use, so that a helper and a mixin never drift apart.
19. As a developer, I want default helper gaps to match the mockup (`stack` and `grid` at spacing 4, `row` and `row-between` at spacing 3), so that most wrappers need no modifier.
20. As a developer, I want gap modifiers such as `row--gap-2`, generated only for spacing token keys, so that a different gap is still a token and never an inline `--gap`.
21. As a developer, I want the mockup's off-scale gaps (10px, 14px, 18px…) rounded to the nearest spacing token, so that the scale stays closed.
22. As a user on a phone, I want `.grid-2/3/4` to collapse to one column and grow at `md` and `lg`, so that grids stay readable at 375px.
23. As a user, I want `.span-2` to apply only from `md` up, so that a spanning card does not overflow a one-column grid.
24. As a screen-reader user, I want `.sr-only` and the skip link to keep working, so that hidden labels and the skip link are unchanged.
25. As a developer, I want text, colour and component-specific spacing written as BEM classes plus mixins, so that the helper set does not grow into a home-made utility framework.
26. As a developer, I want TypeScript to return modifier names instead of utility strings (for example the due-date tone), so that style values live in SCSS only.
27. As a developer, I want class bindings like `[class.text-danger]` replaced by BEM modifiers, so that state styling sits in the component's stylesheet.
28. As a developer, I want the `/design-system` type, spacing, radius and shadow samples generated with `@each` over the token maps, so that the showcase always lists every token.
29. As a developer, I want a reset taken from Tailwind's preflight, so that removing Tailwind shifts no pixel on the atoms that assumed it.
30. As a developer, I want the mockup base rules (headings, links, `kbd`, focus ring, skip link, tabular numbers, reduced motion) kept above the reset with their documented deviations, so that base styling is unchanged.
31. As a developer, I want global CSS ordered as `reset, base, components, helpers` layers, so that component styles (unlayered) still win over every global rule.
32. As a developer, I want the guard spec to fail when a template, class binding or TypeScript class string uses anything but BEM classes, allowed helpers and their gap modifiers, so that utilities cannot creep back.
33. As a developer, I want the guard spec to fail on a hex or `rgb()` colour in any `.scss` outside the token source, so that colours always come from tokens.
34. As a developer, I want the guard spec to fail if anything still references Tailwind, so that the removal stays complete.
35. As a developer, I want the per-component style budget kept at 4kb warning and 8kb error, so that heavy mixin use shows up and pushes shared rules into a partial or an atom.
36. As a developer, I want the docs (`AGENTS.md`, workspace, Angular and UI library conventions, mockup migration guide) to describe SCSS only, so that agents and people do not follow dead Tailwind instructions.
37. As a developer converting a screen, I want a "mockup helper → helper or mixin" table, so that I know what each mockup class becomes.
38. As a reviewer, I want before/after screenshots of every route, light and dark, desktop and 375px, so that "nothing changed visually" is shown, not claimed.
39. As a developer, I want `npm run check` green with Tailwind gone, so that lint, typecheck, tests and the production build all pass on the new setup.

## Implementation Decisions

- **Token source.** `libs/ui/src/styles/ui/_tokens.scss`: SCSS maps per namespace plus dark maps, emitted by `global/_theme.scss`. Custom property names are exactly the previous names; this is the contract with every stylesheet and with ThemeStore. Tailwind-only syntax (`@theme`, `--*: initial`, `@custom-variant dark`) is gone.
- **The `ui` module.** `libs/ui/src/styles/ui/_index.scss` forwards the token maps, the functions and the mixins and emits no CSS. The app's build and test targets add `libs/ui/src/styles` to the Sass include paths, so every stylesheet writes `@use 'ui';` and calls members as `ui.<name>`.
- **Functions.** One accessor per token namespace (`ui.space`, `ui.color`, `ui.radius`, `ui.shadow`, `ui.text-size`, …). Each returns `var(--<namespace>-<key>)` and raises `@error` naming the namespace and the valid keys when the key is missing.
- **Breakpoints.** `ui.bp(<key>)` is a mobile-first `min-width` media query from the breakpoint map (`sm 640 / md 720 / lg 1100 / xl 1280`). `ui.bp-below(<key>)` is the one below-step query, kept for the responsive table.
- **Mixins.** Layout: `ui.stack`, `ui.row`, `ui.row-between`, `ui.grow`, `ui.grid`. Typography: `ui.text`, `ui.eyebrow`, `ui.num`, `ui.mono`, `ui.truncate`, `ui.clamp`. Accessibility: `ui.sr-only`, `ui.focus-ring`. Motion: `ui.animate`, wrapped for reduced motion. Keyframes are global, emitted once.
- **Global stylesheet.** `libs/ui/src/styles/global.scss` declares `@layer reset, base, components, helpers;` and loads, in order: the token emission, a reset copied from Tailwind's preflight (MIT, attribution kept), the base rules converted to SCSS, the atom partials and the helpers.
- **Helpers (closed set).** `stack`, `row`, `row-between`, `grow`, `grid-2`, `grid-3`, `grid-4`, `span-2`, `sr-only`, `skip-link`, in `@layer helpers`, each built from its mixin. Gap modifiers `<helper>--gap-<key>` for `stack`, `row`, `row-between` and the grids are generated from the spacing map.
- **Template rule.** A wrapper that only arranges its children uses a helper. An element with its own role, any text or colour styling, or responsive behaviour outside the helper presets gets a BEM class in its component and is styled with mixins in that component's `.scss`.
- **Dynamic classes.** TypeScript maps and class bindings return BEM modifier names, never style values. The design-system samples are modifiers generated with `@each` over the token maps.
- **Dependencies.** `tailwindcss`, `@tailwindcss/postcss` and `postcss` are removed. No dependency is added; the compile test uses the `sass` package already installed with Angular's build.
- **Budgets.** Unchanged: `anyComponentStyle` 4kb warning, 8kb error.

## Testing Decisions

1. **Guard spec** (`apps/lms/src/app/template-scan.spec.ts`): BEM / helper / gap-modifier rule over templates, class bindings, host metadata and class strings; no colour literal in `.scss` outside the token source; no reference to Tailwind or PostCSS; block classes stay inside `@lms/ui`; theme attribute written by ThemeStore only.
2. **Style library compile test** (`libs/ui/src/styles/styles.spec.ts`): `@use 'ui';` compiles to nothing; the global entry emits exactly the previous custom property names, light and dark; every accessor fails on an unknown key naming the namespace; gap modifiers exist for every spacing key and only for those; helpers sit in `@layer helpers` and the reset in `@layer reset`.

Acceptance outside the specs: `npm run check` green, the angular.md §14 checklist, and before/after screenshots of every route in light and dark at desktop and 375px with no visible difference.

## Out of Scope

- Redesigning any screen or changing any token value; this is a like-for-like port.
- Renaming CSS custom properties or the existing atom BEM blocks (`.progress-ring` keeps its name).
- Adding stylelint or any other new tool; enforcement stays in the guard spec.
- Banning literal `px` values in SCSS (borders and hairlines use them legitimately).
- Layout directives such as `uiStack`; revisit only if helpers need inputs.
- Converting further mockup screens.
- Publishing this spec to the issue tracker (not configured).

## Further Notes

- The mockup's helpers accept any `--gap`; the port snaps them to the spacing scale, as the Tailwind version already did.
- Emulated component styles are unlayered, so they beat every global layer; this matches the previous behaviour and is why helpers lose to a component rule on the same element.
- Mixins copy declarations into each component; watch the budget warnings during the template pass rather than at the end.
