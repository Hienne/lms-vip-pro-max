# Tasks: Custom theme

Spec: [SPEC.md](../SPEC.md) · Plan: [plan.md](plan.md). Run `nvm use` first.

## Task 1: ThemeStore palette state, persistence, no-flash script, scan guard

**Description:** Add `THEME_PALETTES`, `ThemePalette`, `palette$()` and `setPalette()` to
`ThemeStore`. Persist the palette under `lms.palette` (absence = `bidv`) and write
`data-palette` on `<html>` (absent for `bidv`). Extend the inline script in `index.html` and widen
the template-scan rule.

**Acceptance criteria:**

- [x] Store specs: default `bidv` with no storage; valid stored id read; unknown id → `bidv`;
      `setPalette` sets attribute + storage, `bidv` removes both; blocked storage never throws;
      palette and mode are independent
- [x] `template-scan.spec.ts` fails if any file other than `theme.store.ts` writes `data-palette`
- [x] `index.html` applies a stored valid palette before boot and ignores unknown values

**Verification:**

- [x] `npx nx test lms`
- [x] Manual: set `localStorage['lms.palette']='blue'`, reload, and see `data-palette="blue"`
      on `<html>` at first paint

**Dependencies:** None

**Files likely touched:** `apps/lms/src/app/core/theme/theme.store.ts`, `theme.store.spec.ts`,
`apps/lms/src/app/template-scan.spec.ts`, `apps/lms/src/index.html`

**Estimated scope:** M

## Task 2: Palette token infrastructure + `bidv-soft`

**Description:** Add the `$palettes` map and the allowed-key list to `_tokens.scss`. In
`_theme.scss`, emit light overrides on `:root[data-palette=x]` and dark overrides on
`:root[data-palette=x][data-theme=dark]` and, under `prefers-color-scheme: dark`,
`:root[data-palette=x]:not([data-theme=light])`. Add Sass `@error` guards: dark keys ⊇ light
keys, and only allowed keys. Fill `bidv-soft` (light + dark) with the spec's proposed values.

**Acceptance criteria:**

- [x] `bidv` output is byte-identical to before (no override block for `bidv`)
- [x] With `data-palette="bidv-soft"`, light and dark (both explicit and system) use soft values;
      no light override leaks into dark mode
- [x] A temporary bad map (missing dark key / disallowed key) fails the build with a clear message
      (checked by hand, then reverted)

**Verification:**

- [x] `npx nx test ui` (colour-literal guard green) and `npx nx build lms`
- [x] Manual: toggle the attribute in devtools across light, dark and system-dark

**Dependencies:** None (the attribute can be set by hand)

**Files likely touched:** `libs/ui/src/styles/ui/_tokens.scss`,
`libs/ui/src/styles/global/_theme.scss`

**Estimated scope:** S

## Task 3: `ui-swatch-group` molecule

**Description:** A presentational single-select listbox on `@angular/aria`, modelled on
`ui-segmented`, vertical. It takes `label` (required),
`options: { value, label, swatch: { fill, base } }[]` and a two-way `value` model. `fill` and
`base` are colour token keys, painted as `var(--color-<key>)` through `--swatch-fill` /
`--swatch-base` (the `ui-mai` pattern), so the consumer passes no class and no literal. The
selected option shows a check icon. The BEM block goes in `styles/components/_swatch-group.scss`.

**Acceptance criteria:**

- [x] Renders options; exactly one has `aria-selected="true"`
- [x] Arrow keys move and select; click selects; `valueChange` emits
- [x] Exported from `libs/ui/src/index.ts`; no colour literal; 44px touch targets

**Verification:**

- [x] `npx nx test ui`

**Dependencies:** None

**Files likely touched:** `libs/ui/src/lib/molecules/swatch-group/swatch-group.ts`, `.html`,
`swatch-group.spec.ts`, `libs/ui/src/styles/components/_swatch-group.scss`,
`libs/ui/src/index.ts`

**Estimated scope:** M

## Checkpoint A

