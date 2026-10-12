# UI library (`@lms/ui`): atomic, directive-first

Rules for every reusable piece of UI: the design system in `libs/ui`, and the
domain-aware presentational UI in `apps/lms/src/app/shared/` that composes it.

## Atomic levels

| Level     | What it is                                                                 | Lives in                            | May use                                       |
| --------- | -------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------- |
| Tokens    | CSS custom properties: color, type, space, radius, shadow, motion, z-index | `libs/ui/src/styles/`               | —                                             |
| Atom      | One native element with a look or a behaviour                              | `libs/ui/src/lib/atoms/<name>/`     | tokens                                        |
| Molecule  | A few atoms doing one job (label + control + error)                        | `libs/ui/src/lib/molecules/<name>/` | atoms                                         |
| Organism  | A self-contained section (data table, page header, dialog shell, chart)    | `libs/ui/src/lib/organisms/<name>/` | molecules, atoms                              |
| Domain UI | Organism/molecule that knows LMS types (course card, role badge)           | `apps/lms/src/app/shared/<name>/`   | anything in `@lms/ui`, `@lms/contracts` types |
| Template  | Page layout with slots (app shell, focus layout)                           | `apps/lms/src/app/layout/`          | all of the above                              |
| Page      | Route module                                                               | `apps/lms/src/app/features/`        | all of the above                              |

Imports point **down** the table only. An atom importing a molecule, or
`libs/ui` mentioning `Course`, is a level violation: move the piece to the
level where its dependencies live.

One deliberate exception: an atom that is a specialisation of a sibling atom may compose it
(`ui-mai-badge` and `ui-ring` use `ui-mai`, `ui-avatar-group` wraps `ui-avatar`s). A molecule or
organism never imports upward.

Class names that Tailwind also uses as utilities cannot be block names: the mockup's `.ring`
is `.progress-ring` here, because Tailwind's `ring` utility would draw a border on it
(`table` is harmless, both mean `display: table`).

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
   `ui-page-header`).
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

- **Tokens are the single source of truth.** `libs/ui/src/styles/theme.css`
  ports `lms-mockup/assets/css/tokens.css`: light values inside
  `@theme static { … }`, dark values in the same `:root[data-theme="dark"]` and
  `prefers-color-scheme` blocks as the mockup. Every token has **one** name,
  taken from a Tailwind v4 namespace, so utilities (`bg-primary`,
  `text-text-muted`, `p-4`, `rounded-lg`, `fill-chart-1`) and SCSS
  (`var(--color-primary)`) read the same variable. The mockup's names do **not**
  all match Tailwind's namespaces; use the table below to translate.
- The theme starts with `--*: initial;`, which removes Tailwind's whole default
  theme (palette, spacing, font sizes, breakpoints…): `bg-red-500` and `p-7`
  simply produce nothing. `static` keeps every token emitted even when no
  utility uses it, because component SCSS reads them via `var()`.
- Spacing utilities use the mockup's 4px steps only: 1, 2, 3, 4, 5, 6, 8, 10, 12, 18
  (`--spacing-N`, no base `--spacing` multiplier, so `p-7` is not a class).
  Arbitrary values (`p-[13px]`, `text-[#fff]`) are out.

### Mockup token → project token

| Mockup (`tokens.css`)                                                           | Project token                                                   | Utility examples                                 |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `--color-*` (brand, semantic, neutral)                                          | unchanged                                                       | `bg-primary`, `text-text-muted`, `border-border` |
| `--chart-1` … `--chart-5`, `--chart-grid`                                       | `--color-chart-1` … `--color-chart-grid`                        | `fill-chart-1`, `stroke-chart-grid`              |
| `--font-sans`, `--font-mono`                                                    | unchanged                                                       | `font-sans`, `font-mono`                         |
| `--text-xs` … `--text-3xl`                                                      | unchanged                                                       | `text-sm`, `text-2xl`                            |
| `--leading-tight/normal/relaxed`                                                | unchanged                                                       | `leading-tight`                                  |
| `--weight-regular/medium/semibold/bold`                                         | `--font-weight-regular/medium/semibold/bold`                    | `font-semibold`                                  |
| `--space-1` … `--space-12`                                                      | `--spacing-1` … `--spacing-12`                                  | `p-4`, `gap-3`, `mt-6`                           |
| `--radius-*`, `--shadow-*`                                                      | unchanged                                                       | `rounded-lg`, `shadow-md`                        |
| `--duration-fast/base/slow`                                                     | `--transition-duration-fast/base/slow`                          | `duration-fast`                                  |
| `--ease-out`                                                                    | unchanged                                                       | `ease-out`                                       |
| `@keyframes enter/reward-pop/shimmer/spin`, `.animate-enter`, `.animate-reward` | `--animate-enter/reward-pop/shimmer/spin`                       | `animate-enter`, `animate-reward-pop`            |
| `--sidebar-width`, `--content-max`                                              | `--container-sidebar`, `--container-content`                    | `w-sidebar`, `max-w-content`                     |
| `--header-height`, `--control-height(-sm)`, `--touch-min`                       | `--spacing-header`, `--spacing-control(-sm)`, `--spacing-touch` | `h-header`, `min-h-control`, `min-h-touch`       |
| `--z-header/sidebar/drawer/modal/toast`                                         | `--z-index-header/sidebar/drawer/modal/toast`                   | `z-header` (or `var(--z-index-modal)`)           |

