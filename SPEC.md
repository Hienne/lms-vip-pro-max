# Spec: Custom theme (palette + light/dark) from the header

Status: **approved 2026-10-19**. Single capability (no capability map needed).

## Objective

Let every signed-in user choose how the LMS looks from a palette icon button in the app header.
The standard BIDV teal is saturated and dark for long study sessions, so the app gets three more
palettes alongside it: a softer BIDV and two quiet, minimal palettes.

**Users:** all roles (learner, instructor, admin). The choice belongs to the browser, not the
account: it is stored in `localStorage`, has no server API and does not follow the user to another
device.

### User stories

1. As a learner, I click the palette icon in the header, pick **BIDV dịu**, and the whole app
   (sidebar, buttons, hero, backgrounds) changes at once, without a reload.
2. As a user, I set **Tối** (dark) in the same dropdown and the chosen palette shows its dark
   variant.
3. As a user, I reload or come back tomorrow and the app opens in my palette and mode, with no
   flash of the default teal.
4. As a keyboard or screen-reader user, I can open the dropdown, move between options with the
   arrow keys, select one, and close with Escape. Focus then returns to the icon.

### Palettes

| Id          | Label (UI copy) | Character                                                                                          |
| ----------- | --------------- | -------------------------------------------------------------------------------------------------- |
| `bidv`      | BIDV chuẩn      | Today's tokens, unchanged. **Default** (no stored choice = `bidv`).                                |
| `bidv-soft` | BIDV dịu        | Same teal hue but less saturated and lighter; sidebar and hero are mid-teal instead of near-black. |
| `blue`      | Xanh dương      | Muted steel-blue primary, cool near-white neutrals. Calm and professional.                         |
| `sand`      | Cát ấm          | Muted terracotta primary, warm cream neutrals. Paper-like.                                         |

Each palette has a light **and** a dark variant. A palette overrides **brand + neutral** tokens only:

- **Changes:** `primary`, `primary-hover`, `primary-strong`, `primary-subtle`, `on-primary`,
  `ring`, `on-dark-hover`, `hero-from`, `hero-to`, `hero-muted`, `hero-subtle`, `bg`, `surface`,
  `surface-2`, `surface-sunken`, `text`, `text-secondary`, `text-muted`, `border`, `border-strong`,
  `cover-layers`, chart `1` and `grid`.
- **Never changes:** semantic colours (`success*`, `warning*`, `danger*`, `info*`), hoa mai
  `accent*`, `hero-accent`, `hero-chip`, `white`, `black`, `overlay`, the other cover tints and
  chart colours 2–5.

Starting values are proposals. Each one must pass the contrast rules in Success Criteria before
it ships and may be adjusted to do so.

| Token (light)  | bidv-soft | blue      | sand      |
| -------------- | --------- | --------- | --------- |
| primary        | `#2a7f7b` | `#33659f` | `#9a5b3c` |
| primary-strong | `#2f5f5d` | `#1f3b63` | `#5a3a2a` |
| primary-subtle | `#edf5f4` | `#eaf1fa` | `#f6ece4` |
| bg             | `#f7faf9` | `#f5f8fc` | `#faf7f2` |
| surface-2      | `#f1f6f5` | `#eef3f9` | `#f4efe7` |
| border         | `#e4ecea` | `#e0e7f0` | `#ebe3d6` |

| Token (dark) | bidv-soft | blue      | sand      |
| ------------ | --------- | --------- | --------- |
| primary      | `#6cc4bd` | `#7fb0ec` | `#e0a382` |
| bg           | `#111917` | `#0f141b` | `#1a1612` |
| surface      | `#17201f` | `#151b24` | `#211c17` |

### The dropdown

- **Trigger:** `button[uiIconButton]` with `<ui-icon name="palette" />` (the icon is already in the
  registry), label **"Tùy chỉnh giao diện"**, placed in `.header__actions` before the bell.
  `aria-haspopup="dialog"`, `aria-expanded` reflects the open state.
