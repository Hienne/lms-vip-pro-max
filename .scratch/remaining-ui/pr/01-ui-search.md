## Summary

`ui-search`: search input with decorative icon; debounced `searched` output, immediate on Enter or clear.

```text
libs/ui/src/lib/molecules/search/
└── search.ts          # input[type=search] + icon, debounce 300ms
libs/ui/src/styles/components/_search.scss  # .input-icon
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
search.spec.ts: type "c","co","cor" with 200ms gaps → no emit; +300ms → emits "cor" once. Enter → emits immediately. Clear → emits "" immediately.
```

## Merge Danger

**Door:** two-way

Demo block under Form & nhập liệu on `/design-system`.

**Blast Radius:** `/design-system` forms section
