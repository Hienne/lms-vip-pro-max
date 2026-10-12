## Summary

`ui-stars` (display; score and count read once in a sentence) and `ui-rating` (radiogroup of "n sao", roving focus, arrow keys choose).

```text
<ui-stars [value] [count]>        # aria-hidden glyphs + sr-only sentence
<ui-rating [(value)]>              # role=radiogroup > 5 x role=radio
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
rating.spec.ts: ArrowRight from star 1 → value 2, focus on star 2; Left at 1 wraps to 5; click emits the value.
```

## Merge Danger

**Door:** two-way

Splits the rating demo from the Hỏi đáp placeholder.

**Blast Radius:** `/design-system` learning section
