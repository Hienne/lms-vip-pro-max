## Summary

`ui-timer` (seconds in, `mm:ss`, low state with icon swap + spoken label) and `app-question-grid` / `app-question-legend` (cell names "Câu 3, đã trả lời, đã đánh dấu", `goto` output).

```text
<ui-timer [seconds] [lowAt=60]>
<app-question-grid [cells] [current] (goto)>
<app-question-legend>
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
question-grid.spec.ts: cell 3 is named "Câu 3, đã trả lời, đã đánh dấu"; click on cell 8 emits goto(7).
```

## Merge Danger

**Door:** two-way

Splits `feature-quiz-parts` into `timer` and `question-grid` in the registry and inventory.

**Blast Radius:** `/design-system` learning section; docs inventory
