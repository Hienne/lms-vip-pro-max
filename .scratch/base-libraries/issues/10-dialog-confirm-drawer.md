# 10: Dialog, confirm and drawer

**What to build:** On CDK Dialog: a styled dialog shell (`ConfirmDialog` organism with title, message, confirm/cancel, danger variant), a `confirm()` helper returning `Observable<boolean>`, and a drawer presentation (side panel, start/end) for the future mobile sidebar and detail panels. Both trap focus, close on Escape and backdrop, and restore focus. Demos replace modal and drawer placeholders. See spec: UI pieces.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `confirm()` resolves true on confirm, false on cancel, Escape or backdrop
- [x] Dialog labelled by its title, described by its message; danger variant uses the danger button
- [x] Drawer slides with the motion tokens, respects reduced motion, full width on narrow screens
- [x] Specs cover results, focus trap and restore, ARIA labelling
- [x] Demos and checklist entries updated; keyboard and light/dark checked
- [ ] `npm run check` green; own pull request (skipped: no PR, branch only) (skipped: delivered on a local integration branch, no PR)