Tokens added on top of the mockup (the mockup hard-coded these values): `--color-white`,
`--color-on-danger` (dark: a dark ink, because white on the dark danger red is 2.4:1),
`--color-hero-from/to/muted/subtle/accent/chip` (the hero panel is dark teal in both themes),
`--tracking-tight/wide/wider`. Durations drop to `0ms` under `prefers-reduced-motion`.

### Breakpoints

Mobile-first, four steps: `sm` 640px · `md` 720px · `lg` 1100px · `xl` 1280px.
Write the narrow layout as the base style and add `md:`, `lg:`… utilities; there
are no `max-*` queries. The mockup's `max-width` queries map to the nearest step:

| Mockup query | Step | Notes                                             |
| ------------ | ---- | ------------------------------------------------- |
| ≤ 640        | `sm` | `.hide-sm`, hero padding                          |
| ≤ 720        | `md` | grids collapse, tables → cards, form grid         |
| ≤ 900        | `md` | quiz layout, assignment row (nearest step is 720) |
| ≤ 1000       | `lg` | instructor inbox (nearest step is 1100)           |
| ≤ 1024       | `lg` | sidebar → drawer (nearest step is 1100)           |
| ≤ 1100       | `lg` | dashboard grids, design-system TOC                |

A screen may therefore differ slightly from the mockup between the old and new
width; note each visible difference in the conversion report. SCSS media queries
cannot read custom properties: write the literal width and comment the step it equals.

### Mockup helper → Tailwind utility

The mockup's `base.css` helpers are not ported. Use the utility on the right.

| Mockup helper                                  | Tailwind                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `.stack` (`--gap`)                             | `flex flex-col gap-4` (gap from the 4px scale)                                                            |
| `.row` / `.row-between`                        | `flex flex-wrap items-center gap-3` / add `justify-between`                                               |
| `.grow`                                        | `grow min-w-0`                                                                                            |
| `.grid-2` / `.grid-3` / `.grid-4`              | `grid grid-cols-1 md:grid-cols-2` · `… md:grid-cols-2 lg:grid-cols-3` · `… md:grid-cols-2 lg:grid-cols-4` |
| `.span-2`                                      | `md:col-span-2`                                                                                           |
| `.mt-2/4/6`, `.mb-2/4`, `.w-full`, `.hidden`   | same names                                                                                                |
| `.text-sm/xs/lg`, `.fw-600`, `.fw-700`         | `text-sm/xs/lg`, `font-semibold`, `font-bold`                                                             |
| `.text-muted/secondary/success/danger/warning` | `text-text-muted`, `text-text-secondary`, `text-success`, …                                               |
| `.text-accent`                                 | `text-accent-ink`                                                                                         |
| `.eyebrow`                                     | `text-xs font-semibold tracking-wider text-text-muted uppercase`                                          |
| `.num`                                         | `tabular-nums`                                                                                            |
| `.mono`                                        | `font-mono text-sm`                                                                                       |
| `.truncate` / `.clamp-2`                       | `truncate` / `line-clamp-2`                                                                               |
| `.sr-only`                                     | `sr-only`                                                                                                 |
| `.animate-enter` / `.animate-reward`           | `animate-enter` / `animate-reward-pop`                                                                    |
| `.skip-link`                                   | `skip-link` (kept in `base.css`)                                                                          |

Base rules that differ from Tailwind's preflight (headings, links, `kbd`,
`:focus-visible`, skip link, tabular numbers in tables, reduced motion) live in
`libs/ui/src/styles/base.css`. Two deliberate deviations from the mockup: the
focus ring does not force `border-radius: 4px` (it follows the element's own
radius), and lists keep preflight's reset (use `list-disc pl-5` for prose lists).

- **Atom look = one SCSS partial per BEM block**, ported from the mockup's
  `components.css` into `libs/ui/src/styles/components/_<block>.scss`, wrapped in
  `@layer components`, and applied only by the owning atom's `host` class.
  Templates outside `libs/ui` never write block classes (`class="btn btn--primary"`);
  they use the atom.
- **Layout and spacing in templates = Tailwind utilities.** The mockup's
  `base.css` helpers (`row`, `stack`, `grid-4`, `mt-4`, `text-sm`) become their
  Tailwind equivalents. Route-specific styles from `pages.css` go to the route
  component's `.scss` using `var(--token)`.
