# 05: Field and error summary molecules

**What to build:** `ui-field` wraps one projected native control (atoms from `@lms/ui`) with a visible label, required mark, hint and error messages, wiring `id`, `for`, `aria-describedby` and `aria-invalid` automatically. `ui-error-summary` lists errors as links that focus their field. Both work with Signal Forms. The **Form** section demo replaces its placeholder. See spec: UI pieces.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Label always visible and associated; hint and errors referenced by `aria-describedby`; control gets `aria-invalid` when errors exist
- [x] Works with input, select, textarea and checkbox atoms
- [x] Error summary has a heading, receives focus when shown, and its links focus the matching field
- [x] Specs cover ARIA wiring, error display, summary focus and link behaviour, using a Signal Forms host
- [x] Demo matches the mockup's form demo (copy included); checklist entry done
- [x] Keyboard and light/dark checked in the browser
- [ ] `npm run check` green; own pull request (skipped: delivered on a local integration branch, no PR)
