# Spec: Custom theme (palette + light/dark) from the header

Status: **revision 2, awaiting approval (2026-10-20)**. Revision 1 (approved 2026-10-19) shipped
the picker, `ThemeStore` palette state, the no-flash script and three colour-only palettes in
PR #34. The user found those palettes too plain. Revision 2 replaces them with three full themes
modelled on two reference sites, and lightly refines BIDV chuẩn. It still ships in PR #34.
Single capability (no capability map needed).

## Objective

Let every signed-in user choose how the LMS looks from a palette icon button in the app header.
The standard BIDV teal is saturated and dark for long study sessions, so the app offers three
quiet, minimal themes next to it.

**Users:** all roles (learner, instructor, admin). The choice belongs to the browser, not the
account: it is stored in `localStorage`, has no server API and does not follow the user to another
device.

### User stories

1. As a learner, I click the palette icon in the header, pick **Giấy**, and the whole app
   (sidebar, buttons, headings, backgrounds, login hero) changes at once, without a reload.
2. As a user, I set **Tối** (dark) in the same dropdown and the chosen theme shows its dark
   variant.
3. As a user, I reload or come back tomorrow and the app opens in my theme and mode, with no
   flash of the default teal.
4. As a keyboard or screen-reader user, I can open the dropdown, move between options with the
   arrow keys, select one, and close with Escape. Focus then returns to the icon.

### What the references teach (design direction)

| Principle                              | Kite (kite.vibery.app)                                | Tony (tony-card.pages.dev)                                     |
| -------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Tinted near-white, not pure white      | slate canvas `#EEF1F4`, surface one step up `#F6F7F9` | paper `#F4F1EA`, card `#FBFAF6`, faint dot grid                |
| Ink instead of black                   | `#243042`                                             | `#16181D`                                                      |
| One primary, one accent used sparingly | cobalt `#3A5BA9` + terracotta `#B94328`               | primary **is** the ink; rust `#C2512B` for eyebrows/highlights |
| Typography carries the character       | Nunito Sans, light 300 display with -0.03em tracking  | Fraunces serif display, sans body                              |
| Long, soft, ink-tinted shadows         | `0 1px 2px ink/4%, 0 6px 20px -10px ink/12%`          | `0 30px 60px -30px ink/18%`                                    |
| Dim dark mode, not black               | `#151A21`                                             | `#0F1115`, ivory text                                          |

### Themes

| Id       | Label (UI copy) | Character                                                                                                    |
| -------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `bidv`   | BIDV chuẩn      | **Default** (no stored choice = `bidv`). Today's tokens with the light refinements below.                    |
| `ngoc`   | Ngọc            | BIDV teal toned down on Kite's structure: mist canvas, deep-teal sidebar, muted gold accent. Brand-adjacent. |
| `cobalt` | Cobalt          | Kite: slate ink, cobalt primary, terracotta accent, Nunito Sans with light display headings, pill controls.  |
| `giay`   | Giấy            | Tony: warm paper with a dot grid, ink primary, rust accent, Fraunces display headings, light sidebar.        |

Revision 1 ids `bidv-soft`, `blue` and `sand` are dropped. A stored old id is unknown, so it falls
back to `bidv` (they never reached `main`).

Each theme has a light **and** a dark variant. A theme may override these token groups:

| Group     | Keys                                                                                                                                                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colors`  | revision 1 brand + neutral keys; **plus** `accent`, `accent-subtle`, `accent-ink`, `on-accent`, `hero-accent`, `hero-chip`, `eyebrow` (new) and the new `nav-*` keys (`nav-bg`, `nav-text`, `nav-muted`, `nav-hover`, `nav-active-bg`, `nav-active-text`, `nav-border`) |
| `chart`   | `1`, `2`, `grid`                                                                                                                                                                                                                                                        |
| `shadow`  | `sm`, `md`, `lg` (dark values too, as today)                                                                                                                                                                                                                            |
| `type`    | `sans`, `display` (new font token), `display-weight` (new), `display-tracking` (new)                                                                                                                                                                                    |
| `shape`   | `control` (new radius for buttons, inputs, segmented, chips), `card` (new radius for cards, popover, dialog)                                                                                                                                                            |
| `texture` | `page` (new: the body background image, `none` by default)                                                                                                                                                                                                              |

**Never changes:** semantic colours (`success*`, `warning*`, `danger*`, `info*`), `white`, `black`,
`overlay`, the cover tints other than `cover-layers`, chart colours 3–5, spacing, text sizes,
layout, motion, z-indexes. `type`, `shape` and `texture` are mode-independent: they are set once
per theme and need no dark value.

Starting values are proposals. Each must pass the contrast rules in Success Criteria and may be
adjusted to do so.

| Light               | ngoc                        | cobalt                   | giay                       |
| ------------------- | --------------------------- | ------------------------ | -------------------------- |
| bg / surface        | `#EEF2F1/#F7F9F8`           | `#EEF1F4/#F6F7F9`        | `#F4F1EA/#FBFAF6`          |
| text / text-muted   | `#1E2B2A/#566462`           | `#243042/#4F596A`        | `#16181D/#5F6168`          |
| border              | `#D8E0DE`                   | `#D9DEE6`                | `#E2DDD2`                  |
| primary / on        | `#2B6E69/#FFFFFF`           | `#3A5BA9/#FFFFFF`        | `#16181D/#FBFAF6`          |
| accent / eyebrow    | `#B8862B/#8A6A1E`           | `#B94328/#B94328`        | `#C2512B/#B0461F`          |
| nav-bg / nav-text   | `#1F3B39/#E4EFED`           | `#E9EDF3/#243042`        | `#EFEBE2/#16181D`          |
| hero-from → hero-to | `#1F3B39 → #2B5E5A`         | `#132A66 → #2B55B8`      | `#16181D → #16181D` (flat) |
| display             | Be Vietnam Pro 600, −0.02em | Nunito Sans 300, −0.03em | Fraunces 500, −0.02em      |
| sans                | Be Vietnam Pro              | Nunito Sans              | Be Vietnam Pro             |
| control / card      | 10px / 16px                 | 999px (pill) / 20px      | 10px / 20px                |
| texture             | none                        | none                     | dot grid, ink at 6%        |

