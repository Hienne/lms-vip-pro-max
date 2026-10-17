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
];

/** Specs and their `*.testing.ts` helpers may also use fixtures from @lms/mocks; production code may not. */
const specDepConstraints = depConstraints.map((c) =>
  c.sourceTag === 'type:app' || c.sourceTag === 'type:ui'
    ? {
        ...c,
        onlyDependOnLibsWithTags: [...c.onlyDependOnLibsWithTags, 'type:mocks'],
      }
    : c,
);

const lucidePath = {
  name: '@lucide/angular',
  message:
    'Use <ui-icon> from @lms/ui; it is the only wrapper around @lucide/angular.',
};

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
    // @lucide/angular is wrapped once, by ui-icon in libs/ui (docs/conventions/ui-library.md → Icons).
    files: ['apps/**/*.ts', 'libs/contracts/**/*.ts', 'libs/mocks/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [lucidePath] }],
    },
  },
  {
    // Core reaches features only through a lazy `import()` (angular.md §4); the rule does not
    // look at dynamic imports. A later block replaces the rule's options, so the Lucide path is
    // repeated.
    files: ['apps/lms/src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [lucidePath],
          patterns: [
            {
              group: ['**/features', '**/features/**'],
              message:
                'Core may name feature code only in a lazy import(); a static import couples core to a feature (angular.md §4).',
            },
          ],
        },
      ],
    },
  },
  {
    // The in-app mock API, and the one environment file that wires it, may use the fixtures.
    files: [
      '**/src/environments/environment.ts',
      '**/src/app/core/dev/mock-api/**/*.ts',
    ],
    rules: {
      '@nx/enforce-module-boundaries': boundaries(specDepConstraints),
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.testing.ts', '**/test-setup.ts'],
    rules: {
      '@nx/enforce-module-boundaries': boundaries(specDepConstraints),
    },
  },
];