- [ ] `npm run check` green. Everything passes except `change-password.spec.ts`
      ("Hook timed out in 10000ms"), which was already flaky before this work: it takes 5.7s alone
      on both HEAD and this branch and goes over 10s under the full parallel run
- [x] `bidv` unchanged: the compiled global CSS is identical to HEAD apart from the new palette
      blocks; the hand-set `bidv-soft` attribute resolves correctly in light, explicit dark,
      system dark, and forced light on a dark OS

## Task 4: `app-theme-controls` + `/design-system` TOC

**Description:** Shared domain UI in `apps/lms/src/app/shared/theme-controls/`: a
`ui-swatch-group` labelled "Bảng màu" (BIDV chuẩn, BIDV dịu, Xanh dương, Cát ấm) and a
`ui-segmented` labelled "Chế độ" (Hệ thống / Sáng / Tối), both bound to `ThemeStore`. Each
swatch needs that palette's light `primary` / `bg` while another palette is active, so
`_palettes.scss` also emits constant swatch tokens on `:root` (`--color-swatch-<id>-fill/-base`,
`bidv` from the base map) and the options pass those keys. The `/design-system` TOC
renders it instead of `app-theme-switch` (deleted). The colour section re-reads tokens when
`palette$()` changes.

**Acceptance criteria:**

- [x] Component spec: correct copy; selecting calls `setPalette` / `setPreference`; reflects store
- [x] `/design-system` switches palettes live, and the contrast table updates
- [x] `theme-switch/` removed with no dangling imports

**Verification:**

- [x] `npx nx test lms`
- [x] Browser: `/design-system`, switch `bidv` ↔ `bidv-soft` in light and dark

**Dependencies:** T1, T2, T3

**Files likely touched:** `apps/lms/src/app/shared/theme-controls/theme-controls.ts`, `.html`,
`.scss`, `theme-controls.spec.ts`, `design-system.ts` / `.html`, `color-section.ts`,
`theme-switch/` (delete)

**Estimated scope:** M

## Task 5: `blue` and `sand` palettes

**Description:** Add both palettes (light + dark) to `$palettes`, starting from the spec's
proposed values. Tune every value until Success Criterion 5 passes in the `/design-system`
contrast table.

**Acceptance criteria:**

- [x] All contrast rules in SPEC Success Criterion 5 pass for `bidv-soft`, `blue` and `sand`, in
      both light and dark
- [x] Only allowed keys are overridden (the Sass guard passes)

**Verification:**

- [x] `npx nx build lms`
- [x] Browser: contrast table for 3 palettes × 2 modes; screenshots saved for user review

**Dependencies:** T2, T4

**Files likely touched:** `libs/ui/src/styles/ui/_tokens.scss`

**Estimated scope:** S

## Checkpoint B

- [x] Contrast: `styles.spec.ts` asserts SPEC SC5 for all 4 palettes × light/dark (all pass with
      the proposed values, none needed tuning); `template-scan.spec.ts` keeps `THEME_PALETTES`, the
      pre-boot script and the token palettes in sync
- [ ] `npm run check` green (everything passes except the pre-existing `change-password` flake,
      see Checkpoint A)
- [ ] Palette screenshots reviewed by the user (Open Question 1) before the header work

## Task 6: `uiPopover` behaviour

**Description:** `button[uiPopover]="template"` with a required `popoverLabel`, on the CDK
`Overlay` (the `uiTooltip` approach) plus a CDK focus trap. It is a non-modal `role="dialog"`
panel anchored below the trigger and aligned to its end, and it toggles `aria-expanded` /
`aria-controls`. Escape closes it and returns focus to the trigger; an outside click closes it;
clicks inside keep it open. The BEM block goes in
`_popover.scss`.

**Acceptance criteria:**

- [x] Specs: open/close on trigger click; `aria-expanded`; Escape closes + focus returns; outside
      click closes; inside click keeps open
- [x] Exported from `libs/ui/src/index.ts`; tokens only
- [x] `migration-entries.data.ts` gains a `popover` molecule/organism entry (the registry spec
      requires one per `@lms/ui` export); same for `swatch-group`, added in T3

