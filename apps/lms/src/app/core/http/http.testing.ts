import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { envelopeInterceptor } from './envelope.interceptor';

/**
 * `HttpClient` for specs that talk to the backend through `EndpointClient`: the envelope
 * interceptor is installed, so a spec flushes `envelopeOk(data)` or `envelopeError(…)` exactly as
 * the backend would answer. `interceptors` are added before it, e.g. the session-expiry one.
 */
export function provideEnvelopeHttpClient(
  ...interceptors: Parameters<typeof withInterceptors>[0]
): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withInterceptors([...interceptors, envelopeInterceptor])),
    provideHttpClientTesting(),
  ];
}
