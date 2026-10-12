## Summary

`ui-tree`: `expanded` ids and `selected` id as models, `trailing` template per node (e.g. publish badge), WAI-ARIA keys.

```text
<ui-tree [nodes] [trailing] [(expanded)] [(selected)]>
  ul[ngTree] > li[ngTreeItem] > ul[role=group] > ng-template[ngTreeItemGroup]
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
tree.spec.ts: Right opens, Left closes, Down/End/Home move focus, Enter selects, click expands and selects.
```

## Merge Danger

**Door:** two-way

Domain → program → course sample in the demo.

**Blast Radius:** `/design-system` navigation section
