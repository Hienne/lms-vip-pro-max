import nx from '@nx/eslint-plugin';

/** Module boundaries: docs/conventions/workspace.md → Module boundaries. */
const depConstraints = [
  {
    sourceTag: 'type:app',
    onlyDependOnLibsWithTags: ['type:ui', 'type:contracts'],
  },
  { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:ui'] },
  { sourceTag: 'type:contracts', onlyDependOnLibsWithTags: [] },
  { sourceTag: 'type:mocks', onlyDependOnLibsWithTags: ['type:contracts'] },
  {
    sourceTag: 'type:mock-server',
    onlyDependOnLibsWithTags: ['type:contracts', 'type:mocks'],
  },
];

/** Specs may also use fixtures from @lms/mocks; production code may not. */
const specDepConstraints = depConstraints.map((c) =>
  c.sourceTag === 'type:app' || c.sourceTag === 'type:ui'
    ? {
        ...c,
        onlyDependOnLibsWithTags: [...c.onlyDependOnLibsWithTags, 'type:mocks'],
      }
    : c,
);

const boundaries = (constraints) => [
  'error',
  {
    enforceBuildableLibDependency: true,
    allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
    depConstraints: constraints,
  },
];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      'lms-mockup/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs', '**/*.mts'],
    rules: {
      '@nx/enforce-module-boundaries': boundaries(depConstraints),
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.spec.ts', '**/test-setup.ts'],
    rules: {
      '@nx/enforce-module-boundaries': boundaries(specDepConstraints),
    },
  },
];
