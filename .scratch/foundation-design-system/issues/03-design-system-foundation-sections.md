# 03: Design system foundation sections

**What to build:** The descriptive sections of `/design-system` that need no
atoms beyond plain markup and utilities: **Nguyên tắc** with the v1 → v2
change log, **Typography** (display, H1–H3, body, small, caption at the
project's sizes and weights) and **Spacing · bo góc · đổ bóng · chuyển
động** (spacing steps, radius and shadow samples, motion durations with a
live sample that respects reduced motion). Copy is taken from the mockup
page. See the spec: `/design-system` route.

**Blocked by:** 01 — Theme tokens, base styles and the `/design-system` shell

**Status:** ready-for-agent

- [ ] The three sections render in the mockup's order and numbering with the mockup's Vietnamese copy
- [ ] Typography, spacing, radius, shadow and motion samples use theme utilities only; no arbitrary values or inline literals
- [ ] Motion sample does not animate when the system asks for reduced motion
- [ ] Table of contents links reach each section and focus lands on its heading
- [ ] Route spec asserts the sections and their headings render
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [ ] `npm run check` green; merged through its own pull request
