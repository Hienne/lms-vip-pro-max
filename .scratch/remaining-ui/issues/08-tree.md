# 08: Tree organism

**What to build:** `ui-tree` on the `@angular/aria` tree entry point: nodes input (id, label, icon, optional trailing slot, children), `expanded` and `selected` inputs with outputs, chevron toggles. Replaces the tree placeholder in **Điều hướng**. See spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `@angular/aria` tree API read from installed types before use
- [x] Up/Down/Left/Right/Home/End per the WAI-ARIA tree pattern; `aria-level`, `aria-expanded`, `aria-selected`
- [x] Trailing slot lets the app place a publish status badge
- [x] Spec covers keyboard, expansion and selection outputs
- [x] Demo uses the mockup's domain → program → course sample; checklist entry `tree` done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
