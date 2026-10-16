# 01: Core cannot import feature code statically

**What to build:** A lint guard that keeps core independent of features while still letting core lazy-load a feature's component. An ESLint `no-restricted-imports` rule on core forbids static imports (value and type) from features; dynamic `import()` stays allowed, so the dev features module's lazy loader for the migration board, and later the screen table's loaders, still pass. angular.md §4 states the rule: core may reference features only through lazy `import()`, and lint blocks static imports. This is the prefactor that fences core before the screen table adds loaders to it. See spec: `docs/specs/screen-definition.md`, Implementation Decisions → Import direction.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A static import from features in any core file fails lint (checked by temporarily adding one, then removing it)
- [ ] A type-only import from features in core also fails lint
- [ ] A dynamic `import()` of a feature component in core passes lint; the dev features module passes unchanged
- [ ] Spec files in core follow the same rule, or the exception is deliberate and noted in angular.md §4
- [ ] angular.md §4 describes the rule and the lazy-loader exception
- [ ] `npm run check` green
