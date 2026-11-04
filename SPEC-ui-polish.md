# Spec: `ui-polish`

Status: **approved 2026-11-04; planned in `tasks/plan.md` (amendments there).** Depends on nothing. Three small UI changes, one spec: each is
a few files and they share the same checks, so no capability map.

## Objective

Three things in the admin course wizard (and, for the scrollbar, the whole app) look like browser defaults or
make the user hunt for the next action:

1. **Scrollbar.** Scroll areas show the browser's default bar: on Windows a light grey bar with arrow buttons and a
   white track, which is loud on the dark sidebar. Every scroll area gets a thin bar coloured from the tokens.
2. **Stepper.** The four wizard steps are four separate cards with nothing linking them, so they read as tabs, not
   as a sequence. They become one line of numbered steps joined by connectors that show how far the user is.
3. **Footer.** On a long step ("Nội dung khóa học" with many lessons) "Lưu nháp", "Tiếp tục" and "Xuất bản khóa
   học" are below the fold. The footer stays pinned to the bottom of the viewport.

Users: admins and instructors creating or editing a course (`/admin/courses/new`, `/admin/courses/:id/edit`;
one component, `course-editor`, serves both). The scrollbar change reaches every user.

## Decisions (agreed 2026-11-04)

| Topic         | Decision                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Scrollbar     | App-wide, one rule in the `ui` library; a variant for the dark nav panel                              |
| Stepper style | No cards: number circle + title/subtitle, joined by a 1px connector; vertical below `md`             |
| Owl collision | The owl (and the chat launcher, same corner) rises above the pinned footer while the footer is shown |

## Requirements

### 1. Scrollbar (`libs/ui`)

- New colour tokens in `$colors` (light) and `$colors-dark` (only if the alias does not already follow the mode),
  emitted like the others:
  - `scrollbar-thumb`: from `border-strong`; `scrollbar-thumb-hover`: from `text-muted`;
    `scrollbar-track`: `transparent`.
  - `nav-scrollbar-thumb`: a `color-mix` of `white` over `nav-bg`, like `nav-hover` (about 24%), so themes with a
    light sidebar get a dark thumb from their own nav tokens. Each theme in `_palettes.scss` that overrides the
    `nav-*` tokens gets a value where the default does not fit.
- `@layer base` in `_base.scss`: `html { scrollbar-color: thumb track; scrollbar-width: thin; }`. Both properties
  inherit, so every `overflow: auto` area (drawer, dialog, popover, chat panel, transcript, org picker…) follows
  without per-file edits. Thin bars on Windows Chrome have no arrow buttons.
- A `ui.scrollbar($tone: default | nav)` mixin for areas that need the nav colours or a hover thumb; the sidebar
  (`app-shell__sidebar` and `sidebar__nav`) uses `nav`.
- Only the standard `scrollbar-color` / `scrollbar-width` properties. No `::-webkit-scrollbar` rules: Chrome ≥ 121,
  Edge and Firefox support the standard ones; Safari keeps its native overlay bar.
- `_tabs.scss` keeps `scrollbar-width: none`.
- Only one scroll area in the sidebar: if the shell's `__sidebar` and the sidebar's `__nav` both scroll today,
  the outer one stops (`overflow: hidden`), so the dark panel never shows two bars.

### 2. Stepper (`libs/ui` organism `ui-stepper`, `_stepper.scss`)

Layout from `md` up (one row):

```text
(✓) Thông tin cơ bản  ━━━━━━━━  (2) Nội dung khóa học  ────────  (3) Bài thi & điều kiện  ────────  (4) Đối tượng & xuất bản
    Tên, mã, chương trình           Chương, bài, khối nội dung       Điều kiện hoàn thành, …              Kiểm tra trước khi xuất bản
```

- No border, background or shadow on a step. Each step is the circle, then the title over the subtitle; the
  connector takes the rest of the item's width and sits on the circle's centre line. The last step has no
  connector.
- Connector: 1px (`border-width`, no new token), `ui.color(border)` by default; `ui.color(primary)` when the
  step **before** it is done (so the line up to the current step is primary).
- Circle (28px, as today): pending `surface-2` + `text-secondary`; current `primary` + `on-primary`; done
  `primary-subtle` + `primary` with the check. Deliberate change from today's `success-subtle`: teal means
  selection and progress here, green stays for results.
- Title `text`, current title semibold; subtitle `text-muted` `xs`, may wrap to two lines; titles do not
  truncate (diacritics never clip).
- Below `md`: a vertical list; the connector is a vertical 1px line from under one circle to the next.
- Hover on a navigable step: title underline or `surface-2` behind the step's button only; `aria-disabled`
  steps keep `opacity: 0.6` and `not-allowed`.
- Unchanged: the CDK stepper behaviour, `aria-current="step"`, the "Đã hoàn thành" `sr-only` text, roving
  tabindex and arrow keys, the `StepperItem` API and the inputs. Connectors are `aria-hidden` (CSS pseudo-elements
  or an `aria-hidden` span). The focus ring follows the button.
- The design-system page (`nav-section`) renders the new stepper with no edit beyond its copy if any.

### 3. Pinned footer (`course-editor`)

- `.course-editor__foot` becomes `position: sticky; bottom: 0` inside the page column, so it stays at the
  bottom of the viewport while the page scrolls and rests in place at the end of the form. Same markup, same
  buttons, same order; applies in create and edit mode, on every step.
