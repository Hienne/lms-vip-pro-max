# UI library (`@lms/ui`): atomic, directive-first

Rules for every reusable piece of UI: the design system in `libs/ui`, and the
domain-aware presentational UI in `apps/lms/src/app/shared/` that composes it.

How that UI looks (hierarchy, colour use, type, shape, density, motion, and the
AI-template patterns that are banned) is `docs/conventions/visual-design.md`. It
applies to every piece here and overrides the mockup's look.

## Atomic levels

| Level     | What it is                                                                                      | Lives in                            | May use                                       |
| --------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------- |
| Tokens    | SCSS maps emitted as CSS custom properties: color, type, space, radius, shadow, motion, z-index | `libs/ui/src/styles/ui/`            | —                                             |
| Atom      | One native element with a look or a behaviour                                                   | `libs/ui/src/lib/atoms/<name>/`     | tokens                                        |
| Molecule  | A few atoms doing one job (label + control + error)                                             | `libs/ui/src/lib/molecules/<name>/` | atoms                                         |
| Organism  | A self-contained section (data table, page header, dialog shell, chart)                         | `libs/ui/src/lib/organisms/<name>/` | molecules, atoms                              |
| Domain UI | Organism/molecule that knows LMS types (course card, role badge)                                | `apps/lms/src/app/shared/<name>/`   | anything in `@lms/ui`, `@lms/contracts` types |
| Template  | Page layout with slots (app shell, focus layout)                                                | `apps/lms/src/app/layout/`          | all of the above                              |
| Page      | Route module                                                                                    | `apps/lms/src/app/features/`        | all of the above                              |

Imports point **down** the table only. An atom importing a molecule, or
`libs/ui` mentioning `Course`, is a level violation: move the piece to the
level where its dependencies live.

One deliberate exception: an atom that is a specialisation of a sibling atom may compose it
(`ui-mai-badge` and `ui-ring` use `ui-mai`, `ui-avatar-group` wraps `ui-avatar`s). A molecule or
organism never imports upward.

The mockup's `.ring` is `.progress-ring` here; it keeps that name.

Every `@lms/ui` export is presentational (inputs, outputs, content projection,
no store, no HTTP) and is exported from `libs/ui/src/index.ts`.

## Directive first

Choose the first form that fits:

1. **Attribute directive on a native element** when the piece is a look or
   state on one element: `button[uiButton]`, `input[uiInput]`, `select[uiSelect]`,
   `span[uiBadge]`, `article[uiCard]`, `table[uiTable]`. The consumer keeps the
   native element, so semantics, form binding, `type`, `href`, `disabled`,
   `aria-*` and events work with no re-plumbing.
2. **Behaviour directive** for reusable behaviour (`uiTooltip`, `uiAutofocus`,
   `uiDropzone`). Combine behaviours with `hostDirectives` instead of a wrapper
   component or inheritance.
3. **Component** only when the piece owns DOM the consumer should not write:
   SVG (`ui-icon`, `ui-ring`, charts), generated structure (`ui-avatar`
   initials, `ui-data-table`), or several projection slots (`ui-field`,
   `ui-page-header`). `ui-field` is the one component that depends on
   `@angular/forms/signals` at runtime: it reads the state of its projected
   `[formField]` and shows that field's validator messages once touched, so it
   has no `errors` input.
4. **Wrap `@angular/aria` / `@angular/cdk`** for composite widgets and overlays
   (table below). Our code adds the look; the library owns keyboard, focus and
   ARIA.

A wrapper component around a single native element (`<ui-button>` rendering a
`<button>`) is the shape this rule replaces.

## Anatomy

- Selector prefix `ui` in `libs/ui` (`uiButton`, `ui-field`), `app` in the app.
- Files follow angular.md §2: `button.directive.ts` → class `Button`;
  `field.ts` + `field.html` → class `Field`; spec beside each.
- Variants are string-literal union inputs with these names only:
  `variant` (visual emphasis), `tone` (semantic colour:
  `neutral | primary | success | warning | danger | info | reward`),
  `size` (`sm | md | lg`). Boolean flags use `booleanAttribute`.
- Classes are applied through `host` metadata: a static block class plus one
  computed modifier list.

