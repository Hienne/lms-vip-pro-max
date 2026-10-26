import { Service } from '@angular/core';
import { invalidation } from '../data-access/invalidation';

/**
 * Says that the learner's due reminders changed (one was read), so the header bell reads them
 * again. A change counter, not data: the notifications page bumps it and the shell store reloads
 * on it, so neither knows the other.
 */
@Service()
export class RemindersChanged {
  private readonly change = invalidation();

  readonly version = this.change.version;

  bump(): void {
    this.change.bump();
  }
}
