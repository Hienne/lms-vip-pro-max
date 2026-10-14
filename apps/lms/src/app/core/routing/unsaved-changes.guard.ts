import { inject, Injectable } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { type Observable, of } from 'rxjs';

/** A routed component with a form implements this to be asked about before it is left. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

export function hasUnsavedChanges(page: unknown): boolean {
  return (
    typeof (page as Partial<HasUnsavedChanges> | null)?.hasUnsavedChanges ===
      'function' && (page as HasUnsavedChanges).hasUnsavedChanges()
  );
}

/**
 * The question "leave this page?", answered by whoever owns the dialog (the shell). The route
 * table only knows this seam, so it does not pull the UI library into the initial bundle; with no
 * asker registered (no shell yet) leaving is allowed.
 */
@Injectable({ providedIn: 'root' })
export class LeavePrompt {
  private asker?: () => Observable<boolean>;

  use(asker: () => Observable<boolean>): void {
    this.asker = asker;
  }

  ask(): Observable<boolean> {
    return this.asker?.() ?? of(true);
  }
}

/**
 * Asks before leaving a page whose component reports unsaved changes (the mockup's `guardFn`);
 * pages without the method leave freely. `beforeunload` for reload and tab close is the shell's job.
 */
export const unsavedChangesGuard: CanDeactivateFn<unknown> = (page) =>
  hasUnsavedChanges(page) ? inject(LeavePrompt).ask() : true;
