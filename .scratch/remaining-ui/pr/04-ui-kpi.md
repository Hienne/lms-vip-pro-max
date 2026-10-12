## Summary

`ui-kpi`: toned icon, tabular value, suffix, label, delta; `href` makes the whole card one router link.

```text
<ui-kpi icon value label [suffix] [delta] [tone] [href]>
  <div|a uiCard>  # a when href is set
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
kpi.spec.ts: with href exactly one `<a>` named "3 Quá hạn"; tones map to `kpi__icon--*`.
```

## Merge Danger

**Door:** two-way

Row of four KPIs as in the mockup.

**Blast Radius:** `/design-system` data section
