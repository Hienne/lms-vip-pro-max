import type { AppConfigInput } from '../app/core/config/app-config';

/**
 * Development (default: `nx serve lms`, unit tests).
 * `/api` stays same-origin and the dev server proxies it to Prism on :4010
 * (apps/lms/proxy.conf.json).
 */
export const environment: AppConfigInput = {
  name: 'development',
  production: false,
  apiBaseUrl: '',
  mockScenarios: true,
  devTools: true,
};