- Look: `ui.color(surface)` fill across the page column, 1px top `border`, `padding-block: ui.space(3)`, no
  shadow (flat, visual-design.md). `z-index` from `ui.z()` below the header, drawer and dialogs; the lesson drawer
  still covers it.
- The last content of the form is never hidden behind the bar at the end of the page, and a field focused with
  Tab scrolls into view above it (`scroll-padding-bottom` or `scroll-margin-bottom` of the bar's height).
- At 375px the buttons wrap as they do today; the bar's height may grow, the rules above still hold.
- **Owl and chat launcher:** a root service in `apps/lms/src/app/layout` (`ShellInsets`, a `bottom` signal in px)
  and a directive (`appBottomBar`) on the footer that reports its height with a `ResizeObserver` while mounted
  and resets it on destroy. `app-owl` and `app-chat-widget` add that inset to their `bottom`. With no bar
  (every other page) nothing moves.

## Commands

```bash
nvm use
```

```bash
npx nx test ui
```

```bash
npx nx test lms
```

```bash
npm run check
```

Browser: `preview_start` with `lms` (or `lms-local-backend`), then `/admin/courses/new` and
`/admin/courses/:id/edit`.

## Project structure (files expected to change)

```text
libs/ui/src/styles/ui/_tokens.scss          scrollbar tokens
libs/ui/src/styles/ui/_mixins.scss          ui.scrollbar mixin
libs/ui/src/styles/global/_base.scss        html scrollbar-color / -width
libs/ui/src/styles/global/_palettes.scss    nav thumb per theme where needed
libs/ui/src/styles/components/_stepper.scss new stepper look
libs/ui/src/lib/organisms/stepper/*         connector markup if not a pseudo-element; spec
apps/lms/src/app/layout/shell|sidebar/*.scss sidebar scrollbar, one scroll area
apps/lms/src/app/layout/shell-insets.ts     new: ShellInsets service + appBottomBar directive (+ spec)
apps/lms/src/app/layout/owl|chat-widget/*    bottom inset
apps/lms/src/app/features/admin-content/course-editor/course-editor.{html,scss,spec.ts}
docs/conventions/ui-library.md               stepper row and scrollbar mixin
```

## Code style

Tokens through the `ui` module only, BEM classes as in `_stepper.scss`, signals for state:

```scss
.stepper__item:not(:last-child)::after {
  content: '';
  flex: 1 1 auto;
  border-top: 1px solid ui.color(border);
}
.stepper__item.is-done:not(:last-child)::after {
  border-top-color: ui.color(primary);
}
```

```ts
@Injectable({ providedIn: 'root' })
export class ShellInsets {
  readonly bottom = signal(0);
}
```

## Testing strategy

- `stepper.spec.ts`: a done step's item carries the done state (so its connector is primary), the current step
  keeps `aria-current="step"`, the last item has no connector, connectors are not in the accessibility tree,
  arrow keys and `linear` still work.
- `styles.spec.ts` (guard): no colour literal outside the token source; the new tokens exist in light and dark.
- `shell-insets` spec: the directive sets the inset to the element's height and resets it to 0 on destroy;
  `owl.spec.ts` / chat widget spec: the inset moves the host's `bottom`.
- `course-editor.spec.ts`: the footer has the bottom-bar directive in create and edit mode.
- Browser (built-in pane), 1280 and 375px, light and dark, one alternate theme with a light sidebar:
  - computed `scrollbar-color` on `html` and the sidebar nav; the sidebar shows one bar;
  - stepper on steps 1, 2 and 4: connectors primary up to the current step, vertical at 375px;
  - on step 2 with a long outline: the footer stays at the viewport bottom while scrolling, the owl sits above
    it, the drawer covers it, Tab to the last field is not hidden;
  - screenshots of each, in the report.
- macOS hides overlay scrollbars, so the visible bar is checked via computed styles plus one screenshot with
  "Show scroll bars: Always" if the user can switch it; Windows is not checked here (stated in the report).

## Boundaries

- **Always:** tokens only; `npm run check` green; visual-design.md checklist at 1280/375 light/dark; keep the
  stepper's API and a11y; update `docs/conventions/ui-library.md` for the stepper and the mixin.
- **Ask first:** a new dependency; a new token family beyond the four colours above; changing the footer's
  buttons or copy; moving other pages' footers to sticky.
- **Never:** `::-webkit-scrollbar` hacks; colour literals outside `_tokens.scss` / `_palettes.scss`; a shadow,
  gradient or coloured edge on the bar or the stepper; changing business logic of the wizard.

## Success criteria

1. Every scroll area in the app uses the thin token-coloured bar; the sidebar's bar is the nav variant and there
   is only one; Windows shows no arrow buttons (thin bar).
2. The stepper shows four steps on one row joined by connectors, primary up to the current step, grey after;
   no step is a card; at 375px it is a vertical list with a vertical connector.
3. On `/admin/courses/new` and `/admin/courses/:id/edit`, at any scroll position, the footer is at the bottom of
   the viewport and its buttons work; the owl and chat launcher sit above it; nothing is hidden behind it.
4. Keyboard and screen-reader behaviour of the stepper is unchanged (specs pass).
5. `npm run check` green; the angular.md §14 and visual-design.md checklists pass and are reported.

## Open questions

None blocking. The plan step confirms whether `primary-subtle` exists in every theme and whether the shell's
sidebar or the nav is the one that scrolls today.
