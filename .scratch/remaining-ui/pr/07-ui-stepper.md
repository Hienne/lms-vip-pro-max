## Summary

`ui-stepper`: `selectedIndex` model, `linear` mode, done/current/upcoming with `aria-current="step"`.

```text
<ui-stepper [steps] [linear] [(selectedIndex)]>
  div[cdkStepper]
    ol > li > button[cdkStepHeader]
    cdk-step x N
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
stepper.spec.ts: linear blocks jumping to step 4; completed:true on step 2 allows step 3; ArrowRight moves focus.
```

## Merge Danger

**Door:** two-way

Touches `dialog-drawer-demo.spec.ts`: its "Xuất bản" button lookup is now scoped to the dialog (the stepper has a button with the same text).

**Blast Radius:** `/design-system` navigation section