- **Panel** (non-modal popover, anchored below the trigger, aligned right):
  - Group **"Bảng màu"**: four swatch options (a colour dot built from that palette's own
    `primary`/`bg` tokens, plus the label). One selected option, `@angular/aria` listbox semantics.
    Selecting applies immediately.
  - Group **"Chế độ"**: the existing `ui-segmented` with **Hệ thống / Sáng / Tối**, bound to
    `ThemeStore.preference$`.
- **Closes on** Escape, a click outside, or a click on the trigger. Focus returns to the trigger.
  Choosing an option does **not** close the panel, so the user can compare palettes.
- **Mobile (< md):** same popover, full width minus the gutter, still under the header.

## Tech Stack

Angular 22 (standalone, zoneless, signals) · `@angular/aria` listbox · `@angular/cdk/overlay`
(`CdkConnectedOverlay`, as `ui-menu` already uses) · SCSS through the `ui` module · Vitest.
No new dependencies.

## Architecture

```
index.html inline script ──applies──▶ <html data-theme data-palette>
                                              ▲
ThemeStore (core/theme) ─── only writer ──────┘   persists lms.theme + lms.palette
   ▲  preference$ / palette$ / effective$ ; setPreference() / setPalette()
   │
app-theme-controls (shared/theme-controls)      ← reads store, calls commands
   uses: ui-swatch-group (libs/ui, new) · ui-segmented (existing)
   ├── app-theme-picker (layout/header/theme-picker) wraps it in uiPopover (libs/ui, new)
   └── /design-system table of contents renders it inline (replaces app-theme-switch)

_tokens.scss $palettes map ──▶ _theme.scss emits :root[data-palette=…] (light + dark)
```

Decisions:

1. **Extend `ThemeStore`**, not a second store. It stays the only writer of theme attributes and
   gains `palette$()` and `setPalette(id)`. Storage key `lms.palette`, where absence means `bidv`.
   Unknown stored values fall back to `bidv`. Blocked storage never throws, as today.
2. **`data-palette` attribute on `<html>`**, absent for `bidv`. `template-scan.spec.ts` widens its
   rule: only `theme.store.ts` (and `index.html`) may write `data-theme` or `data-palette`.
3. **Tokens stay the single source.** `_tokens.scss` gains
   `$palettes: (bidv-soft: (light: (…), dark: (…)), blue: …, sand: …)` holding colour keys plus
   a nested `chart` map. `_theme.scss` emits:
   - `:root[data-palette='x']` for the light overrides;
   - `:root[data-palette='x'][data-theme='dark']` and, inside `prefers-color-scheme: dark`,
     `:root[data-palette='x']:not([data-theme='light'])` for the dark overrides.

   Specificity (0,3,0) beats the base dark rules, so ordering does not matter. A Sass `@error`
   fails the build when a palette's dark map does not override every key its light map
   overrides, or when it overrides a key outside the allowed list above. This prevents a palette
   light value from leaking into dark mode.

4. **No-flash script** in `index.html` also reads `lms.palette` and checks it against the
   allowed ids before setting the attribute.
5. **New `@lms/ui` pieces**, both presentational, with no theme or palette knowledge:
   - `uiPopover` (organism-level behaviour): `button[uiPopover]="template"` with a required
     `popoverLabel`, on the CDK `Overlay` (like `uiTooltip`) plus a CDK focus trap. It renders the
     template in a `role="dialog"` panel (`ui-popover-panel`, width `ui.layout(popover)`), toggles
     `aria-expanded` / `aria-controls`, moves focus to the first control, closes on Escape (focus
     back to the trigger) and on an outside click. `@angular/aria` has no popover pattern.
   - `ui-swatch-group` (molecule): an `@angular/aria` listbox with a two-way `value` model and
     options `{ value, label, swatch: { fill, base } }`, where `fill` and `base` are colour token
     keys painted as `var(--color-<key>)` (the `ui-mai` pattern), never a literal.
6. **Domain UI** `app-theme-controls` (`apps/lms/src/app/shared/theme-controls/`) renders both
   groups and maps `ThemePalette` ids to labels and swatch token keys. Each swatch shows a
   palette other than the active one, so `_palettes.scss` emits constant swatch tokens on `:root`
   (`--color-swatch-<id>-fill/-base` from each palette's light `primary` / `bg`, and `bidv` from
   the base map). They are generated from the token maps, so they never drift.
   `app-theme-picker` (`layout/header/theme-picker/`) is only the icon trigger + popover around it.
