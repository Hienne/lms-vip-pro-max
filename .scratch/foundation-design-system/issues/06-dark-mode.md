# 06: Dark mode with a three-way theme switch

**What to build:** Users choose **Hệ thống / Sáng / Tối**. The choice is
remembered per browser under `lms.theme` (absence means system), survives
blocked storage, and is applied before the app boots so the page never
flashes the wrong theme. In system mode the theme follows the operating
system live. A root `ThemeStore` is the only writer of the theme attribute;
everything else changes through tokens. The choice is made with `ui-segmented`,
a molecule on the fitting `@angular/aria` pattern, placed in the
`/design-system` table of contents. The contrast table recomputes when the
effective theme changes. Tailwind's `dark:` variant matches the same logic
but stays forbidden in templates. See the spec: Dark mode, `@lms/ui` atoms
(segmented).

**Blocked by:** 02 — Migration checklist and progress board; 04 — Icon atom with the full icon registry

**Status:** ready-for-agent

- [ ] `ThemeStore` exposes the preference, the effective theme and one command to set the preference; default is system
- [ ] Store spec with fake storage and fake `matchMedia`: choices persist and restore; system mode follows a media-query change; unavailable storage does not throw
- [ ] Pre-boot script in the document head applies the stored choice before the app renders
- [ ] `ui-segmented` exposes the value as a two-way model, takes options with label and optional icon, and is a single-choice group to assistive technology with the current option selected
- [ ] Segmented spec covers selection by click and keyboard, the model update, and ARIA state
- [ ] Theme switch on `/design-system` uses icons sun, moon and monitor with Vietnamese labels; the **Điều hướng** section demos the segmented control
- [ ] Contrast table values update after switching theme
- [ ] `dark:` variant configured to the theme attribute logic; the template scan still forbids it
- [ ] Verified in the browser and recorded in the pull request: reload in each of the three choices with the system theme light and dark, no flash
- [ ] Theme rules documented in the UI library conventions
- [ ] Checklist entry for the segmented control `done` with owner, pull request and the checks performed
- [ ] `npm run check` green; merged through its own pull request
