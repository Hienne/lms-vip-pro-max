# 11: Toaster

**What to build:** A root, presentation-only `Toaster` service with `success`, `error`, `warning`, `info` methods, rendering stacked toasts on a CDK overlay with auto-dismiss (paused on hover and focus), a close button, and the text also sent to `LiveAnnouncer`. Demo buttons replace the toast placeholder. See spec: UI pieces.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Look and placement match the mockup's toasts; stack order and max count defined
- [x] Auto-dismiss pauses on hover and focus; errors stay until closed
- [x] Every toast is announced (assertive for errors, polite otherwise)
- [x] Spec covers show, dismiss, timer pause and announcement (fake timers)
- [x] Demo and checklist entry updated; light/dark checked
- [ ] `npm run check` green; own pull request (skipped: delivered on a local integration branch, no PR)