```ts
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'on-dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Directive({
  selector: 'button[uiButton], a[uiButton]',
  host: { class: 'btn', '[class]': 'modifiers()' },
})
export class Button {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly block = input(false, { transform: booleanAttribute });

  protected readonly modifiers = computed(() => [`btn--${this.variant()}`, this.size() === 'md' ? '' : `btn--${this.size()}`, this.block() ? 'btn--block' : '']);
}
```

```html
<button uiButton variant="primary" type="submit" [disabled]="store.isSaving$()">Lưu</button> <a uiButton routerLink="/catalog">Mở danh mục</a>
```

Icon-only actions use `button[uiIconButton]`, whose required `label` input
sets `aria-label` and the tooltip, so an unnamed icon button does not compile
(Angular reports `NG8008: Required input 'label'`). It is the round 44px touch target
(`.icon-btn`); the mockup's square icon-only `btn--icon` is not ported.

`uiButton` details: icon and text go where the markup puts them
(`<button uiButton><ui-icon name="play" size="sm" /> Bắt đầu</button>`); `busy` shows a spinner,
sets `aria-busy` and swallows activation while the button stays focusable; `disabled` is native
on a button and `aria-disabled` + `tabindex="-1"` + swallowed activation on a link; `type`
defaults to `button`, so write `type="submit"` for a form's submit button.

## Styling

SCSS only. There is no PostCSS step and no utility framework; the Sass compiler is the only style tool.

- **Tokens are declared once, as SCSS maps.** `libs/ui/src/styles/ui/_tokens.scss` ports
  `lms-mockup/assets/css/tokens.css`: one map per namespace (colours, chart colours, spacing, text
  sizes, leadings, weights, trackings, radii, shadows, durations, easings, animations, breakpoints,
  layout sizes, z-indexes) and a dark map for the values that change. `global/_theme.scss` emits them
  as CSS custom properties, light on `:root` and dark behind the mockup's two conditions. This file
  is the only stylesheet that may contain a colour literal (a spec fails on a hex or `rgb()` anywhere
  else). Custom property names are the contract with every stylesheet and with `ThemeStore`; the
  table below maps the mockup's names to them.