**Verification:**

- [x] `npx nx test ui`

**Dependencies:** None

**Files likely touched:** `libs/ui/src/lib/organisms/popover/popover.directive.ts`,
`popover.directive.spec.ts`, `libs/ui/src/styles/components/_popover.scss`,
`libs/ui/src/index.ts`

**Estimated scope:** M

## Task 7: Header theme picker

**Description:** `app-theme-picker` in `layout/header/theme-picker/`: a
`button[uiIconButton]` labelled "Tùy chỉnh giao diện" with the `palette` icon, opening a
`uiPopover` that contains `app-theme-controls`. Placed in `.header__actions` before the bell. On
screens narrower than `md` the panel is full width minus the gutter.

**Acceptance criteria:**

- [x] Spec: labelled icon button; opens a panel containing the controls
- [x] Shown on every app-shell page, on desktop and mobile
- [x] Choosing an option applies immediately and does not close the panel

**Verification:**

- [x] `npx nx test lms`
- [x] Browser: header flow on desktop and on the mobile preset

**Dependencies:** T4, T6

**Files likely touched:** `apps/lms/src/app/layout/header/theme-picker/theme-picker.ts`, `.html`,
`.scss`, `theme-picker.spec.ts`, `apps/lms/src/app/layout/header/header.html`, `header.ts`

**Estimated scope:** M

**Verified (2026-10-20):** in the browser with `mockBackend` temporarily on (reverted afterwards).
Enter on the icon opens the panel with focus on the first palette option; arrows change the
palette live; Tab reaches Chế độ and arrows switch to Tối; Escape closes and returns focus to the
icon; an outside click closes. At 375px the panel spans 16–359px with no horizontal scroll. The
browser check found two fixes: focus now waits for `ApplicationRef.whenStable()` (the listbox's
roving tabindex arrives in a second render pass), and the viewport margin is now 16px with full
width below `md`.

## Task 8: Docs and full verification

**Description:** Update the "Theme and dark mode" section of `docs/conventions/ui-library.md`
(palettes, `data-palette`, `lms.palette`, the guard) and document `uiPopover` and
`ui-swatch-group`. Run the full verification.

**Acceptance criteria:**

- [x] Docs match the code
- [x] SPEC Success Criteria 1–7 all verified

**Verification:**

- [x] `npm run check`
- [x] Browser: reload matrix of 4 palettes × 3 modes × OS light/dark with no flash; keyboard flow
      (Tab → Enter → arrows → Tab → Escape, with focus back on the icon); angular.md §14 checklist

**Verified (2026-10-20):** `ui-library.md` theme/palettes section, Popovers paragraph and overlay
rows updated; AGENTS.md `npm start` line corrected. Reload matrix on `/design-system`: the pre-boot
script alone gives the same `--color-primary` / `--color-bg` / `--color-text` as the booted app for all
12 palette × mode choices, under emulated OS light and OS dark; a real reload restores the stored
palette and mode in the controls. Keyboard flow checked in T7. §14 review clean. `npm run check`
green (Nx marks `lms:test` flaky because of the pre-existing `change-password.spec.ts` timeout).

**Dependencies:** T1–T7

**Files likely touched:** `docs/conventions/ui-library.md`

**Estimated scope:** S

## Checkpoint C: Complete

- [x] All acceptance criteria met; ready for PR review

---

# Revision 2: full themes

## Task 9: Token model v2 and emitter

**Description:** Add the new base tokens: `$fonts.display`, `display-weight`,
`display-tracking`, `radius-control`, `radius-card`, `texture-page`, and the colour keys
`eyebrow` and `nav-*`. Their BIDV values reproduce today's look exactly (radius-control = 6px,
radius-card = 14px, display = sans 700 −0.01em, eyebrow = text-muted, nav-\* = today's sidebar
colours, texture none). Extend `_palettes.scss` with the groups `shadow`, `type`, `shape` and
`texture` (the last three are mode-independent and light block only), the wider `colors` key
list, and a per-theme `swatch` source key. Add guard errors for the new groups.

