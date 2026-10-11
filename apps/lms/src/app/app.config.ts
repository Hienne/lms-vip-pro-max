import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';
import { provideAppConfig } from './core/config/app-config';
import { apiBaseUrlInterceptor } from './core/http/api-base-url.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppConfig(environment),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
  ],
};
