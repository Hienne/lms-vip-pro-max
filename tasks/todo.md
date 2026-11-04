# Tasks: `ui-polish`

Spec: [SPEC-ui-polish.md](../SPEC-ui-polish.md) · Plan: [plan.md](plan.md).
The previous `course-publish-targets` checklist is in git history at `23b2930`.

Run `nvm use` first. Focused tests: `npx nx test ui`, `npx nx test lms`. Whole gate: `npm run check`.

## Task 1: Token-coloured thin scrollbar app-wide, nav variant on the sidebar

**Description:** Add the scrollbar colour tokens, one inherited rule on `html`, a `ui.scrollbar($tone)` mixin, and
use the nav tone on the sidebar so the dark panel shows one thin, dark-tinted bar.

**Acceptance criteria:**

- [x] `scrollbar-thumb` (from `border-strong`), `scrollbar-thumb-hover` (from `text-muted`), `scrollbar-track`
      (`transparent`) and `nav-scrollbar-thumb` (`white` ~24% over transparent) exist in light and dark;
      `nav-scrollbar-thumb` is in `$palette-color-keys` and set from `text` in `cobalt` and `giay` (light and dark).
- [x] `html` has `scrollbar-color: thumb track; scrollbar-width: thin` in `@layer base`; `ui.scrollbar(nav)` is used
      on the sidebar; tabs keep `scrollbar-width: none`.
- [x] The sidebar shows a single scroll area (`.sidebar__nav`), or the outer one keeps `auto` with the nav tone if
      the fixed parts do not fit a 600px-tall viewport (decision: at a 600px-tall viewport the brand, role and footer leave the nav 357px and the outer sidebar never overflows, so `app-shell__sidebar` is `overflow: hidden` and only `.sidebar__nav` scrolls, with the nav tone).

**Verification:**

- [x] `npx nx test ui` (guard: no colour literal outside tokens; palette keys complete)
- [x] Browser (Checkpoint A): computed `scrollbar-color` on `html` and `.sidebar__nav` in bidv and cobalt, light and dark

**Dependencies:** None

**Files likely touched:** `libs/ui/src/styles/ui/_tokens.scss`, `libs/ui/src/styles/ui/_mixins.scss`,
`libs/ui/src/styles/global/_base.scss`, `apps/lms/src/app/layout/sidebar/sidebar.scss`,
`apps/lms/src/app/layout/shell/app-shell.scss`

**Estimated scope:** M

## Task 2: Stepper of numbered steps joined by connectors

**Description:** Restyle `ui-stepper`: no card per step; circle, then title over subtitle; a 1px connector after each
step but the last, primary after a done step; vertical below `md`. Behaviour and API unchanged.

**Acceptance criteria:**

- [x] `.stepper__item` carries `is-done` for done steps; its `::after` connector is `primary`, otherwise `border`;
      the last item has none; connector minimum length `ui.space(4)`.
- [x] Circles: pending `surface-2`/`text-secondary`, current `primary`/`on-primary`, done `primary-subtle`/`primary`
      with the check; no border, background or shadow on the step; titles wrap, never truncate.
- [x] Below `md`: vertical list with a vertical connector; keyboard, `aria-current`, "Đã hoàn thành", `linear`
      unchanged.

**Verification:**

- [x] `npx nx test ui` (new cases: `is-done` on items before the current one, none on the last connector's item
      logic, existing a11y cases still green)
- [x] Browser: course editor steps 1 and 2 at 1280, 1024 and 375px, light and dark (step 4 uses the same markup; design-system page not opened)

**Dependencies:** None

**Files likely touched:** `libs/ui/src/styles/components/_stepper.scss`,
`libs/ui/src/lib/organisms/stepper/stepper.html`, `libs/ui/src/lib/organisms/stepper/stepper.spec.ts`

**Estimated scope:** S

## Checkpoint A