| Dark              | ngoc              | cobalt            | giay              |
| ----------------- | ----------------- | ----------------- | ----------------- |
| bg / surface      | `#141A19/#1A2120` | `#151A21/#1C222B` | `#0F1115/#15181D` |
| text / text-muted | `#D6E0DE/#95A39F` | `#D5DCE6/#99A3B3` | `#ECE8DF/#B1AFA8` |
| primary / on      | `#6FB8B0/#0E1615` | `#7C97D6/#0F141B` | `#ECE8DF/#15181D` |
| accent            | `#D9B25E`         | `#E07A5F`         | `#E0703F`         |
| nav-bg            | `#101615`         | `#181D25`         | `#13161B`         |

### BIDV chuẩn refinements (light touch)

The colours stay the same. Only the following change, in the base tokens, so every theme inherits
them unless it overrides them:

- **Shadows:** two layers (a contact shadow plus a long, soft drop) tinted with the BIDV ink:
  - `sm` = `0 1px 2px` ink/5%
  - `md` = `0 1px 2px` ink/4% + `0 8px 24px -12px` ink/14%
  - `lg` = `0 1px 2px` ink/4% + `0 32px 64px -28px` ink/32%
- **Headings:** h1–h3 and the page title use the `display` tokens. For BIDV that is Be Vietnam
  Pro 700 with −0.02em tracking (today h1 alone has −0.01em).
- **Controls:** radius 6px → 8px. Cards stay at 14px.
- **Eyebrow:** the new `eyebrow` token is BIDV `primary`, replacing `text-muted`. Page-header
  eyebrows pick up the brand colour, as in both references.

The sidebar, hero, accent and all colours are unchanged. The `/design-system` screenshots in the
PR show BIDV before and after.

### The dropdown

Unchanged from revision 1:

- **Trigger:** `button[uiIconButton]` with `<ui-icon name="palette" />`, label **"Tùy chỉnh
  giao diện"**, in `.header__actions` before the bell. `aria-haspopup="dialog"`, `aria-expanded`.
- **Panel** (non-modal popover, anchored below the trigger and aligned right):
  - Group **"Bảng màu"**: four swatches, BIDV chuẩn / Ngọc / Cobalt / Giấy.
  - Group **"Chế độ"**: Hệ thống / Sáng / Tối.
- Selecting applies immediately and the panel stays open. It closes on Escape, an outside click,
  or the trigger, and focus returns to the trigger.
- **Mobile (< md):** full width minus the gutter.

## Tech Stack

Angular 22 (standalone, zoneless, signals) · `@angular/aria` listbox · `@angular/cdk/overlay` ·
SCSS through the `ui` module · Vitest.

**New dependencies (approved 2026-10-20):** `@fontsource/fraunces` (weight 500) and
`@fontsource/nunito-sans` (weights 300, 400, 600, 700), version 5.3.0. They are self-hosted like
`@fontsource/be-vietnam-pro` because internal networks may block Google Fonts. Their
`@font-face` rules go in `apps/lms/project.json` styles. The browser downloads a font file only
when a rendered element uses that family, so a user on BIDV never fetches them. Each rule ships
Vietnamese, Latin and Latin-ext `unicode-range` subsets.

## Architecture