- Runtime values go through a CSS variable binding (`[style.--value]="pct() + '%'"`),
  never an inline literal. Inline `style="color:#fff"` in mockup markup becomes a
  token (`text-on-primary`).
- Dark mode comes from tokens only: see [Theme and dark mode](#theme-and-dark-mode).

### Tailwind + SCSS wiring (gotchas)

- Tailwind v4 cannot run through Sass. The Tailwind entry is plain CSS:
  `apps/lms/src/tailwind.css`, configured by `.postcssrc.json` at the root.
- It imports Tailwind with `source(none)` and lists template folders with
  `@source`; automatic detection would scan `lms-mockup/` too. A new folder of
  templates outside `apps/lms/src` and `libs/ui/src` needs its own `@source` line.
- Global styles order in the `lms` build: `tailwind.css` first (it declares the
  layer order `theme, base, components, utilities`), then
  `libs/ui/src/styles/components.scss`. Unlayered global CSS would outrank every
  utility, so every global rule sits inside a layer.
- Component `.scss` files use `var(--token)`. Use `@apply` only after
  `@reference "<path>/tailwind.css";`, and prefer utilities in the template.

## Theme and dark mode

Three choices, **Hệ thống / Sáng / Tối** (`system | light | dark`), remembered per browser.

- **Tokens carry the theme.** `theme.css` holds the light values and the dark values behind two
  conditions: `:root[data-theme="dark"]`, and `prefers-color-scheme: dark` unless
  `data-theme="light"`. A screen that uses tokens supports both themes with no extra work.
  `system` means no attribute at all.
- **Nothing else mentions a theme.** Components, templates and SCSS never branch on the theme, and
  never write `dark:` utilities. The variant exists in the theme (matching the same two conditions)
  only so a stray one is not silently ignored; a spec (`template-scan.spec.ts`) fails on any
  `dark:` in a template or component file, and on any file other than `ThemeStore` that writes the
  `data-theme` attribute.
- **`ThemeStore`** (`apps/lms/src/app/core/theme/theme.store.ts`, root-provided) owns the choice:
  `preference$()`, `effective$()` (`light | dark`, following the OS live in `system`) and one
  command, `setPreference()`. It is the only writer of the attribute, persists the choice under
  `lms.theme` (absence = `system`) and tolerates blocked storage. Read `effective$()` when something
  must react to the theme (the contrast table recomputes from it); never read the attribute.
- **No flash.** An inline script in `apps/lms/src/index.html` applies the stored `light | dark`
  before the app boots. If a strict Content-Security-Policy is introduced, add the script's hash to
  `script-src`. It is not unit-tested: verify in the browser by reloading in each of the three
  choices with the OS theme light and dark and watching the first paint.
- **The control** is `ui-segmented` (a molecule on the `@angular/aria` listbox, one selected
  option, arrow keys move and select, `value` is a two-way model). `/design-system` has the switch
  in its table of contents; the app header will reuse the same store and control.

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

## Composite widgets and overlays

| Mockup piece                                  | Build on                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `UI.Tabs` (`.tabs`)                           | `@angular/aria` tabs                                                                          |
| `UI.Segmented` (`.segmented`)                 | `@angular/aria` toolbar (toggle buttons) or listbox (single value)                            |
| `ui.menu` (`.menu`), row "more" actions       | `@angular/aria` menu                                                                          |
| Catalog tree (`.tree`)                        | `@angular/aria` tree                                                                          |
| Searchable select / combobox                  | `@angular/aria` combobox                                                                      |
| Accordions in lesson/quiz review              | `@angular/aria` accordion                                                                     |
| `ui.modal`, `ui.confirm` (`.modal`)           | CDK `Dialog`; `ConfirmDialog` organism + a `confirm()` helper returning `Observable<boolean>` |
| `ui.drawer` (`.drawer`), mobile sidebar       | CDK `Dialog` with side-panel position                                                         |
| `ui.toast` (`.toasts`)                        | `Toaster` service (root, presentation-only) + CDK overlay; text also sent to `LiveAnnouncer`  |
| Tooltip                                       | `uiTooltip` directive on CDK overlay                                                          |
| Wizard stepper (`.stepper`)                   | CDK stepper                                                                                   |
| Sortable lists (`.sort-item`, `.drag-handle`) | CDK drag-drop, with keyboard move buttons                                                     |

Read the installed `@angular/aria` exports before using a pattern; names are
not guessed from memory.

## Done criteria for a UI-library piece

- Lives at its atomic level; imports only lower levels.
- Spec covers rendered classes/ARIA per variant and every output.
- Demo added to the `/design-system` route (the living catalogue, ported from
  the mockup's design-system page) in light and dark.
- Keyboard and screen-reader behaviour checked for interactive pieces.
