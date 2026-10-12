## Summary

`uiSortableList` + `ui-sortable-item`: drag by handle or move buttons; emits `moved` `{from,to}`, never mutates; LiveAnnouncer message; focus stays on the moved item's button.

```text
<div uiSortableList label (moved)>
  <ui-sortable-item label>   # handle + content + up/down buttons
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
sortable.spec.ts: first item "Chuyển lên" disabled; down emits {from:0,to:1} and announces "Đã chuyển Bài 1 xuống vị trí 2".
```

## Merge Danger

**Door:** two-way

Moves `.sort-item` out of `feature-misc` in the inventory and registry. Pointer drag was checked in the browser with synthetic mouse events.

**Blast Radius:** `/design-system` navigation section; docs inventory
