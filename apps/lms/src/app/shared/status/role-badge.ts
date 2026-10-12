import { booleanAttribute, Component, computed, input } from '@angular/core';
import type { Role } from '@lms/contracts';
import { Badge } from '@lms/ui';
import type { StatusView } from './status-view';

/** The mockup's `ROLE`; a missing enum value is a compile error. */
const ROLE_VIEW: Record<Role, StatusView> = {
  learner: { label: 'Học viên', tone: 'primary' },
  instructor: { label: 'Giảng viên', tone: 'info' },
  admin: { label: 'Quản trị viên', tone: 'warning' },
  viewer: { label: 'Lãnh đạo', tone: 'neutral', outline: true },
};

/** A user's role as a badge; `scoped` marks a role limited to one unit ("… đơn vị"). */
@Component({
  selector: 'app-role-badge',
  imports: [Badge],
  template: `<span
    uiBadge
    [tone]="view().tone"
    [outline]="view().outline ?? false"
    >{{ view().label }}{{ scoped() ? ' đơn vị' : '' }}</span
  >`,
})
export class RoleBadge {
  readonly role = input.required<Role>();
  readonly scoped = input(false, { transform: booleanAttribute });

  protected readonly view = computed(() => ROLE_VIEW[this.role()]);
}