**Acceptance criteria:**

- [x] `:root` emits the new properties, and every revision 1 property keeps its value (asserted)
- [x] Spec palettes with `type`/`shape`/`texture` emit them only in the light block; a `type` key
      in a dark map fails; an unknown group or key fails; a light `shadow` key without a dark value fails
- [x] Revision 1 palettes still compile and pass contrast (they are replaced in T13)

**Verification:** `npx nx test ui`; compiled CSS diff vs HEAD only adds properties

**Verified (2026-10-20):** 13 new or changed `styles.spec.ts` cases failed first, then passed.
The compiled global CSS compared with HEAD removes no line and adds 16 `:root` properties.
`nav-*` and `eyebrow` reference today's tokens (`var(--color-…)`), so BIDV is unchanged in both
modes. The contrast spec now follows `var()` references and composites `color-mix(…, transparent)`
washes. Spec deviation: `nav-strong` (brand name, hover text) and `nav-indicator` (active bar,
focus outline) were added to the `nav-*` set.

**Dependencies:** None

**Files likely touched:** `libs/ui/src/styles/ui/_tokens.scss`, `_functions.scss`,
`global/_palettes.scss`, `global/_theme.scss`, `styles.spec.ts`

**Estimated scope:** M

## Task 10: libs/ui components and base read the new semantic tokens

**Description:**

- h1–h3, `.page-header__title` and KPI values read the display tokens.
- Buttons, inputs, select, segmented, chips and the icon button (non-circular) read
  `radius-control`.
- Cards, the popover and the dialog read `radius-card`.
- `.page-header__eyebrow` reads `eyebrow`.
- `body` paints `texture-page`.

**Acceptance criteria:**

- [x] No `radius(sm|md|lg)` remains on a control or card surface that a theme should reach
      (listed in the task notes)
- [x] BIDV computed styles on `/design-system` are identical before and after: a script compares
      the border-radius, font-family, font-weight and letter-spacing of every element

**Verification:** `npx nx test ui`; browser computed-style comparison

**Verified (2026-10-20):** 15 new `theme hooks` cases in `styles.spec.ts` failed first, then
passed. In the browser on `/design-system` (BIDV), the computed values equal the previous ones:

- button 6px, segmented 10/6px, input 6px, card 14px
- h1 Be Vietnam Pro 700 −0.01em; h2 600, normal tracking
- body background-image none
- eyebrow `#5f6b69` (text-muted)

Deviations from the plan:

- A third shape key, `field` (inputs, selects, textareas), keeps a pill `control` radius off
  textareas.
- The dialog keeps `radius-xl` (20px, not the 14px card radius), so BIDV stays identical.
- Chips and icon buttons are already round and keep `radius-full`.
- The `ui.eyebrow` mixin now reads `eyebrow`, which every eyebrow uses.

**Dependencies:** T9

**Files likely touched:** `global/_base.scss`, `components/_btn.scss`, `_input.scss`,
`_select.scss`, `_segmented.scss`, `_chip.scss`, `_card.scss`, `_popover.scss`, `_dialog.scss`,
`_page-header.scss`, `_kpi.scss` (each is a one-line change)

**Estimated scope:** M (many files, mechanical)

## Task 11: Sidebar reads `nav-*` tokens

**Description:** Replace `primary-strong`, `primary-subtle`, `white`, `hero-subtle` and the
white `color-mix` washes in `sidebar.scss` with `nav-bg`, `nav-text`, `nav-muted`, `nav-hover`,
`nav-active-bg`, `nav-active-text` and `nav-border`. Do the same for the login hero only where it
shares those colours.

**Acceptance criteria:**

- [x] BIDV sidebar is pixel-identical (expanded, collapsed rail, mobile drawer; light and dark)
- [x] Setting a spec theme with a light `nav-bg` gives a readable light sidebar (manual
      devtools check)

**Verification:** `npx nx test lms`; screenshots before/after

