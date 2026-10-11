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
  /** Shows the dev toolbar that drives Prism's `Prefer` header. Development only. */
  mockScenarios: z.boolean(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type AppConfigInput = z.input<typeof AppConfigSchema>;

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

/** Parses the environment once and provides it as `APP_CONFIG`. Throws on invalid input. */
export function provideAppConfig(input: AppConfigInput): EnvironmentProviders {
  const result = AppConfigSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return makeEnvironmentProviders([
    { provide: APP_CONFIG, useValue: Object.freeze(result.data) },
  ]);
}
