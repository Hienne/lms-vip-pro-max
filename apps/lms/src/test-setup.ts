import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed();

// A token left in storage by one test would restore a user in the next one; so would a chat.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
