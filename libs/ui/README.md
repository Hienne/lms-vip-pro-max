# @lms/ui

The design system: tokens, atoms and molecules, domain-agnostic. Public API: `src/index.ts`.
Rules: [docs/conventions/ui-library.md](../../docs/conventions/ui-library.md). The living catalogue
is the app's `/design-system` route; the progress of the conversion from the mockup is the
migration checklist (`apps/lms/src/app/features/design-system/data-access/migration-entries.data.ts`).

- `src/styles/ui/`: the `ui` Sass module (token maps, accessor functions, mixins), `global.scss`: the global entry,
  `components.scss`: one partial per atom in `components/`.
- `src/lib/atoms/`, `src/lib/molecules/`: one folder per piece with its spec.

Run `npx nx test ui` for the unit tests.
