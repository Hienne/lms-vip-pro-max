import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'lms.mockRole';

function stored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Which role's example Prism answers with for role-dependent endpoints. Prism is stateless, so
 * signing in as another demo user changes nothing on the next `GET profile` unless the request
 * says which example it wants; the choice is kept for the tab so a reload does not lose it.
 */
@Injectable({ providedIn: 'root' })
export class MockScenario {
  private readonly state = { role: signal<string | null>(stored()) };

  /** An example name of `@lms/mocks` (`learner`, `unit-admin`, ...), or null for Prism's default. */
  readonly role$ = this.state.role.asReadonly();

  setRole(role: string | null): void {
    this.state.role.set(role);
    try {
      if (role) sessionStorage.setItem(STORAGE_KEY, role);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private mode or blocked storage: the choice just does not survive a reload.
    }
  }
}