7. **`/design-system`**: the table of contents renders `app-theme-controls` in place of
   `app-theme-switch` (deleted), so every token sample can be reviewed per palette. The colour
   section's contrast table re-reads tokens when `palette$()` changes, as well as `effective$()`.

## Commands

```bash
nvm use
npm start                 # app on :4200 with the mock API
npx nx test lms           # ThemeStore, theme picker, template scan
npx nx test ui            # uiPopover, ui-swatch-group
npm run check             # format, lint, typecheck, test, build, bundle guard
```

## Project Structure

```
libs/ui/src/styles/ui/_tokens.scss                  + $palettes map, allowed-key list
libs/ui/src/styles/global/_theme.scss               + palette emission + @error guards
libs/ui/src/styles/global/_palettes.scss            new: palette emitter + Sass guards (no CSS on load)
libs/ui/src/lib/organisms/popover/                  new: popover.directive.ts (+ trigger), spec
libs/ui/src/lib/molecules/swatch-group/             new: swatch-group.ts/.html/.scss, spec
libs/ui/src/styles/components/_popover.scss         new BEM block (@layer components)
libs/ui/src/styles/components/_swatch-group.scss    new BEM block
libs/ui/src/index.ts                                + exports
apps/lms/src/app/core/theme/theme.store.ts          + palette$, setPalette, lms.palette
apps/lms/src/app/core/theme/theme.store.spec.ts     + palette cases
apps/lms/src/app/shared/theme-controls/              new: theme-controls.ts/.html/.scss, spec
apps/lms/src/app/layout/header/theme-picker/        new: theme-picker.ts/.html/.scss, spec
apps/lms/src/app/layout/header/header.html/.ts      + <app-theme-picker />
apps/lms/src/app/template-scan.spec.ts              rule widened to data-palette
apps/lms/src/index.html                             no-flash script reads lms.palette
apps/lms/src/app/features/design-system/…/color-section.ts   re-read on palette change
apps/lms/src/app/features/design-system/…/design-system.*     TOC uses app-theme-controls
apps/lms/src/app/features/design-system/…/theme-switch/       deleted
docs/conventions/ui-library.md                      "Theme and dark mode" → palettes, new pieces
```

## Code Style

The store follows the existing `ThemeStore` shape: private `state` signals, `$`-suffixed readonly
selectors, effects for side effects, and one command per intent.

```ts
export const THEME_PALETTES = ['bidv', 'bidv-soft', 'blue', 'sand'] as const;
export type ThemePalette = (typeof THEME_PALETTES)[number];
export const PALETTE_STORAGE_KEY = 'lms.palette';

// inside ThemeStore
readonly palette$ = this.state.palette.asReadonly();

private readonly applyPalette = effect(() => {
  const palette = this.palette$();
  untracked(() => {
    if (palette === 'bidv') this.root.removeAttribute(PALETTE_ATTRIBUTE);
    else this.root.setAttribute(PALETTE_ATTRIBUTE, palette);
  });
});

/** Choose BIDV chuẩn, BIDV dịu, Xanh dương or Cát ấm. */
setPalette(palette: ThemePalette): void {
  this.state.palette.set(palette);
}
```

```html
<!-- theme-controls.html (shared) -->
<ui-swatch-group label="Bảng màu" [options]="palettes" [value]="theme.palette$()" (valueChange)="theme.setPalette($event)" />
<ui-segmented label="Chế độ" [options]="modes" [value]="theme.preference$()" (valueChange)="theme.setPreference($event)" />

<!-- theme-picker.html (header) -->
<button uiIconButton label="Tùy chỉnh giao diện" popoverLabel="Tùy chỉnh giao diện" [uiPopover]="panel">
  <ui-icon name="palette" />
</button>
<ng-template #panel>
  <app-theme-controls />
</ng-template>
```

Conventions: English identifiers, Vietnamese copy, tokens only (no colour literal outside
`_tokens.scss`), BEM classes in component `.scss`, and imports that point down the atomic levels.

