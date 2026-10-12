# 07: Empty and error state molecules

**What to build:** `ui-empty` (icon, title, description, action slot) and `ui-error-state` (icon, title, message, `retry` output with a retry button, optional secondary action). They render any failure as a consistent block; the app passes an `AppError`'s message in. Demos replace the placeholder in **Phản hồi hệ thống**. See spec: UI pieces.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Layout and copy match the mockup's empty and error demos
- [x] Retry button emits `retry`; heading level configurable
- [x] Spec covers rendering and the output
- [x] Demo and checklist entry updated; light/dark checked
- [ ] `npm run check` green; own pull request (skipped: delivered on a local integration branch, no PR)
