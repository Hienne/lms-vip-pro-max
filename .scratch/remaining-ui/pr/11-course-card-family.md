## Summary

`app-course-card` (one link), `app-journey`, `app-due-date` (injected `NOW`), `app-required-mark`; six cover tints as theme tokens with dark values.

```text
apps/lms/src/app/shared/course/
├── course-card.*  ├── journey.*
├── due-date.ts    ├── required-mark.ts
└── now.ts         # NOW token
libs/ui/src/styles/theme.css  # --color-cover-*
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
due-date.spec.ts at a fixed clock: 12 days → "Còn 12 ngày · 22/07/2026"; 2 days → warning; -2 → "Quá hạn 2 ngày"; done → "Hạn 08/07/2026".
```

## Merge Danger

**Door:** two-way

**Stacked on #10** (uses the course status schema): merge #10 first, then retarget this PR to `main`.

**Blast Radius:** theme tokens (all pages); `/design-system` learning + status sections