- [x] `npx nx test ui` (517) and `npx nx test lms` (1698) green
- [x] Browser checks (built-in pane, `lms` on :4201 with `mockBackend: true` set locally, not committed):
  - `html` computed `scrollbar-color` is `border-strong` over transparent with `scrollbar-width: thin` (light `rgb(138,150,148)`, dark `rgb(92,110,107)`); `.sidebar__nav` carries the nav thumb (white 24% in bidv, `text` 24% in cobalt light and dark); outer sidebar is `overflow: hidden`.
  - Stepper at 1280 (light and dark), 1024 and 375: one row with connectors, primary up to the current step (`rgb(0,107,104)`), grey after; vertical list with a vertical connector at 375; done circle `primary-subtle` with the check. Cobalt (light sidebar) checked in both modes.
  - Two refinements found in the browser and made: the pending connector uses `border-strong` (the spec's `border` is `#e3eae9`, invisible on the page background; flagged for the user), and the step text is capped at `22ch` from `md` so long subtitles wrap and leave the connectors about 46px at 1024.
  - macOS hides overlay scrollbars, so the drawn bar was not seen; Windows was not checked.
- [ ] User accepts the stepper look and the `bar` z key (the user accepted both in principle; not stopped on)

## Task 3: `ShellInsets` + `appBottomBar`; the owl rises by the inset

**Description:** A root `ShellInsets` service with a `bottom` signal, an `appBottomBar` directive that writes its
host's height there while mounted, and the owl adding that inset to its `bottom`.

**Acceptance criteria:**

- [x] The directive sets `ShellInsets.bottom` to the host's border-box height (ResizeObserver) and back to 0 on
      destroy, disconnecting the observer.
- [x] `app-owl` binds `--owl-inset` from the signal; `owl.scss` uses `bottom: calc(ui.space(4) + var(--owl-inset, 0px))`
      on the host, so both placements (`--beside-toolbar` only moves `right`) rise.
- [x] With no bar mounted, the owl's position is unchanged.

**Verification:**

- [x] `npx nx test lms` (new `shell-insets.spec.ts`; `owl.spec.ts` case for the inset style)

**Dependencies:** None

**Files likely touched:** `apps/lms/src/app/layout/shell-insets.ts` (new), `apps/lms/src/app/layout/shell-insets.spec.ts`
(new), `apps/lms/src/app/layout/owl/owl.ts`, `apps/lms/src/app/layout/owl/owl.scss`,
`apps/lms/src/app/layout/owl/owl.spec.ts`

**Estimated scope:** M

## Task 4: Course-editor footer pinned to the viewport bottom

**Description:** Make `.course-editor__foot` sticky at the bottom with a surface fill and a 1px top border, register
it with `appBottomBar`, and keep focused fields clear of it.

**Acceptance criteria:**

- [x] New stacking key `bar: 20` in `$z-indexes`; the footer is `position: sticky; bottom: 0; z-index: ui.z(bar)`,
      `surface` fill, 1px top `border`, `padding-block: ui.space(3)`, no shadow; same buttons and order in create and
      edit mode.
- [x] The footer has `appBottomBar`; the owl sits above it; the lesson drawer and dialogs cover it.
- [x] Tab to any field scrolls it into view above the bar (`scroll-margin-bottom` on the form's controls, or
      `scroll-padding-bottom` while the editor is mounted).

**Verification:**

- [x] `npx nx test lms` (`course-editor.spec.ts`: the footer carries the directive in both modes)
- [x] Browser: step 2 with a long outline at 1280/375, light/dark; scroll, Tab to the last field, open the drawer

**Dependencies:** Task 3

**Files likely touched:** `libs/ui/src/styles/ui/_tokens.scss`,
`apps/lms/src/app/features/admin-content/course-editor/course-editor.html`,
`apps/lms/src/app/features/admin-content/course-editor/course-editor.scss`,
`apps/lms/src/app/features/admin-content/course-editor/course-editor.ts`,
`apps/lms/src/app/features/admin-content/course-editor/course-editor.spec.ts`

**Estimated scope:** M

## Checkpoint B

- [ ] `npm run check` green
- [ ] Browser checks of Tasks 1–4 together, screenshots in the report
- [ ] angular.md §14 and visual-design.md checklists pass

## Task 5: Docs and spec status

**Description:** Record the new stepper and the scrollbar mixin in the UI library doc, amend the spec (owl only,
`bar` z key, themes in `_tokens.scss`) and mark it built.

**Acceptance criteria:**

- [ ] `docs/conventions/ui-library.md`: stepper row describes connectors; `ui.scrollbar` listed with the mixins;
      `ShellInsets`/`appBottomBar` noted where layout pieces are listed, if such a list exists.
- [ ] `SPEC-ui-polish.md` status "built", amendments listed; results of both checkpoints recorded here.

**Verification:**

- [ ] `npm run check` (format)

**Dependencies:** Tasks 1–4

**Files likely touched:** `docs/conventions/ui-library.md`, `SPEC-ui-polish.md`, `tasks/todo.md`

**Estimated scope:** S
