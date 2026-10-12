# 07: Stepper organism

**What to build:** `ui-stepper` on CDK stepper: `.stepper` list with number or check per step, title and optional subtitle, `aria-current="step"` on the current one, `linear` mode, steps clickable when allowed. Replaces the stepper placeholder in **Điều hướng**. See spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] CDK stepper API read from installed types; selected index is an input/output
- [x] Done steps show the check icon and stay announced as done
- [x] Layout wraps at 375 px without horizontal scroll
- [x] Spec covers states, linear blocking and navigation output
- [x] Demo copies the course wizard steps; checklist entry `stepper` done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
