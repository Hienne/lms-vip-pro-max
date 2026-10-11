import type { AppConfigInput } from './app-config';

/** A valid development config for specs; override only what the spec is about. */
export function testAppConfig(
  overrides: Partial<AppConfigInput> = {},
): AppConfigInput {
  return {
    name: 'development',
    production: false,
    apiBaseUrl: '',
    mockScenarios: false,
    devTools: true,
    ...overrides,
  };
}
