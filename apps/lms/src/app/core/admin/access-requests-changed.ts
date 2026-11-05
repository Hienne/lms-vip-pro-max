import { Service } from '@angular/core';
import { invalidation } from '../data-access/invalidation';

/**
 * Says that an access request was resolved (rejected here, approved or answered by another
 * module), so the Người dùng tab's pending count and the requests list read again. A change
 * counter, not data: whoever resolves a request bumps it and the store reloads on it.
 */
@Service()
export class AccessRequestsChanged {
  private readonly change = invalidation();

  readonly version = this.change.version;

  bump(): void {
    this.change.bump();
  }
}
