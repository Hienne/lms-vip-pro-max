import { booleanAttribute, Component, computed, input } from '@angular/core';
import { Badge } from '@lms/ui';
import type { StatusView } from './status-view';

type Tone = Pick<StatusView, 'tone' | 'outline'>;

/** The mockup's `ROLE` tones for the four system roles; any other role is a neutral outline. */
const SYSTEM_TONE: Readonly<Record<string, Tone>> = {
  learner: { tone: 'primary' },
  instructor: { tone: 'info' },
  admin: { tone: 'warning' },
  viewer: { tone: 'neutral', outline: true },
};
const CUSTOM_TONE: Tone = { tone: 'neutral', outline: true };

/**
 * A role's name for prose that cannot use the badge. The "đơn vị" suffix marks an administrator
 * limited to one unit (the mockup's "Quản trị viên đơn vị").
 */
export function roleText(account: {
  roleId: string;
  roleName: string;
  scopeUnitId: string | null;
}): string {
  return account.roleName + (isUnitAdmin(account) ? ' đơn vị' : '');
}

/** An `admin` limited to one unit; every other role's scope is just where its data comes from. */
export function isUnitAdmin(account: {
  roleId: string;
  scopeUnitId: string | null;
}): boolean {
  return account.roleId === 'admin' && account.scopeUnitId !== null;
}

/** A user's role as a badge; `scoped` marks an administrator limited to one unit ("… đơn vị"). */
@Component({
  selector: 'app-role-badge',
  imports: [Badge],
  template: `<span
    uiBadge
    [tone]="view().tone"
    [outline]="view().outline ?? false"
    >{{ name() }}{{ scoped() ? ' đơn vị' : '' }}</span
  >`,
})
export class RoleBadge {
  readonly roleId = input.required<string>();
  readonly name = input.required<string>();
  readonly scoped = input(false, { transform: booleanAttribute });

  protected readonly view = computed(
    () => SYSTEM_TONE[this.roleId()] ?? CUSTOM_TONE,
  );
}
