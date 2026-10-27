import { Component, input } from '@angular/core';
import { Badge } from '@lms/ui';

/**
 * A role as a neutral badge with the name the server sends. A role is a category, not a state, so
 * every role looks the same (visual-design.md: status tones only on state).
 */
@Component({
  selector: 'app-role-badge',
  imports: [Badge],
  template: `<span uiBadge tone="neutral">{{ name() }}</span>`,
})
export class RoleBadge {
  readonly name = input.required<string>();
}
