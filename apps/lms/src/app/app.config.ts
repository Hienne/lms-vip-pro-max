import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideRouter,
  TitleStrategy,
  withInMemoryScrolling,
} from '@angular/router';
import { environment } from '../environments/environment';
import { createAppRoutes } from './app.routes';
import { parseAppConfig, provideAppConfig } from './core/config/app-config';
import { DEV_FEATURES } from './core/dev/dev-features';
import { provideAppErrorHandler } from './core/errors/app-error-handler';
import { apiBaseUrlInterceptor } from './core/http/api-base-url.interceptor';
import { AppTitleStrategy } from './core/routing/page-title.strategy';
import { provideSession } from './core/session/session.provider';

const config = parseAppConfig(environment);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppErrorHandler(),
    provideAppConfig(config),
    provideSession(),
    provideRouter(
      createAppRoutes(config),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
    ),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    provideHttpClient(
      withInterceptors([
        apiBaseUrlInterceptor,
        ...(config.mockScenarios ? DEV_FEATURES.interceptors : []),
      ]),
    ),
  ],
};