- **The `ui` Sass module** (`libs/ui/src/styles/ui/`) is what every stylesheet uses:
  `@use 'ui';` at the top of any `.scss` in the app or the UI library, with no relative path
  (the app's build and test targets put `libs/ui/src/styles` on the Sass include path). Using it
  emits no CSS.
  - **Functions** return `var(--<namespace>-<key>)` and fail the build on an unknown key, naming the
    namespace and the valid keys: `ui.color`, `ui.chart`, `ui.space`, `ui.radius`, `ui.shadow`,
    `ui.text-size`, `ui.leading`, `ui.weight`, `ui.tracking`, `ui.font`, `ui.duration`, `ui.ease`,
    `ui.z`, `ui.texture`, `ui.layout`.
  - **Breakpoints**: `@include ui.bp(md)` is a mobile-first `min-width` media query from the
    `sm 640 / md 720 / lg 1100 / xl 1280` map, the only place widths are written. Write the narrow
    layout as the base style. `ui.bp-below(md)` exists for the one narrow-only case (a responsive table
    turning into cards).
  - **Layout mixins**: `ui.stack($gap)`, `ui.row($gap)`, `ui.row-between($gap)`, `ui.grow`,
    `ui.grid((md: 2, lg: 3), $gap)` (columns per breakpoint, `base` defaults to 1). Gaps are spacing
    keys.
  - **Typography mixins**: `ui.text($size, $tone)` (a tone is a colour key, or `muted`, `secondary`,
    `accent`), `ui.num`, `ui.mono`, `ui.truncate`, `ui.clamp($lines)`. `ui.eyebrow` remains only
    for code not yet migrated; new code never uses it (`visual-design.md`).
  - **Accessibility and motion**: `ui.sr-only`, `ui.focus-ring`, `ui.animate(enter | reward-pop |
shimmer | spin)` (reduced motion shows the end state).
- **Spacing** uses the mockup's 4px steps only: 1, 2, 3, 4, 5, 6, 8, 10, 12, 18. The mockup's
  off-scale gaps (10px, 14px…) round to the nearest step; note a visible snap in the pull request.
- **Atom look = one SCSS partial per BEM block**, ported from the mockup's `components.css` into
  `libs/ui/src/styles/components/_<block>.scss`, wrapped in `@layer components`, and applied only by
  the owning atom's `host` class. Templates outside `libs/ui` never write block classes
  (`class="btn btn--primary"`); they use the atom.
- **Templates carry semantic class names.** A wrapper that only arranges its children uses a layout
  helper. An element with its own role, any text or colour styling, or responsive behaviour outside
  the helper presets gets a BEM class and is styled with mixins in the component's own `.scss`.
  Route-specific styles from the mockup's `pages.css` go there too.
- **Dynamic classes**: TypeScript maps and class bindings return BEM modifier names
  (`due-date--danger`, `[class.course-card__status--failed]`), never style values. A sample that must
  list every token (the `/design-system` spacing, radius, shadow and type samples) is a modifier
  generated with `@each` over the token map, so the showcase never drifts from the tokens.
- Runtime values go through a CSS variable binding (`[style.--value]="pct() + '%'"`), never an inline
  literal. Inline `style="color:#fff"` in mockup markup becomes a token.
- Dark mode and palettes come from tokens only: see [Theme, palettes and dark mode](#theme-palettes-and-dark-mode).

### Mockup token → project token

| Mockup (`tokens.css`)                                                           | Project token                                                   | Accessor                                    |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| `--color-*` (brand, semantic, neutral)                                          | unchanged                                                       | `ui.color(primary)`, `ui.color(text-muted)` |
| `--chart-1` … `--chart-5`, `--chart-grid`                                       | `--color-chart-1` … `--color-chart-grid`                        | `ui.chart(1)`, `ui.chart(grid)`             |
| `--font-sans`, `--font-mono`                                                    | unchanged                                                       | `ui.font(sans)`                             |
| `--text-xs` … `--text-3xl`                                                      | unchanged                                                       | `ui.text-size(sm)`, `ui.text-size(2xl)`     |
| `--leading-tight/normal/relaxed`                                                | unchanged                                                       | `ui.leading(tight)`                         |
| `--weight-regular/medium/semibold/bold`                                         | `--font-weight-regular/medium/semibold/bold`                    | `ui.weight(semibold)`                       |
| `--space-1` … `--space-12`                                                      | `--spacing-1` … `--spacing-12`                                  | `ui.space(4)`                               |
| `--radius-*`, `--shadow-*`                                                      | unchanged                                                       | `ui.radius(lg)`, `ui.shadow(md)`            |
| `--duration-fast/base/slow`                                                     | `--transition-duration-fast/base/slow`                          | `ui.duration(fast)`                         |
| `--ease-out`                                                                    | unchanged                                                       | `ui.ease(out)`                              |
| `@keyframes enter/reward-pop/shimmer/spin`, `.animate-enter`, `.animate-reward` | `--animate-enter/reward-pop/shimmer/spin`                       | `@include ui.animate(enter)`                |
| `--sidebar-width`, `--content-max`                                              | `--container-sidebar`, `--container-content`                    | `ui.layout(sidebar)`, `ui.layout(content)`  |
| `--header-height`, `--control-height(-sm)`, `--touch-min`                       | `--spacing-header`, `--spacing-control(-sm)`, `--spacing-touch` | `ui.layout(header)`, `ui.layout(touch)`     |
| `--z-header/sidebar/drawer/modal/toast`                                         | `--z-index-header/sidebar/drawer/modal/toast`                   | `ui.z(modal)`                               |

Tokens added on top of the mockup (the mockup hard-coded these values): `--color-white`,
`--color-on-danger` (dark: a dark ink, because white on the dark danger red is 2.4:1),
`--color-hero-from/to/muted/subtle/accent/chip` (the hero panel is dark teal in both themes),
`--color-cover-layers/process/clock/building/database/shield` (course cover tints, with dark values),
`--tracking-tight/wide/wider`. Durations drop to `0ms` under `prefers-reduced-motion`.

### Breakpoints

Mobile-first, four steps: `sm` 640px · `md` 720px · `lg` 1100px · `xl` 1280px. The mockup's
`max-width` queries map to the nearest step:

| Mockup query | Step | Notes                                             |
| ------------ | ---- | ------------------------------------------------- |
| ≤ 640        | `sm` | `.hide-sm`, hero padding                          |
| ≤ 720        | `md` | grids collapse, tables → cards, form grid         |
| ≤ 900        | `md` | quiz layout, assignment row (nearest step is 720) |
| ≤ 1000       | `lg` | instructor inbox (nearest step is 1100)           |
| ≤ 1024       | `lg` | sidebar → drawer (nearest step is 1100)           |
| ≤ 1100       | `lg` | dashboard grids, design-system TOC                |

A screen may therefore differ slightly from the mockup between the old and new width; note each
visible difference in the conversion report.

### Mockup helper → helper or mixin

The layout helpers are a closed set in `global/_helpers.scss` (`@layer helpers`), each built from the
mixin a component would use. Everything else in the mockup's `base.css` is a mixin in a component's
`.scss`. Do not add helpers for margins, widths or text: write a BEM class.

| Mockup helper                                  | Port                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.stack` (`--gap`)                             | helper `stack` (gap 4); `stack--gap-<key>` for another spacing key; mixin `ui.stack($gap)`                                                        |
| `.row` / `.row-between`                        | helpers `row` / `row-between` (gap 3, wrap, centred); `row--gap-<key>`; mixins `ui.row`, `ui.row-between`                                         |
| `.grow`                                        | helper `grow`; mixin `ui.grow`                                                                                                                    |
| `.grid-2` / `.grid-3` / `.grid-4`              | helpers `grid-2` (1 → md 2), `grid-3` (1 → md 2 → lg 3), `grid-4` (1 → md 2 → lg 4); `grid-N--gap-<key>`; mixin `ui.grid` for other column counts |
| `.span-2`                                      | helper `span-2` (from `md`)                                                                                                                       |
| `.mt-2/4/6`, `.mb-2/4`, `.w-full`, `.hidden`   | `margin-top: ui.space(4)` etc. in the component's `.scss`                                                                                         |
| `.text-sm/xs/lg`, `.fw-600`, `.fw-700`         | `@include ui.text(sm)`; the weight follows the element's role (`visual-design.md` → Type), not the mockup class                                   |
| `.text-muted/secondary/success/danger/warning` | `@include ui.text(sm, muted)` (tone = colour key or alias), or `color: ui.color(success)`                                                         |
| `.text-accent`                                 | `ui.text(sm, accent)` (the `accent-ink` colour)                                                                                                   |
| `.eyebrow`                                     | dropped: no eyebrows (`visual-design.md`)                                                                                                         |
| `.num`                                         | `@include ui.num`                                                                                                                                 |
| `.mono`                                        | `@include ui.mono`                                                                                                                                |
| `.truncate` / `.clamp-2`                       | `@include ui.truncate` / `@include ui.clamp(2)`                                                                                                   |
| `.sr-only`                                     | helper `sr-only`; mixin `ui.sr-only`                                                                                                              |
| `.animate-enter` / `.animate-reward`           | overlays only: `ui.animate(enter)`; dropped on page content (`visual-design.md`) / `ui.animate(reward-pop)` on an earned achievement              |
| `.skip-link`                                   | helper `skip-link`                                                                                                                                |

### Global stylesheet and cascade layers

`libs/ui/src/styles/global.scss` is the one global entry (the app's `styles` list in `project.json`).
It declares `@layer reset, base, components, helpers;` and loads, in order: the token emission, the
reset (Tailwind's preflight, MIT, attribution kept in the file, so the atoms keep the box model they
were written against), the base rules (headings, links, `kbd`, `:focus-visible`, tabular numbers,
reduced motion), the atom partials and the helpers. Component styles are unlayered, so they win over
every global rule; this is why a helper loses to a component rule on the same element. Two deliberate
deviations from the mockup: the focus ring does not force `border-radius: 4px` (it follows the
element's own radius), and lists keep the reset (no bullets, no indent).

### Style budgets

`anyComponentStyle` stays at 4kb warning and 8kb error. Mixins copy their declarations into each
component, so watch the warnings: a component that exceeds the budget moves its shared rules into a
`@lms/ui` partial or an atom instead of raising the budget.

### What the specs enforce

`template-scan.spec.ts` fails when a template, class binding or class string in the app or the UI
library uses anything but a BEM class some stylesheet defines, a layout helper, or a helper's gap
modifier with a spacing key; when an app template writes a design-system block class; when a `.scss`
outside the token source has a hex or `rgb()` colour; and when anything references Tailwind or
PostCSS. `libs/ui/src/styles/styles.spec.ts` compiles the style library and locks its contract (see the
spec for the list).

## Theme, palettes and dark mode

Two independent choices, remembered per browser:

- **Mode:** **Hệ thống / Sáng / Tối** (`system | light | dark`).
- **Theme** (the `data-palette` attribute): **BIDV chuẩn / Ngọc / Cobalt / Giấy**
  (`bidv | ngoc | cobalt | giay`). `bidv` is the default and is the base tokens themselves.

- **Tokens carry the theme.** `global/_theme.scss` emits the light values and the dark values
  behind two conditions: `:root[data-theme="dark"]`, and `prefers-color-scheme: dark` unless
  `data-theme="light"`. A screen that uses tokens supports every mode and theme with no extra work.
  `system` means no `data-theme` attribute, and `bidv` means no `data-palette` attribute.
- **Components read semantic tokens, so a theme can reach them.** Beyond colours:
  - the sidebar paints only with `nav-*` (`nav-bg`, `nav-text`, `nav-muted`, `nav-strong`,
    `nav-hover`, `nav-active-bg`, `nav-active-text`, `nav-indicator`, `nav-border`); a guard spec
    fails on any other colour or a `color-mix` in `sidebar.scss`;
  - eyebrows (`ui.eyebrow`, `.page-header__eyebrow`) read `eyebrow`;
  - h1–h4 and KPI values read `ui.font(display)`; h1 also reads `ui.weight(display)` and
    `ui.tracking(display)`;
  - buttons and segmented controls read `ui.radius(control)`, text fields `ui.radius(field)`,
    cards and popovers `ui.radius(card)`;
  - `body` paints `ui.texture(page)` sized by `ui.texture(page-size)` over `bg`.

  For BIDV these resolve to the base look, so a new screen gets every theme by using them. Reach
  for `radius(sm|md|lg)` and the raw colours only where a theme should not change the result.

- **Themes are token overrides.** `ui/_tokens.scss` declares `$palettes` (after the type and
  texture tokens it reads). Each theme has:
  - `light` and `dark` maps of `colors`, `chart` and `shadow` (keys in `$palette-color-keys`,
    `$palette-chart-keys`, `$palette-shadow-keys`: brand, neutral, accent, eyebrow, `nav-*`,
    hero, charts 1–2 and grid, shadows);
  - mode-independent `type` (`sans`, `display`, `display-weight`, `display-tracking`), `shape`
    (`control`, `field`, `card`) and `texture` (`page`, `page-size`) groups;
  - an optional `swatch` naming the colour its picker swatch shows (default `primary`).

  Semantic colours, `white`/`black`, `overlay`, spacing, text sizes and layout never change.
  `global/_palettes.scss` emits `:root[data-palette="<id>"]` for the light values and the
  mode-independent groups, and the dark overrides at specificity (0,3,0) behind both dark
  conditions. The build fails on an unknown setting, group or key, a missing `light`/`dark` map,
  a mode-independent group inside a mode, or a light key the dark map leaves out (it would beat
  the base dark value in dark mode). It also declares constant swatch tokens
  (`--color-swatch-<id>-fill/-base`) so a picker can show every theme while another one is active.

- **Fonts.** A theme names faces from `ui.$font-stacks` (Be Vietnam Pro, Fraunces, Nunito Sans),
  all self-hosted through `@fontsource/*` in `apps/lms/project.json` styles; a guard spec fails
  when a stack has no bundled CSS. The browser downloads a file only when an element renders in
  that face, so BIDV users fetch nothing extra. Adding a face is a new dependency: ask first.
- **Contrast is a spec.** `styles.spec.ts` resolves every theme × light/dark from the compiled CSS
  (following `var()` references and compositing `color-mix(…, transparent)` washes) and checks the
  pairs in `SPEC.md` Success Criterion 5:
  - text tokens 4.5:1 on `bg`, `surface` and `surface-2`;
  - `on-primary` on `primary`, `primary` on `surface` and `on-accent` on `accent`, 4.5:1;
  - `eyebrow` and `accent-ink` on `bg` and `surface`, 4.5:1;
  - `nav-text`, `nav-muted` and `nav-strong` on `nav-bg`, and `nav-active-text` on
    `nav-active-bg`, 4.5:1;
  - `border-strong` and `ring` 3:1;
  - `hero-muted` on `hero-to` 4.5:1.

  A new theme must pass before it ships.

- **Nothing else mentions a theme.** Components, templates and SCSS never branch on the mode or
  theme. A spec (`template-scan.spec.ts`) fails on any file other than `ThemeStore` (and the
  pre-boot script) that writes `data-theme` or `data-palette`. Another spec fails when
  `THEME_PALETTES`, the pre-boot script and the token themes list different ids.
- **`ThemeStore`** (`apps/lms/src/app/core/theme/theme.store.ts`, root-provided) owns both choices:
  - selectors `preference$()`, `effective$()` (`light | dark`, following the OS live in
    `system`) and `palette$()`;
  - commands `setPreference()` and `setPalette()`.

  It is the only writer of the attributes. It persists the choices under `lms.theme` (absence =
  `system`) and `lms.palette` (absence = `bidv`; an unknown value, such as a revision 1 id, falls
  back to it) and tolerates blocked storage. Read `effective$()` / `palette$()` when something
  must react to them (the contrast table recomputes from both); never read the attributes.

- **No flash.** An inline script in `apps/lms/src/index.html` applies the stored `light | dark` and
  theme before the app boots. If a strict Content-Security-Policy is introduced, add the script's
  hash to `script-src`. Its logic is not unit-tested: verify in the browser by reloading in each
  theme and mode with the OS theme light and dark and watching the first paint. A theme heading
  face may swap in once its font arrives (`font-display: swap`).
- **The controls** are `app-theme-controls` (`apps/lms/src/app/shared/theme-controls/`): a
  `ui-swatch-group` "Bảng màu" and a `ui-segmented` "Chế độ", both bound to `ThemeStore`.
  - The header renders them in a `uiPopover` behind the palette icon (`app-theme-picker`, "Tùy
    chỉnh giao diện").
  - `/design-system` renders them inline in its table of contents.

  A choice applies at once; the popover stays open so themes can be compared.

## Icons

- One atom, `ui-icon`, wraps `@lucide/angular`; nothing else imports
  `@lucide/angular`. Check the installed package's exports for the current
  component/API before writing the wrapper.
- `libs/ui/src/lib/atoms/icon/icon-registry.ts` maps Lucide kebab-case names to
  imported icon data. `IconName` is `keyof typeof ICONS`, so only registered
  icons bundle and an unknown name fails type-checking. Register a new icon
  there before using it.
- Decorative by default (`aria-hidden="true"`). Passing `label` switches to
  `role="img"` + `aria-label`.
- Sizes `sm | md | lg | xl` map to the mockup's `icon--*` classes; stroke width
  1.75 as in the mockup.
- Mockup icon names → Lucide names: see the icon table in
  `docs/migration/mockup-to-angular.md`.

## Format pipes and the clock

Pure pipes in `libs/ui/src/lib/atoms/format/` port the mockup's `fmt.*` one-for-one, all `vi-VN`,
with `—` for empty values. The `fmt` prefix keeps them from shadowing Angular's `date`. Use them in
templates instead of formatting in components.

| Pipe          | Mockup `fmt.*` | Example output                                           |
| ------------- | -------------- | -------------------------------------------------------- |
| `fmtNum`      | `num`          | `1.234.567` (null → `0`)                                 |
| `fmtPct`      | `pct`          | `72%`                                                    |
| `fmtScore`    | `score`        | `8,6` (null → `—`)                                       |
| `fmtDate`     | `date`         | `05/03/2026`                                             |
| `fmtDatetime` | `datetime`     | `09:07 05/03/2026`                                       |
| `fmtTime`     | `time`         | seconds → `01:05`                                        |
| `fmtMinutes`  | `minutes`      | `45 phút` (< 60), `1g 30p`, `2 giờ`                      |
| `fmtBytes`    | `bytes`        | `512 KB`, `1.5 MB` (above 1 MB)                          |
| `fmtRelative` | `relative`     | `vừa xong`, `5 phút trước`, `3 ngày trước`, then a date  |
| `fmtDaysLeft` | `daysLeft`     | whole days, rounded up, negative once past; `null` empty |

`fmtRelative` and `fmtDaysLeft` read the `NOW` injection token (`() => number`, default `Date.now`)
and never call `Date.now()` themselves. Specs provide `{ provide: NOW, useValue: () => fixed }`.

## Composite widgets and overlays

| Mockup piece                                  | Build on                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `UI.Tabs` (`.tabs`)                           | `@angular/aria` tabs                                                                            |
| `UI.Segmented` (`.segmented`)                 | `@angular/aria` toolbar (toggle buttons) or listbox (single value)                              |
| `ui.menu` (`.menu`), row "more" actions       | `@angular/aria` menu                                                                            |
| Catalog tree (`.tree`)                        | `@angular/aria` tree                                                                            |
| Searchable select / combobox                  | `@angular/aria` combobox                                                                        |
| Accordions in lesson/quiz review              | `@angular/aria` accordion                                                                       |
| `ui.modal`, `ui.confirm` (`.modal`)           | CDK `Dialog`; `ConfirmDialog` organism + a `confirm()` helper returning `Observable<boolean>`   |
| `ui.drawer` (`.drawer`), mobile sidebar       | `uiDrawer` directive on an `<ng-template>` (CDK `Dialog`, busy overlay, `uiDrawerDismiss`)      |
| Form buttons in a drawer footer (Hủy + Lưu)   | `ui-form-actions` molecule: required `formId`, `submitLabel`, `cancelLabel`; extra actions slot |
| `ui.toast` (`.toasts`)                        | `Toaster` service (root, presentation-only) + CDK overlay; text also sent to `LiveAnnouncer`    |
| Tooltip                                       | `uiTooltip` directive on CDK overlay                                                            |
| Non-modal panel under a button (theme picker) | `uiPopover` directive on CDK overlay + CDK focus trap (`@angular/aria` has no popover pattern)  |
| Single choice among colour swatches           | `ui-swatch-group` molecule on the `@angular/aria` listbox (vertical; swatches are token keys)   |
| Wizard stepper (`.stepper`)                   | CDK stepper                                                                                     |
| Sortable lists (`.sort-item`, `.drag-handle`) | CDK drag-drop, with keyboard move buttons                                                       |

**Drawers.** `uiDrawer` opens the template it sits on while its condition is true and
closes it when the condition turns false (even while busy). `uiDrawerBusy` blocks every way the
user can close it and shows the `uiDrawerBusyLabel` overlay; `uiDrawerDismiss` fires only for a
user close, and the page maps it to the store's cancel command. `openDrawer` is internal to
`@lms/ui`: there is no imperative way to show a drawer. `@lms/ui` ships no screen copy, so the
title, busy label and form-actions labels always come from the screen.

**Popovers.** `button[uiPopover]="template"` with a required `popoverLabel` opens the template
in a non-modal `role="dialog"` panel (`ui-popover-panel`, width `ui.layout(popover)`, full width
between the page gutters below `md`), anchored under the button. The button gets `aria-haspopup`,
`aria-expanded` and `aria-controls`. Once rendering settles, focus moves to the first control
inside (`ApplicationRef.whenStable()`, because a listbox sets its roving tabindex in a second pass),
and Tab cycles within the panel. Escape closes it and returns focus to the button; a click outside
closes it. Use it for small settings panels; a menu of actions is `ui-menu`.

Read the installed `@angular/aria` exports before using a pattern; names are
not guessed from memory.

## Done criteria for a UI-library piece

- Lives at its atomic level; imports only lower levels.
- Spec covers rendered classes/ARIA per variant and every output.
- Demo added to the `/design-system` route (the living catalogue, ported from
  the mockup's design-system page) in light and dark.
- Passes the checklist in `docs/conventions/visual-design.md`; the demo shows
  realistic content and density, not showcase filler.
- Keyboard and screen-reader behaviour checked for interactive pieces.
