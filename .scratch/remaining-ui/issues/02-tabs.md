# 02: Tabs molecule

**What to build:** `ui-tabs` on the `@angular/aria` tabs entry point: tab list with optional icon and count per tab (`.tabs__count`), `selected` input and `selectedChange` output, panels projected by id. Replaces the tabs placeholder in **Điều hướng**. See spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `@angular/aria` tabs API read from installed types before use
- [x] Roving tabindex; Left/Right/Home/End move focus; selected tab has `aria-selected` and controls its panel
- [x] Count is part of the accessible name ("Khóa học 6")
- [x] Spec covers roles, keyboard and output
- [x] Demo uses the mockup tabs (Tổng quan, Khóa học 6, Bài thi); checklist entry `tabs` done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