```
index.html inline script ──applies──▶ <html data-theme data-palette>
                                              ▲
ThemeStore (core/theme) ─── only writer ──────┘   persists lms.theme + lms.palette
   ▲  preference$ / palette$ / effective$ ; setPreference() / setPalette()
   │
app-theme-controls (shared/theme-controls)  ← reads store, calls commands
   uses: ui-swatch-group · ui-segmented
   ├── app-theme-picker (header) wraps it in uiPopover
   └── /design-system renders it inline

_tokens.scss $palettes (colors, chart, shadow, type, shape, texture)
   ──▶ _palettes.scss emits :root[data-palette=…] (light + dark; type/shape/texture light only)
```

Revision 1 decisions 1, 2 and 4–7 stand (ThemeStore, attribute, no-flash script, popover,
swatch group, theme controls, design-system). New or changed:

1. **Tokens stay the single source, with more groups.** `_tokens.scss` gains:
   - `$fonts.display`, `$display: (weight, tracking)`, `$radii.control`, `$radii.card`,
     `$textures.page`;
   - colour keys `eyebrow` and `nav-*`.

   The base values reproduce BIDV (refined). `_palettes.scss` validates and emits the new groups:
   - `type`, `shape` and `texture` are emitted only in the light block `:root[data-palette=x]`;
     they hold for both modes.
   - `colors`, `chart` and `shadow` keep the light ⊆ dark guard.
   - Unknown groups or keys fail the build, as today.

2. **Components read semantic tokens, never a theme.** One-time refactors so a theme can reach
   them:
   - The sidebar reads `nav-*` instead of `primary-strong`, `primary-subtle`, `white` and
     `hero-subtle`. The BIDV `nav-*` values equal today's colours.
   - h1–h3, `.page-header__title` and KPI values read `--font-display`,
     `--font-weight-display` and `--tracking-display`.
   - Buttons, inputs, segmented controls and chips read `--radius-control`; cards, the popover
     and the dialog read `--radius-card`.
   - The page eyebrow reads `--color-eyebrow`.
   - `body` paints `--texture-page` over `bg`.

   No SCSS file branches on a theme.

3. **Theme swatches** (`--color-swatch-<id>-fill/-base`) keep coming from each theme's light
   `primary` / `bg`. For Giấy, whose primary is ink, the fill is `accent`, so the swatch reads
   as "rust on paper". The swatch source key becomes configurable per theme (`swatch: accent`).

## Commands

```bash
nvm use
npm start                 # app on :4200; see AGENTS.md for the mock/proxy split
npx nx test ui            # tokens, palettes, contrast, popover, swatch group
npx nx test lms           # ThemeStore, theme controls, picker, template scan
npm run check             # format, lint, typecheck, test, build, bundle guard
```

## Project Structure

Revision 2 touches:

```
libs/ui/src/styles/ui/_tokens.scss          new groups and keys; ngoc/cobalt/giay replace bidv-soft/blue/sand; BIDV refinements
libs/ui/src/styles/ui/_functions.scss       accessors for the new tokens if needed (ui.radius(control) etc.)
libs/ui/src/styles/global/_palettes.scss    new groups, mode-independent groups, swatch source key
libs/ui/src/styles/global/_theme.scss       emits the new base tokens
libs/ui/src/styles/global/_base.scss        headings use the display tokens; body texture
libs/ui/src/styles/components/_btn.scss, _input.scss, _segmented.scss, _chip.scss,
  _card.scss, _popover.scss, _dialog.scss, _page-header.scss, _kpi.scss   radius/eyebrow/display tokens
libs/ui/src/styles/styles.spec.ts           emitted keys per group, new contrast rules, guard errors
apps/lms/project.json, package.json         @fontsource/fraunces, @fontsource/nunito-sans
apps/lms/src/app/layout/sidebar/sidebar.scss   nav-* tokens
apps/lms/src/app/features/auth/login/login.scss   eyebrow/hero tokens only if needed
apps/lms/src/app/core/theme/theme.store.ts (+spec)     THEME_PALETTES = bidv, ngoc, cobalt, giay
apps/lms/src/index.html                     no-flash ids
apps/lms/src/app/shared/theme-controls/     labels and swatch keys
apps/lms/src/app/template-scan.spec.ts      id sync (unchanged logic)
docs/conventions/ui-library.md              theme groups, new tokens, fonts
```

## Code Style

The theme map shape (one theme shown, values abbreviated):

```scss
$palettes: (
  giay: (
    swatch: accent,
    type: (
      sans: $font-be-vietnam,
      display: $font-fraunces,
      display-weight: 500,
      display-tracking: -0.02em,
    ),
    shape: (
      control: 10px,
      card: 20px,
    ),
    texture: (
      page: radial-gradient(circle at 1px 1px, rgba(22, 24, 29, 0.06) 1px, transparent 0) 0 0 / 22px 22px,
    ),
    light: (
      colors: (
        primary: #16181d,
        bg: #f4f1ea,
        …,
      ),
      chart: (
        1: #c2512b,
        …,
      ),
      shadow: (
        md: …,
        lg: …,
      ),
    ),
    dark: (
      colors: (
        primary: #ece8df,
        bg: #0f1115,
        …,
      ),
      chart: (
        …,
      ),
      shadow: (
        …,
      ),
    ),
  ),
);
```

