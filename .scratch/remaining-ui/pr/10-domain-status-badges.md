## Summary

`CourseStatusSchema` in `@lms/contracts`; `app-course-status`, `app-publish-status`, `app-account-status`, `app-role-badge` built on `uiBadge` with exhaustive label/tone records.

```text
libs/contracts/src/lib/learning/learning.schema.ts   # CourseStatusSchema
apps/lms/src/app/shared/status/
├── course-status.ts  ├── publish-status.ts
├── account-status.ts └── role-badge.ts
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
learning.schema.spec.ts: parses the 4 values, rejects "paused"/"Completed"/1. Each badge spec runs every enum value against the mockup's labels and tones.
```

## Merge Danger

**Door:** two-way

Adds a public export to `@lms/contracts`.

**Blast Radius:** `@lms/contracts` index; `/design-system` status section
