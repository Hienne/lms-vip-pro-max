import { Component, computed, input } from '@angular/core';
import { Badge } from '@lms/ui';
import type { StatusView } from './status-view';

type Tone = Pick<StatusView, 'tone' | 'outline'>;

/** Tones of the backend's five roles; a role it adds later is a neutral outline. */
const ROLE_TONE: Readonly<Record<string, Tone>> = {
  SUPER_ADMIN: { tone: 'danger' },
  ADMIN: { tone: 'warning' },
  INSTRUCTOR: { tone: 'info' },
  LEARNER: { tone: 'primary' },
  REPORT_VIEWER: { tone: 'neutral', outline: true },
};
const OTHER_TONE: Tone = { tone: 'neutral', outline: true };

/** A role as a badge: the backend's role code picks the tone, its name is the text. */
@Component({
  selector: 'app-role-badge',
  imports: [Badge],
  template: `<span
    uiBadge
    [tone]="view().tone"
    [outline]="view().outline ?? false"
    >{{ name() }}</span
  >`,
})
export class RoleBadge {
  /** The role's `code`, e.g. `LEARNER`. */
  readonly code = input.required<string>();
  readonly name = input.required<string>();

  protected readonly view = computed(
    () => ROLE_TONE[this.code()] ?? OTHER_TONE,
  );
}
