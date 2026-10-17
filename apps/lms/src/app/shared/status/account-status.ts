import { Component, computed, input } from '@angular/core';
import type { AccountStatus as AccountStatusValue } from '@lms/contracts';
import { Badge } from '@lms/ui';
import type { StatusView } from './status-view';

/** The mockup's `ACC` plus the backend's `inactive`; a missing enum value is a compile error. */
const ACCOUNT_STATUS_VIEW: Record<AccountStatusValue, StatusView> = {
  active: { label: 'Hoạt động', tone: 'success', dot: true },
  suspended: { label: 'Tạm dừng', tone: 'warning', dot: true },
  locked: { label: 'Đã khóa', tone: 'danger', dot: true },
  inactive: { label: 'Ngừng hoạt động', tone: 'neutral', dot: true },
};

/** Account state of a user, as a badge with a status dot. */
@Component({
  selector: 'app-account-status',
  imports: [Badge],
  template: `<span uiBadge dot [tone]="view().tone">{{ view().label }}</span>`,
})
export class AccountStatus {
  readonly status = input.required<AccountStatusValue>();

  protected readonly view = computed(() => ACCOUNT_STATUS_VIEW[this.status()]);
}
