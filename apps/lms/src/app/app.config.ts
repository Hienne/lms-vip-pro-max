import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { environment } from '../environments/environment';
import { createAppRoutes } from './app.routes';
import { parseAppConfig, provideAppConfig } from './core/config/app-config';
import { provideAppErrorHandler } from './core/errors/app-error-handler';
import { apiBaseUrlInterceptor } from './core/http/api-base-url.interceptor';
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
      withInMemoryScrolling({ anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
  ],
};
