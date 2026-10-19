# Implementation Plan: Custom theme (palette + light/dark)

Spec: [SPEC.md](../SPEC.md) (approved 2026-10-19). Tasks: [todo.md](todo.md).

## Overview

Add a palette setting (`bidv` default, `bidv-soft`, `blue`, `sand`) beside the existing
light/dark mode. `ThemeStore` owns both settings and writes `data-palette` / `data-theme` on
`<html>`. The tokens supply every colour, and the choice is set from a header popover and from the
`/design-system` table of contents.

## Dependency graph

```
T1 ThemeStore palette + persistence + no-flash script
 │
 ├── T2 $palettes tokens + emission + Sass guards (bidv-soft first)   ← highest risk
 │     └── T5 blue + sand values, contrast-tuned
 │
 T3 ui-swatch-group (libs/ui, independent of T1/T2)
 │
 └── T4 app-theme-controls + /design-system TOC (needs T1, T2, T3)
        │
        T6 uiPopover (libs/ui, independent)
        └── T7 header theme picker (needs T4, T6)
               └── T8 docs + full verification
```

## Architecture decisions

- **One store.** `ThemeStore` gains `palette$()` and `setPalette()`, so a single writer owns the
  theme attributes and the template-scan guard only needs widening.
- **Tokens only.** Palettes are a `$palettes` map in `_tokens.scss`. `_theme.scss` emits them at
  specificity (0,3,0) for dark mode, and Sass `@error` blocks a palette whose dark map does not
  cover its light map. This stops light values leaking into dark mode.
- **Shared controls, two hosts.** `app-theme-controls` (shared domain UI) is rendered inline in
  the `/design-system` TOC and inside the header popover. This gives one component spec for the
  behaviour and lets the token showcase be reviewed per palette before the header exists.
- **The visible slice comes first.** After T4, palettes can be switched and checked against the
  contrast table in `/design-system`. The header popover (T6–T7) is plain UI work on top of that.

## Task list

### Phase 1: Foundation

- [x] T1: ThemeStore palette state, persistence, no-flash script, scan guard
- [x] T2: Palette token infrastructure + `bidv-soft` (light and dark)
- [x] T3: `ui-swatch-group` molecule

### Checkpoint A (after T1–T3)

- [ ] `npm run check` green
- [ ] Setting `data-palette="bidv-soft"` by hand in devtools restyles the app in light and dark
      mode; removing it restores today's look exactly

### Phase 2: First visible slice

- [x] T4: `app-theme-controls` + `/design-system` TOC + contrast table follows the palette
- [x] T5: `blue` and `sand` palettes, tuned to pass contrast

### Checkpoint B (after T4–T5)

- [ ] `npm run check` green
- [ ] In `/design-system`, each of the 4 palettes × light/dark passes Success Criterion 5
- [ ] Screenshots of each palette shared with the user for review (Open Question 1)

### Phase 3: Header

- [x] T6: `uiPopover` behaviour (CDK connected overlay)
- [x] T7: Header theme picker

### Checkpoint C: Complete

- [x] T8: Docs and full verification. All spec Success Criteria 1–7 pass, verified in the
      browser (4 palettes × 3 modes × OS light/dark reload matrix, keyboard flow) and with
      `npm run check`

## Risks and mitigations

| Risk                                                                                    | Impact | Mitigation                                                                                                               |
| --------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| Palette light value overrides base dark value (selector specificity/order)              | High   | (0,3,0) dark selectors + Sass `@error` that dark keys ⊇ light keys; manual check in T2 before any other palette          |
| Proposed hex values fail contrast                                                       | Med    | Contrast table in `/design-system` follows the palette (T4); tune in T5 before the header ships                          |
| `bidv` look regresses                                                                   | High   | `bidv` emits no override block at all; Checkpoint A compares before/after screenshots                                    |
| `@angular/aria` listbox / CDK overlay API differs from assumptions in Angular 22        | Med    | Read installed type definitions first; copy patterns from `ui-segmented` (listbox) and `ui-menu` (`CdkConnectedOverlay`) |
| No-flash script drifts from the `THEME_PALETTES` list                                   | Low    | Comment in both places; T8 reload matrix catches it                                                                      |
| Popover focus/outside-click edge cases (trigger click toggles vs. outside-click closes) | Med    | Dedicated spec cases in T6                                                                                               |

## Parallelization

T3 (`ui-swatch-group`) and T6 (`uiPopover`) live in `libs/ui`, touch no shared files and depend on
nothing, so each can run in its own session alongside T1/T2. T4 and T7 must wait for them.

## Open questions

- Exact hex values: tuned in T5; the user reviews the screenshots at Checkpoint B.
