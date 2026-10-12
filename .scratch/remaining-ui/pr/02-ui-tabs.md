## Summary

`ui-tabs` + `[uiTabPanel]`: arrow/Home/End keys, count in the accessible name ("Khóa học 6"), `selected` two-way model.

```text
<ui-tabs [tabs] [(selected)]>
  <div uiTabPanel="overview">
  <div uiTabPanel="courses">
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
tabs.spec.ts: ArrowRight → selected = courses, focus moves, panel switches; End/Home jump; click selects.
```

## Merge Danger

**Door:** two-way

Replaces the tabs placeholder in Điều hướng.

**Blast Radius:** `/design-system` navigation section
