# 09: Badge, chip, card, skeleton and spinner atoms

**What to build:** `uiBadge` (tones, dot, outline, optional icon), `uiChip`
(pressed state through `aria-pressed`), `uiCard` with `uiCardHeader` and
`uiCardBody` (padded, interactive, tint and reward variants), `uiSkeleton`
(text, title, block) and `uiSpinner` (with an accessible status). They fill
the **Badge & trạng thái** section and the loading part of **Phản hồi hệ
thống** on `/design-system`. Domain status badges (course, publish, account,
role) stay placeholders: they are domain UI in the app, built with their
first screen. See the spec: `@lms/ui` atoms.

**Blocked by:** 02 — Migration checklist and progress board; 04 — Icon atom with the full icon registry

**Status:** ready-for-agent

- [ ] Badge tones `neutral`, `primary`, `success`, `warning`, `danger`, `info`, `reward`, plus dot and outline, match the mockup; meaning never relies on colour alone in demos
- [ ] Chip toggles through `aria-pressed` and is a native button
- [ ] Card variants and header/body parts match the mockup; interactive cards keep a visible focus ring
- [ ] Skeleton shapes shimmer and stop under reduced motion; spinner exposes a status with a Vietnamese label
- [ ] Specs cover classes per tone and variant, chip pressed state, and spinner ARIA
- [ ] **Badge & trạng thái** and the loading demos of **Phản hồi hệ thống** replace their placeholders; other demos there stay placeholders
- [ ] Checklist entries `done` with owner, pull request and the checks performed
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [ ] `npm run check` green; merged through its own pull request
