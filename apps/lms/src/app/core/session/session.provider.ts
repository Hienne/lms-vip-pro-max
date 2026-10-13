import {
  makeEnvironmentProviders,
  provideAppInitializer,
  inject,
  type EnvironmentProviders,
} from '@angular/core';
import { SessionStore } from './session.store';

/** The one `SessionStore` of the app, restoring the signed-in user at boot. */
export function provideSession(): EnvironmentProviders {
  return makeEnvironmentProviders([
    SessionStore,
    provideAppInitializer(() => inject(SessionStore).restore()),
  ]);
}