## Testing Strategy

| Level                           | What                                                                                                                                                                                                                                                 | Where                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Unit: store                     | default `bidv` with no storage; reads a valid stored id; ignores an unknown id; `setPalette` writes the attribute and storage; `bidv` removes both; blocked storage (getter throws, setItem throws) does not throw; palette and mode are independent | `theme.store.spec.ts`       |
| Unit: `uiPopover`               | opens and closes on trigger click; `aria-expanded`; Escape closes and returns focus; outside click closes; stays open on inside click                                                                                                                | `popover.directive.spec.ts` |
| Unit: `ui-swatch-group`         | renders options; one `aria-selected`; arrow keys move and select; click selects; emits `valueChange`                                                                                                                                                 | `swatch-group.spec.ts`      |
| Component: `app-theme-controls` | four palettes + three modes rendered with the right copy; selecting calls `setPalette` / `setPreference`; reflects store state (store stubbed)                                                                                                       | `theme-controls.spec.ts`    |
| Component: `app-theme-picker`   | icon button with label; opens a panel containing `app-theme-controls`                                                                                                                                                                                | `theme-picker.spec.ts`      |
| Guard                           | template scan: only ThemeStore writes `data-palette`; colour-literal guard still green                                                                                                                                                               | `template-scan.spec.ts`     |
| Build                           | Sass `@error` guards and SC5 contrast for every palette × mode, asserted by compiling the styles                                                                                                                                                     | `styles.spec.ts`            |
| Browser (manual)                | see Success Criteria 4–6                                                                                                                                                                                                                             | `npm start`                 |

## Boundaries

- **Always:** keep `ThemeStore` the only runtime writer of `data-theme` and `data-palette`; put
  every colour in `_tokens.scss`; give each palette both light and dark values; tolerate blocked
  storage; run `npm run check` before calling the work done.
- **Ask first:** changing any `bidv` (standard) token value; making a palette override a semantic
  or accent colour; adding a dependency; storing the choice server-side or per account; changing
  the default palette.
- **Never:** branch on theme or palette in a component or SCSS file (only tokens change); write a
  colour literal outside `_tokens.scss`; read the DOM attribute instead of the store; ship a
  palette that fails a contrast rule.

## Success Criteria

1. The header shows a palette icon button (44px touch target, label "Tùy chỉnh giao diện") on
   every page that renders the app shell, on desktop and mobile.
2. The dropdown lists **BIDV chuẩn, BIDV dịu, Xanh dương, Cát ấm** and **Hệ thống / Sáng / Tối**.
   Selecting a palette restyles the app immediately, without a reload.
3. Choices persist in `localStorage` (`lms.palette`, `lms.theme`). With no stored palette the app
   looks exactly as it does today (no visual diff on `bidv` light or dark).
4. **No flash:** reloading in each of the 4 palettes × 3 modes, with the OS set to light and to
   dark, paints the right colours from the first frame.
5. **Contrast** for each palette in both light and dark modes:
   - 4.5:1 or more for `text`, `text-secondary` and `text-muted` on `bg`, `surface` and
     `surface-2`;
   - 4.5:1 or more for `on-primary` on `primary`;
   - 4.5:1 or more for `primary` used as a link or text colour on `surface`;
   - 3:1 or more for `border-strong` and `ring` against `surface`;
   - 4.5:1 or more for `hero-muted` on `hero-to`.

   Checked with the `/design-system` contrast table after switching to that palette.

6. **Keyboard and screen reader:** Tab to the icon, Enter opens the panel, arrow keys change the
   palette, Tab reaches the mode control, and Escape closes the panel and returns focus to the
   icon. The listbox exposes `aria-selected`.
7. `npm run check` passes, the angular.md §14 checklist passes, and `ui-library.md` documents
   palettes, `uiPopover` and `ui-swatch-group`.

## Resolved Questions

1. **Palette selector in `/design-system`:** yes. The TOC renders the shared `app-theme-controls`
   (palette + mode), replacing `app-theme-switch`.

## Open Questions

1. **Exact hex values:** tuned to pass the contrast rules; the user reviews each palette from
   `/design-system` screenshots in the PR.
