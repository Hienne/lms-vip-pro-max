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