Components only ever read semantic tokens:

```scss
.sidebar {
  background: ui.color(nav-bg);
  color: ui.color(nav-text);
}
.btn {
  border-radius: ui.radius(control);
}
```

Conventions are unchanged: English identifiers, Vietnamese copy, tokens only, BEM, and imports
that point down the atomic levels.

## Testing Strategy

| Level              | What                                                                                                                                                                                                                      | Where                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Build: tokens      | each theme emits every group it declares; `type`/`shape`/`texture` only in the light block; dark ⊇ light for `colors`/`chart`/`shadow`; guard errors for unknown group, unknown key, light-without-dark, `bidv` overrides | `styles.spec.ts`         |
| Build: BIDV refine | compiled `:root` equals HEAD except the listed refinements and the new tokens (property-level diff asserted in the spec)                                                                                                  | `styles.spec.ts`         |
| Build: contrast    | revision 1 rules **plus** the new rules in SC5, for every theme × mode, computed from compiled CSS                                                                                                                        | `styles.spec.ts`         |
| Unit: store        | ids are `bidv, ngoc, cobalt, giay`; an old id (`sand`) falls back to `bidv`                                                                                                                                               | `theme.store.spec.ts`    |
| Component          | theme controls show the four new labels                                                                                                                                                                                   | `theme-controls.spec.ts` |
| Guard              | id sync between store, CSS and `index.html`; colour-literal guard stays green (the texture uses a literal only inside `_tokens.scss`)                                                                                     | `template-scan.spec.ts`  |
| Browser            | screenshots of the dashboard, a course page, login and `/design-system` in 4 themes × light/dark (in the PR), the reload matrix, and a check that fonts load only when their theme is active (network panel)              | manual, `npm start`      |

## Boundaries

- **Always:** keep `ThemeStore` the only runtime writer of `data-theme` and `data-palette`; put
  every theme value in `_tokens.scss`; give every colour, chart and shadow key a dark value; make
  components read semantic tokens; run `npm run check`.
- **Ask first:** BIDV changes beyond the listed refinements; letting a theme change semantic
  colours, spacing, text sizes or layout; any further font or dependency; changing the default
  theme.
- **Never:** branch on a theme in a component or SCSS file; write a colour literal outside
  `_tokens.scss`; load fonts from Google Fonts; ship a theme that fails a contrast rule; change
  layout or component structure as part of a theme.

## Success Criteria

1. The header palette button and the dropdown work as in revision 1. The dropdown lists **BIDV
   chuẩn, Ngọc, Cobalt, Giấy** and **Hệ thống / Sáng / Tối**.
2. Selecting a theme restyles the whole app immediately, with no reload: colours, sidebar,
   headings font, control and card radius, shadows, texture and login hero.
3. Choices persist (`lms.palette`, `lms.theme`). BIDV chuẩn shows only the listed refinements
   compared with `main`.
4. **No flash:** the reload matrix (4 themes × 3 modes × OS light/dark) paints the right
   colours from the first frame. A Fraunces or Nunito Sans heading may swap in once the font
   arrives (`font-display: swap`); this is accepted.
5. **Contrast** for every theme in both modes:
   - revision 1 rules;
   - 4.5:1 or more for `eyebrow` and `accent-ink` on `surface` and `bg`;
   - 4.5:1 or more for `nav-text` and `nav-muted` on `nav-bg`, and `nav-active-text` on
     `nav-active-bg`;
   - 4.5:1 or more for `on-accent` on `accent`.
6. **Fonts:** a user on BIDV or Ngọc downloads no Fraunces or Nunito Sans file. Vietnamese
   diacritics render in the theme font (no fallback glyphs) on the dashboard and the login page.
7. `npm run check` passes, the angular.md §14 checklist passes, and `ui-library.md` documents
   the theme groups, the new tokens and the fonts.

## Resolved Questions

1. Palette selector in `/design-system`: yes (revision 1).
2. Revision 2 (2026-10-20): the three themes are the right direction; theme fonts are allowed;
   BIDV chuẩn gets light refinements; the work continues on PR #34.

## Open Questions

1. **Exact hex values:** tuned to pass contrast; the user reviews each theme from screenshots.
2. **Cobalt body font:** Nunito Sans for the whole UI (as Kite), or only for headings with Be
   Vietnam Pro for the body? The proposal is the whole UI.
