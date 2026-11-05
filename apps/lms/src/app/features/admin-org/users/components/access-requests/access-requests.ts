import { Component, DestroyRef, inject } from '@angular/core';
import { AccessRequestsStore } from '../../data-access/access-requests.store';

/** The "Yêu cầu" panel of the Người dùng screen: the table of visitors' requests (SPEC-access-requests). */
@Component({
  selector: 'app-access-requests',
  template: ``,
})
export class AccessRequests {
  protected readonly store = inject(AccessRequestsStore);

  constructor() {
    // The list is read only while this panel exists.
    this.store.showList();
    inject(DestroyRef).onDestroy(() => this.store.hideList());
  }
}
