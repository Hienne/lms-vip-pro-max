import { Service } from '@angular/core';
import { invalidation } from '../data-access/invalidation';

/**
 * Says that the instructor's questions changed (one was answered), so the header bell reads the
 * count again. A change counter, not data: the notifications page bumps it and the bell reloads on
 * it, so neither knows the other.
 */
@Service()
export class InstructorFeedbackChanged {
  private readonly change = invalidation();

  readonly version = this.change.version;

  bump(): void {
    this.change.bump();
  }
}