**Verified (2026-10-20):** a new `template-scan.spec.ts` guard (the sidebar reads `nav-*` colours
only, with no `color-mix`) failed first, then passed. A script compiled the old and new
`sidebar.scss` and resolved all 26 colour declarations against BIDV `:root`, light and dark.

- The only difference is the inherited base colour of `.sidebar` (`primary-subtle` →
  `nav-text`).
- Every visible child (brand, role, sections, links, footer, toggle) sets its own colour, and
  `ui-mai` paints with its own tokens, so no pixel changes.
- The login hero needed no change: it already reads `hero-*`, which themes can override.

The browser check of a light sidebar is deferred to T13 (it needs the app shell).

**Dependencies:** T9

**Files likely touched:** `apps/lms/src/app/layout/sidebar/sidebar.scss`, possibly
`features/auth/login/login.scss`

**Estimated scope:** S

## Task 12: Theme fonts

**Description:** Add `@fontsource/fraunces` (500) and `@fontsource/nunito-sans` (300, 400, 600, 700) at 5.3.0, list their CSS in `apps/lms/project.json` styles, and add font stack tokens for
the themes to use. Update `docs/conventions/workspace.md` (the font row).

**Acceptance criteria:**

- [x] With BIDV active, the network panel shows no Fraunces or Nunito Sans request
- [x] A test element in each family renders Vietnamese diacritics in that font, not the fallback
      (check `document.fonts`)
- [x] `check-bundle` and the budgets stay green

**Verification:** `npm run check`; browser network panel

**Verified (2026-10-20):**

- **Guard test:** a new `template-scan.spec.ts` guard failed first (`ui.$font-stacks` did not
  exist), then passed. It checks that every face in `ui.$font-stacks` has `@fontsource/<name>`
  CSS in the build styles.
- **Fonts on demand:** in the browser on `/design-system`, BIDV loads only Be Vietnam Pro files.
  A probe element in Fraunces 500 and Nunito Sans 300 then fetches their Latin, Latin-ext and
  Vietnamese subsets. `document.fonts.check` passes for "ệ" and "ậ" in each face.
- **Bundle:** `check-bundle` is green. The fonts add about 13 KB of raw `@font-face` CSS. The
  initial bundle (841 KB) was already over the 500 KB _warning_ budget before this task; the
  error budget is 1 MB.

Fraunces 600 and Nunito Sans 500 were added, so h2/h3 (600) and medium labels (500) are not
synthesised.

**Dependencies:** T9

**Files likely touched:** `package.json`, `package-lock.json`, `apps/lms/project.json`,
`_tokens.scss`, `docs/conventions/workspace.md`

**Estimated scope:** S

## Checkpoint C2

- [x] `npm run check` green
- [x] BIDV identical to `main`. This was checked through the compiled CSS diff (T9), computed
      styles on `/design-system` (T10) and the resolved sidebar colours in light and dark (T11),
      not pixel screenshots.

## Task 13: Ngọc, Cobalt, Giấy

**Description:**

- Replace `bidv-soft`, `blue` and `sand` with `ngoc`, `cobalt` and `giay`, using the SPEC values
  tuned to pass contrast.
- Update `THEME_PALETTES`, `index.html`, the theme-controls labels and swatch keys, the store,
  controls and design-system specs, and the contrast rules (`eyebrow`, `accent-ink`, `nav-*`,
  `on-accent`).

**Acceptance criteria:**

- [x] Picker lists BIDV chuẩn, Ngọc, Cobalt, Giấy; an old stored id falls back to `bidv`
- [x] Contrast spec passes for every theme × mode, including the new rules
- [x] Id-sync guard green

**Verification:** `npm run check`; screenshots of the 3 themes × light/dark (dashboard, course
page, login, header popover open) for the user

**Verified (2026-10-20):**

- **Specs:** the store, controls, picker, design-system and styles specs were moved to the new ids
  and failed first. They gained cases for old ids falling back to `bidv` and for each theme's
  own face, control radius and texture. All passed after the change.
- **Contrast:** passes for every theme × mode under the extended rules (eyebrow, accent-ink,
  on-accent, nav-\*).
