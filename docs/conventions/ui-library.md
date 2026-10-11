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
sets `aria-label` and the tooltip, so an unnamed icon button does not compile.

## Styling

- **Tokens are the single source of truth.** `libs/ui/src/styles/theme.css`
  ports `lms-mockup/assets/css/tokens.css`: light values inside
  `@theme static { … }`, dark values in the same `:root[data-theme="dark"]` and
  `prefers-color-scheme` blocks as the mockup. The mockup's token names already
  match Tailwind v4 namespaces (`--color-*`, `--text-*`, `--radius-*`,
  `--shadow-*`, `--font-*`, `--ease-*`), so utilities like `bg-primary`,
  `text-text-muted`, `rounded-lg` resolve to project tokens.
- The theme starts with `--color-*: initial;` so Tailwind's default palette does
  not exist: `bg-red-500` simply produces nothing. `static` keeps every token
  emitted even when no utility uses it, because component SCSS reads them via
  `var()`.
- Spacing utilities use the 4px scale (`--spacing: 4px`): use steps
  1, 2, 3, 4, 5, 6, 8, 10, 12, matching `--space-*`. Arbitrary values
  (`p-[13px]`, `text-[#fff]`) are out.
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
- Dark mode comes from tokens only. Nothing outside `theme.css` mentions a theme.

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
