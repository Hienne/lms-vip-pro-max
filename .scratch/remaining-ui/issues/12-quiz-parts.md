# 12: Timer and question grid

**What to build:** `ui-timer` in `@lms/ui` (remaining seconds → `mm:ss`, `role="timer"`, `aria-live="off"`, `is-low` under a threshold) and, in `apps/lms/src/app/shared/quiz/`, `app-question-grid` (cells answered/flagged/current, `goto` output) with `app-question-legend`. Updates the inventory rows for `.timer` and `.q-grid`. Replaces the quiz placeholder in **Thành phần học tập**. See spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Inventory and checklist updated (`feature-quiz-parts` split into `timer` and `question-grid`)
- [x] Cell names read "Câu n, đã trả lời/chưa trả lời, đã đánh dấu"; current cell has `aria-current`
- [x] Timer has no clock of its own; low state not colour only (icon + text)
- [x] Specs cover formatting, low state, cell names and `goto`
- [x] Demo copies the mockup (12:48, 00:45, ten cells); checklist entries done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
