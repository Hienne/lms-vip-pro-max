import type { AppConfigInput } from '../app/core/config/app-config';

/**
 * Staging (`nx build lms -c staging`).
 * TODO(backend): set apiBaseUrl to the staging API origin, e.g. 'https://<staging-api-host>';
 * '' means the API is served from the same origin as the app.
 */
export const environment: AppConfigInput = {
  name: 'staging',
  production: true,
  apiBaseUrl: '',
  mockScenarios: false,
};
