import { Component, computed, inject, input } from '@angular/core';
import { APP_CONFIG } from '../../../../../core/config/app-config';
import {
  migrationEntry,
  STATUS_LABEL,
  type MigrationEntryId,
} from '../../../data-access/migration-registry';

/**
 * A demo frame on /design-system. It shows its content once every migration entry in `needs`
 * is done; until then it shows the "Chưa migrate" placeholder. The migration checklist decides,
 * never the author: a later ticket flips an entry to `done` and the demo appears.
 * Production shows the status only; owner and pull request are development/staging details.
 */
@Component({
  selector: 'app-ds-demo',
  templateUrl: './demo.html',
})
export class DsDemo {
  readonly needs = input.required<readonly MigrationEntryId[]>();
  readonly label = input('');
  /** `dashed` is the mockup's demo frame; `card` is a plain card for sections the mockup lays out as one. */
  readonly frame = input<'dashed' | 'card'>('dashed');

  protected readonly showDetails = inject(APP_CONFIG).devTools;

  protected readonly pending = computed(() =>
    this.needs()
      .map((id) => migrationEntry(id))
      .filter((entry) => entry.status !== 'done')
      .map((entry) => ({
        id: entry.id,
        status: STATUS_LABEL[entry.status],
        owner: entry.owner,
        pullRequest: entry.pullRequest,
      })),
  );
}
