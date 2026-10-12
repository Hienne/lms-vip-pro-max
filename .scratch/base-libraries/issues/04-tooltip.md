# 04: Tooltip directive

**What to build:** `uiTooltip`, a behaviour directive on a CDK overlay that shows text on hover and keyboard focus, hides on Escape and blur, and links the trigger with `aria-describedby`. `uiIconButton` uses it for its label instead of the native `title`. Demoed on `/design-system`. See spec: UI pieces.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Shows on hover and focus after a short delay, hides on leave, blur and Escape; positions with fallbacks inside the viewport
- [x] Trigger gets `aria-describedby` while visible; tooltip has `role="tooltip"`
- [x] Icon buttons show the tooltip; no native `title` remains
- [x] Respects reduced motion; styled from tokens in light and dark
- [x] Spec covers show/hide triggers, Escape and ARIA; icon-button spec updated
- [x] Demo added, checklist entry done with owner and pull request
- [ ] `npm run check` green; own pull request (skipped: delivered on a local integration branch, no PR)
