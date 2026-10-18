import {
  InjectionToken,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { z } from 'zod';

/**
 * Runtime configuration of one build environment.
 * Values come from `src/environments/environment*.ts` (swapped per build
 * configuration via `fileReplacements`) and are validated at bootstrap, so a
 * broken environment file fails at startup instead of mid-session.
 * These files ship to the browser: never put secrets here.
 */
export const AppConfigSchema = z.object({
  name: z.enum(['development', 'staging', 'production']),
  production: z.boolean(),
  /**
   * Origin prepended to every `/api/...` request by `apiBaseUrlInterceptor`.
   * Empty string = same origin (dev-server proxy or a reverse proxy in front of the app).
   * Endpoint paths themselves live in `@lms/contracts`, not here.
   */
  apiBaseUrl: z
    .union([z.literal(''), z.url({ protocol: /^https?$/ })])
    .refine((url) => !url.endsWith('/'), {
      error: 'apiBaseUrl must not end with "/"',
    }),
  /**
   * Turns the in-app mock API on: it answers the endpoints the backend does not have (role
   * management, a user's courses, attempts and activity, the shell badges) from fixtures. Only the
   * development environment file also supplies the mock interceptor (`mockInterceptors`), so
   * staging and production bundles hold no fixtures.
   */
  mockApi: z.boolean(),
  /**
   * With `mockApi`, the mock also answers the endpoints the backend does have, from a seeded
   * in-memory copy of its demo database, and the dev toolbar can sign in as a demo user. Turn it
   * off to send those endpoints to the real backend while the mock-only ones stay mocked.
   */
  mockBackend: z.boolean(),
  /**
   * Internal tooling for the team: the migration progress board and owner/pull request details on
   * the design-system placeholders. True in development and staging, false in production, so
   * internal names and pull request links never reach end users.
   */
  devTools: z.boolean(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type AppConfigInput = z.input<typeof AppConfigSchema>;

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

/** Parses an environment file. Throws on invalid input, naming the offending field. */
export function parseAppConfig(input: AppConfigInput): AppConfig {
  const result = AppConfigSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return Object.freeze(result.data);
}

/** Parses the environment once and provides it as `APP_CONFIG`. Throws on invalid input. */
export function provideAppConfig(input: AppConfigInput): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: APP_CONFIG, useValue: parseAppConfig(input) },
  ]);
}