- **`npm run check`:** green, all 4 projects, the change-password flake included this run.
- **Browser:** checked with `mockBackend` temporarily on, signing in from the Demo menu; the
  setting was reverted afterwards and never committed.
  - `/admin/users` in Ngọc, Cobalt and Giấy, light and dark: sidebar, page header, table, badges
    and buttons.
  - `/login` in Cobalt (gradient hero, light Nunito heading, pill button) and Giấy (Fraunces
    heading, rust eyebrow, ink button).
  - BIDV unchanged.

Added `texture.page-size` (the dot grid needs a tile size). The dot colour mixes
`--color-text`, so it follows dark mode.

**Dependencies:** T10, T11, T12

**Files likely touched:** `_tokens.scss`, `styles.spec.ts`, `theme.store.ts` (+spec),
`index.html`, `theme-controls.ts` (+spec), `design-system.spec.ts`

**Estimated scope:** M

## Checkpoint D

- [x] User reviews the theme screenshots and approves (or requests tuning) before T14
      (approved 2026-10-20; the mai logo keeps following each theme's accent)

## Task 14: BIDV chuẩn refinements

**Description:** Apply the SPEC refinements in the base tokens:

- two-layer ink-tinted shadows
- display tracking −0.02em on h1–h3 (weight 700)
- `radius-control` 8px
- `eyebrow` = `primary`

**Acceptance criteria:**

- [x] `styles.spec.ts` asserts the BIDV `:root` differs from revision 1 only in these properties
- [x] Contrast still passes for BIDV light and dark

**Verification:** `npx nx test ui`; before/after screenshots in the PR

**Verified (2026-10-20):** two new `styles.spec.ts` cases failed first, then passed:

- `:root` values: control 8px, field 6px, card 14px, display −0.02em / 700, eyebrow →
  `primary`.
- md/lg shadows have two ink-tinted layers.

Contrast still passes for BIDV light and dark (eyebrow = primary). In the browser on
`/design-system` (BIDV), the button radius is 8px, h1 letter-spacing is −0.72px at 36px, and
`--shadow-md` has both layers. The section eyebrows render in brand teal.

**Dependencies:** Checkpoint D

**Files likely touched:** `_tokens.scss`, `styles.spec.ts`

**Estimated scope:** XS

## Task 15: Docs, full verification, PR #34 update

**Description:**

- Update `ui-library.md`: theme groups, new tokens, fonts, and the rule that components read
  semantic tokens.
- Run the reload matrix (4 × 3 × OS light/dark), the keyboard flow and the font network check.
- Run `npm run check` and the §14 review.
- Update the PR #34 description with screenshots, after asking.

**Acceptance criteria:**

- [x] SPEC Success Criteria 1–7 verified
- [x] Docs match the code

**Verification:** `npm run check`; browser

**Verified (2026-10-20):**

- **Docs:** the `ui-library.md` theme section is rewritten (semantic hooks, theme groups, fonts,
  extended contrast rules); `ui.texture` is added to the function list; the workspace font row
  was updated in T12.
- **Reload matrix:** for 4 themes × 3 modes, under OS light and under OS dark, the pre-boot script
  alone gives the same `primary`, `bg`, `nav-bg` and `radius-control` (and display font) as the
  booted app.
- **SC6 fonts:** fresh loads fetch BIDV → Be Vietnam Pro, Ngọc → Be Vietnam Pro,
  Cobalt → Nunito Sans, Giấy → Be Vietnam Pro + Fraunces.
- **Keyboard flow:** the picker and popover code is unchanged since revision 1 (verified in T7);
  only the labels and ids changed, and the specs cover them.
- **§14 review:** clean. Only tokens, SCSS, specs and the `ThemeStore` id list changed; no new
  component, effect or state.
- **`npm run check`:** green on the rerun. The first run failed only `lms:test` on the known
  `change-password.spec.ts` timeout flake.

**Dependencies:** T14

**Estimated scope:** S

## Checkpoint E: Complete

- [x] All acceptance criteria met; PR #34 ready for review
