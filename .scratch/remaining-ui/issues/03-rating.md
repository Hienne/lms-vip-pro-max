# 03: Stars and rating molecules

**What to build:** `ui-stars` (display: five stars, rounded value, score, optional review count, sr-only "x trên 5 sao") and `ui-rating` (input: `role="radiogroup"` of five `role="radio"` buttons named "n sao", `value` / `valueChange`). Replaces the rating placeholder in **Thành phần học tập**. See spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Stars hidden from assistive tech; the sentence carries the value
- [x] Rating: arrow keys move and select, roving focus, `aria-checked` on the chosen star, `is-on` up to the value
- [x] Spec covers display text, keyboard, click and output
- [x] Demo copies "Bài học này hữu ích với bạn thế nào?"; checklist entry `rating` done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
