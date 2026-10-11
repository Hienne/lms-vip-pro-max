# 05: Brand flower atoms

**What to build:** `ui-mai`, the brand's hoa mai SVG with size and colour
inputs, and `ui-mai-badge`, the reward badge built on it, ported from the
mockup's `mai()` and `UI.MaiBadge`. `/design-system` uses them where the
mockup does: the brand mark in the table of contents, the decorative flower in
the hero, and the badge demo in the learning components section. See the
spec: `@lms/ui` atoms.

**Blocked by:** 02 — Migration checklist and progress board

**Status:** ready-for-agent

- [ ] `ui-mai` renders the mockup's flower geometry at any size; colours come from tokens or inputs mapped to tokens, never hex literals in templates
- [ ] The flower is decorative (hidden from assistive technology) unless given a label
- [ ] `ui-mai-badge` shows earned and not-earned states as in the mockup, with text not relying on colour alone
- [ ] Spec covers sizes, labelled vs decorative, and both badge states
- [ ] Table of contents brand mark and the hero header render on `/design-system` with the mockup's copy; badge demo replaces its placeholder
- [ ] Checklist entries `done` with owner, pull request and the checks performed
- [ ] Checked in the browser side by side with the mockup, light and dark
- [ ] `npm run check` green; merged through its own pull request
