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
      the fixed parts do not fit a 600px-tall viewport (decision recorded here: the outer `app-shell__sidebar` keeps `overflow-y: auto` with the nav tone; whether it overflows is checked at Checkpoint A).

**Verification:**

- [x] `npx nx test ui` (guard: no colour literal outside tokens; palette keys complete)
- [ ] Browser (at Checkpoint A): computed `scrollbar-color` on `html` and `.sidebar__nav` in bidv and cobalt, light and dark

**Dependencies:** None

**Files likely touched:** `libs/ui/src/styles/ui/_tokens.scss`, `libs/ui/src/styles/ui/_mixins.scss`,
`libs/ui/src/styles/global/_base.scss`, `apps/lms/src/app/layout/sidebar/sidebar.scss`,
`apps/lms/src/app/layout/shell/app-shell.scss`

**Estimated scope:** M

## Task 2: Stepper of numbered steps joined by connectors

**Description:** Restyle `ui-stepper`: no card per step; circle, then title over subtitle; a 1px connector after each
step but the last, primary after a done step; vertical below `md`. Behaviour and API unchanged.

**Acceptance criteria:**

- [ ] `.stepper__item` carries `is-done` for done steps; its `::after` connector is `primary`, otherwise `border`;
      the last item has none; connector minimum length `ui.space(4)`.
- [ ] Circles: pending `surface-2`/`text-secondary`, current `primary`/`on-primary`, done `primary-subtle`/`primary`
      with the check; no border, background or shadow on the step; titles wrap, never truncate.
- [ ] Below `md`: vertical list with a vertical connector; keyboard, `aria-current`, "Đã hoàn thành", `linear`
      unchanged.

**Verification:**

- [ ] `npx nx test ui` (new cases: `is-done` on items before the current one, none on the last connector's item
      logic, existing a11y cases still green)
- [ ] Browser: course editor steps 1, 2, 4 at 1280, 1024 and 375px, light and dark; design-system page

**Dependencies:** None

**Files likely touched:** `libs/ui/src/styles/components/_stepper.scss`,
`libs/ui/src/lib/organisms/stepper/stepper.html`, `libs/ui/src/lib/organisms/stepper/stepper.spec.ts`

**Estimated scope:** S

## Checkpoint A

- [ ] `npx nx test ui` and `npx nx test lms` green
- [ ] Screenshots of scrollbar and stepper (1280/375, light/dark)
- [ ] User accepts the stepper look and the `bar` z key before Phase 2

## Task 3: `ShellInsets` + `appBottomBar`; the owl rises by the inset

**Description:** A root `ShellInsets` service with a `bottom` signal, an `appBottomBar` directive that writes its
host's height there while mounted, and the owl adding that inset to its `bottom`.

**Acceptance criteria:**

- [ ] The directive sets `ShellInsets.bottom` to the host's border-box height (ResizeObserver) and back to 0 on
      destroy, disconnecting the observer.
- [ ] `app-owl` binds `--owl-inset` from the signal; `owl.scss` uses `bottom: calc(ui.space(4) + var(--owl-inset, 0px))`
      in both its default and `--beside-toolbar` placements.
- [ ] With no bar mounted, the owl's position is unchanged.

**Verification:**

- [ ] `npx nx test lms` (new `shell-insets.spec.ts`; `owl.spec.ts` case for the inset style)

**Dependencies:** None

**Files likely touched:** `apps/lms/src/app/layout/shell-insets.ts` (new), `apps/lms/src/app/layout/shell-insets.spec.ts`
(new), `apps/lms/src/app/layout/owl/owl.ts`, `apps/lms/src/app/layout/owl/owl.scss`,
`apps/lms/src/app/layout/owl/owl.spec.ts`

**Estimated scope:** M

## Task 4: Course-editor footer pinned to the viewport bottom

**Description:** Make `.course-editor__foot` sticky at the bottom with a surface fill and a 1px top border, register
it with `appBottomBar`, and keep focused fields clear of it.

**Acceptance criteria:**

- [ ] New stacking key `bar: 20` in `$z-indexes`; the footer is `position: sticky; bottom: 0; z-index: ui.z(bar)`,
      `surface` fill, 1px top `border`, `padding-block: ui.space(3)`, no shadow; same buttons and order in create and
      edit mode.
- [ ] The footer has `appBottomBar`; the owl sits above it; the lesson drawer and dialogs cover it.
- [ ] Tab to any field scrolls it into view above the bar (`scroll-margin-bottom` on the form's controls, or
      `scroll-padding-bottom` while the editor is mounted).

**Verification:**

- [ ] `npx nx test lms` (`course-editor.spec.ts`: the footer carries the directive in both modes)
- [ ] Browser: step 2 with a long outline at 1280/375, light/dark; scroll, Tab to the last field, open the drawer

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
