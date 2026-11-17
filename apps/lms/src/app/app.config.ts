import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideRouter,
  TitleStrategy,
  withInMemoryScrolling,
  withNavigationErrorHandler,
} from '@angular/router';
import { environment, mockInterceptors } from '../environments/environment';
import { createAppRoutes } from './app.routes';
import { parseAppConfig, provideAppConfig } from './core/config/app-config';
import { DEV_FEATURES } from './core/dev/dev-features';
import { provideAppErrorHandler } from './core/errors/app-error-handler';
import {
  offerReloadOnStaleNavigation,
  provideStaleBuildRecovery,
} from './core/errors/stale-build';
import { envelopeInterceptor } from './core/http/envelope.interceptor';
import { bearerInterceptor } from './core/http/bearer.interceptor';
import { requestIdInterceptor } from './core/http/request-id.interceptor';
import { sessionExpiryInterceptor } from './core/http/session-expiry.interceptor';
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
      withNavigationErrorHandler(offerReloadOnStaleNavigation),
    ),
    provideStaleBuildRecovery(),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    provideHttpClient(
      withInterceptors([
        sessionExpiryInterceptor,
        envelopeInterceptor,
        bearerInterceptor,
        requestIdInterceptor,
        ...DEV_FEATURES.interceptors,
        ...(config.mockApi ? mockInterceptors : []),
      ]),
    ),
  ],
};
