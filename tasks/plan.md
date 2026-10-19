# Implementation Plan: Custom theme (palette + light/dark)

Spec: [SPEC.md](../SPEC.md) (revision 1 approved 2026-10-19; revision 2 awaiting approval).
Tasks: [todo.md](todo.md). Revision 1 (T1–T8) is done; revision 2 (T9–T15) is below.

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

---

# Revision 2: full themes (T9–T15)

## Overview

Replace the colour-only palettes with three full themes (`ngoc`, `cobalt`, `giay`) that also set
the accent, sidebar, shadows, display font, control/card radius and page texture, and lightly
refine BIDV chuẩn. The picker, store, no-flash script and popover from revision 1 stay; the ids
change.

## Dependency graph

```
T9  token model v2: new base tokens + theme groups + guards (bidv output unchanged)   ← highest risk
 ├── T10 libs/ui components + base read the semantic tokens (radius, display, eyebrow, texture)
 ├── T11 sidebar reads nav-* tokens (bidv look unchanged)
 └── T12 fonts: @fontsource Fraunces + Nunito Sans, lazy by usage
        └── T13 ngoc / cobalt / giay replace bidv-soft / blue / sand (needs T10–T12)
               ── Checkpoint D: user reviews screenshots ──
               └── T14 BIDV chuẩn refinements
                      └── T15 docs, full verification, PR #34 description + screenshots
```

## Architecture decisions

- **Refactor first, restyle second.** T9–T11 add semantic tokens and move components onto them
  while BIDV renders identically: the compiled CSS diff only adds properties, and the
  before/after screenshots match. Only then do the themes (T13) and the BIDV refinements (T14)
  change pixels, so any regression is attributable.
- **Mode-independent groups.** `type`, `shape` and `texture` are emitted once in the light block,
  `:root[data-palette=x]`, which also applies in dark mode. Only `colors`, `chart` and `shadow`
  carry the dark ⊇ light guard.
- **Fonts cost nothing until used.** `@font-face` rules are global, and the browser only fetches
  a file when an element renders in that family. T12 verifies this in the network panel.

## Task list

### Phase 4: Token refactor (BIDV unchanged)

- [x] T9: Token model v2 and emitter
- [ ] T10: libs/ui components and base read the new semantic tokens
- [ ] T11: Sidebar reads `nav-*` tokens
- [ ] T12: Theme fonts (Fraunces, Nunito Sans)

### Checkpoint C2 (after T9–T12)

- [ ] `npm run check` green
- [ ] BIDV light and dark screenshots (dashboard, course page, login, `/design-system`) match
      `main` pixel for pixel

### Phase 5: Themes

- [ ] T13: Ngọc, Cobalt, Giấy

### Checkpoint D (after T13)

- [ ] `npm run check` green; SC5 contrast passes for every theme × mode
- [ ] Screenshots of the 3 themes × light/dark shared with the user for review **before** T14

### Phase 6: Finish

- [ ] T14: BIDV chuẩn refinements
- [ ] T15: Docs, full verification, PR #34 update

## Risks and mitigations

| Risk                                                                 | Impact | Mitigation                                                                                                                     |
| -------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Refactor changes BIDV pixels by accident (radius, heading weight)    | High   | T9 base values equal today's; T10/T11 compare screenshots and assert the compiled `:root` diff only adds properties            |
| Light sidebar (Cobalt, Giấy) has low-contrast icons or active states | Med    | `nav-*` contrast rules in SC5, computed in `styles.spec.ts`                                                                    |
| Pill controls (Cobalt) break layouts tuned for 6px corners           | Med    | Check segmented, inputs with adornments and button groups in `/design-system`; the per-theme `control` radius can drop to 12px |
| Theme font changes text metrics → truncation and wrapping            | Med    | Screenshot review at 375 and 1280 px; Nunito Sans and Be Vietnam Pro have similar x-heights                                    |
| Font files fetched for every user                                    | Low    | Network-panel check in T12 and T15 (SC6)                                                                                       |
| Ink as the primary (Giấy) makes links indistinguishable from text    | Med    | Links stay underlined (base style); verify in the screenshots                                                                  |
| Component style budget (4 kb warning)                                | Low    | Only token reads change; the check runs in T15                                                                                 |
