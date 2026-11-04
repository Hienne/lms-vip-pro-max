# Implementation Plan: `ui-polish`

Spec: [SPEC-ui-polish.md](../SPEC-ui-polish.md) (approved 2026-11-04; amended below). Tasks: [todo.md](todo.md).
The previous `course-publish-targets` plan is in git history at `23b2930`.

## Overview

Three UI changes: a token-coloured thin scrollbar across the app (nav variant on the sidebar), a stepper of
numbered steps joined by connectors instead of four cards, and a course-editor footer pinned to the bottom of the
viewport with the owl lifted above it.

## Findings from the codebase (answers to the spec's open checks)

- **`primary-subtle`** exists in the base light and dark maps and in every theme (`ngoc`, `cobalt`, `giay`, light and
  dark) in `_tokens.scss`. Safe for the done circle.
- **Themes live in `libs/ui/src/styles/ui/_tokens.scss` (`$palettes`)**, not `_palettes.scss`; that file only emits
  them and fails the build on a key missing from `$palette-color-keys` or a light key the dark map leaves out.
- **Light sidebars:** `cobalt` and `giay` mix their `nav-hover` from `text`, not `white`. A `nav-scrollbar-thumb`
  mixed from `white` would vanish there, so it joins `$palette-color-keys` and those two themes (light and dark)
  set it from `text`.
- **Sidebar scroll:** the host `app-sidebar.app-shell__sidebar` has `height: 100dvh; overflow-y: auto`, and the
  inner `.sidebar__nav` scrolls too. The full-height bar in the screenshot is the outer one. Task 1 confirms in the
  browser which one overflows and leaves only `.sidebar__nav` scrolling (the outer becomes `overflow: hidden` only
  if brand + role + footer still fit at a 600px-tall viewport; otherwise it keeps `auto` with the nav colours).
- **Chat launcher = the owl.** `app-chat-widget` is the panel the owl opens (the owl hides while it is open). Only
  the owl needs the inset; the open panel is an overlay and may cover the footer, like the drawer.
- **Stacking:** `$z-indexes` has no key below `header: 30`. The pinned footer needs one.

## Architecture decisions

1. **Scrollbar through inheritance.** `scrollbar-color` and `scrollbar-width` inherit, so one rule on `html` in
   `@layer base` reaches every scroll area. A `ui.scrollbar($tone)` mixin covers the nav tone (and re-sets the
   default where an area must). No `::-webkit-scrollbar`.
2. **Connector as a pseudo-element** on `.stepper__item` (`::after`, not the last item), so it is out of the
   accessibility tree with no markup change. The item gets an `is-done` class (today only the button has it) so the
   connector after a done step turns primary. Vertical layout below `md` with the same pseudo-element turned
   vertical.
3. **Footer pinned with `position: sticky`**, not `fixed`: it stays inside the page column, so the sidebar, the
   rail and the docked assistant need no maths, and it rests in place at the end of the form.
4. **Owl inset through a root signal.** `ShellInsets.bottom` (px) in `apps/lms/src/app/layout`, written by an
   `appBottomBar` directive (ResizeObserver, reset on destroy) and read by `app-owl` as a `--owl-inset` style
   binding on its host. Generic, so another page can pin a bar later without touching the owl.
5. **New tokens (amends the spec's "four colours"):** colours `scrollbar-thumb`, `scrollbar-thumb-hover`,
   `scrollbar-track`, `nav-scrollbar-thumb`, and the stacking key `bar: 20` (below `header`). This is the one
   token addition beyond the spec; flagged for review at Checkpoint A.

## Dependency graph

```text
Task 1 scrollbar (ui tokens, base, mixin, sidebar)      independent
Task 2 stepper (ui organism)                            independent
Task 3 ShellInsets + appBottomBar + owl inset           independent
          └── Task 4 sticky footer in course-editor (uses appBottomBar, z key `bar`)
Task 5 docs + spec status                               after 1–4
```

Tasks 1, 2 and 3 touch disjoint files and could run in parallel; Task 1 and Task 4 both edit `_tokens.scss`
(different maps), so run them in order or merge carefully. Default: sequential, 1 → 2 → 3 → 4 → 5.

## Task list

### Phase 1: Library

- [ ] Task 1: Token-coloured thin scrollbar app-wide, nav variant on the sidebar
- [ ] Task 2: Stepper of numbered steps joined by connectors

### Checkpoint A

- [ ] `npx nx test ui` and `npx nx test lms` green
- [ ] Browser: scrollbar computed styles (html, sidebar nav) in bidv, cobalt; stepper at 1280/375 light/dark
- [ ] Review with the user (look of the stepper, the `bar` z key)

### Phase 2: Pinned footer

- [ ] Task 3: `ShellInsets` + `appBottomBar`; the owl rises by the inset
- [ ] Task 4: Course-editor footer pinned to the viewport bottom

### Checkpoint B

- [ ] `npm run check` green
- [ ] Browser on `/admin/courses/new` and `/admin/courses/:id/edit`: pinned footer, owl above it, drawer covers it,
      Tab to the last field not hidden; 1280/375 light/dark
- [ ] angular.md §14 and visual-design.md checklists

### Phase 3: Docs

- [ ] Task 5: `ui-library.md` rows, spec amended and marked built, results in `todo.md`

## Risks and mitigations

| Risk                                                                                    | Impact | Mitigation                                                                                                             |
| --------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| macOS overlay scrollbars hide the result; Windows (the user's screenshot) not testable  | Med    | Check computed `scrollbar-color`/`-width`; screenshot with "Show scroll bars: Always" if allowed; say so in the report |
| `scrollbar-color` on `html` changes areas that set `scrollbar-width: none` (tabs)       | Low    | The local rule wins over the inherited one; the tabs spec/visual check covers it                                       |
| Long titles ("Đối tượng & xuất bản") squeeze the connectors at ~1024px with the sidebar | Med    | Connector has a minimum length (`ui.space(4)`); titles wrap, never truncate; check at 1024px too                       |
| Sticky footer fails if an ancestor has `overflow` other than visible                    | Med    | Check the shell main/content chain in Task 4; the page scrolls the window today (not `--fill`)                         |
| Owl inset leaks if the editor is destroyed mid-resize                                   | Low    | The directive resets to 0 in `DestroyRef.onDestroy` and disconnects the observer; spec covers it                       |
| Theme guard rejects a new colour key                                                    | Low    | Add `nav-scrollbar-thumb` to `$palette-color-keys` and set it in both modes of each theme that overrides it            |

## Open questions

None blocking. Checkpoint A asks the user to accept the `bar: 20` stacking key and the stepper's look.
