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
    // @lucide/angular is wrapped once, by ui-icon in libs/ui (docs/conventions/ui-library.md → Icons).
    files: ['apps/**/*.ts', 'libs/contracts/**/*.ts', 'libs/mocks/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@lucide/angular',
              message:
                'Use <ui-icon> from @lms/ui; it is the only wrapper around @lucide/angular.',
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
    files: ['**/*.spec.ts', '**/test-setup.ts'],
    rules: {
      '@nx/enforce-module-boundaries': boundaries(specDepConstraints),
    },
  },
];
