# 11: Course card, journey, due date and required mark

**What to build:** in `apps/lms/src/app/shared/course/`: `app-required-mark`, `app-due-date` (injected clock), `app-course-card` (cover tint token, badges, eyebrow, clamped title, meta, progress, status line, due date; whole card is one link) and `app-journey` (stops with done/current/upcoming, `ui-mai` on current). Replaces the placeholders in **Thành phần học tập**. See spec.

**Blocked by:** 10 — Domain status badges

**Status:** done

- [x] Six cover tints added as theme tokens with dark values; no literal colours
- [x] Due date phrasing and tones match `UI.Due` at fixed clock values
- [x] Course card progress tone follows status; one accessible link per card
- [x] Journey keeps names and percentages visible; current stop logic matches the mockup
- [x] Specs cover each component's states
- [x] Demo uses the mockup's three sample courses and four journey stops; checklist entry `domain-course-card` done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
