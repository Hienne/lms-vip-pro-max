# 04: KPI molecule

**What to build:** `ui-kpi`: icon (with `tone`), value, optional suffix, label, optional delta, rendered inside a `uiCard`; with `href`/`routerLink` the whole card is an interactive link. Replaces the KPI placeholder in **Hiển thị dữ liệu**. See spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Tones match `.kpi__icon--*`; value uses tabular numbers
- [x] Linked variant keeps one link with a readable name and a visible focus ring
- [x] Spec covers tones, suffix, delta and link
- [x] Demo shows a row of four KPIs as in the mockup; checklist entry `kpi` done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
