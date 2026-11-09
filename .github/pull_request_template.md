## What and why

<!-- One or two sentences: what changes and which migration entry or ticket it serves. -->

## Checks

- [ ] `npm run check` is green (format, lint, typecheck, tests, build)
- [ ] `npm run guard:design` passes and `design-drift.baseline.json` only went down (or is unchanged)
- [ ] UI change: screenshots attached at 1280 and 375 px, light and dark, beside the screen it copies the structure of (`/progress` for a new screen)
- [ ] angular.md §14 checklist passes ([docs/conventions/angular.md](../docs/conventions/angular.md))
- [ ] Converted screen or UI piece: verify step in [docs/migration/mockup-to-angular.md](../docs/migration/mockup-to-angular.md) done, and each verify check ticked in the registry was actually performed
  - [ ] Side by side with the mockup at 375, 768 and 1280 px, light and dark
  - [ ] Keyboard-only pass
  - [ ] Each error state forced and rendered with retry (screens only)
- [ ] Migration checklist updated in this pull request: `apps/lms/src/app/features/design-system/data-access/migration-entries.data.ts` (status, owner, this pull request's link, verify checks)

## Verification notes

<!-- What you checked and how. Differences from the mockup that are deliberate (a11y fix, removed hardcoded value). -->
