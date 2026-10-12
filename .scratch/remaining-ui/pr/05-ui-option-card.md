## Summary

`ui-option-card`: a label around a projected native radio/checkbox; `tone` turns it into a correct/wrong review row with icon and text.

```text
<ui-option-card title [letter] [description]>
  <input type=radio|checkbox>      # native, form binding untouched
<ui-option-card tone="correct|wrong|neutral" [chosen]>
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
option-card.spec.ts: label click checks the radio; wrong+chosen shows X icon named "Sai" and "Bạn chọn"; no "Đáp án đúng".
```

## Merge Danger

**Door:** two-way

Adds a `neutral` review tone for unmarked rows (used by the demo).

**Blast Radius:** `/design-system` forms section
