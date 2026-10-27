import { Component, input } from '@angular/core';
import { Badge } from '@lms/ui';

/**
 * Whether a course is required ("Bắt buộc") or optional ("Tự chọn"), as a neutral badge: it is a
 * category, not a state, so it never takes a status tone.
 */
@Component({
  selector: 'app-required-mark',
  imports: [Badge],
  template: `@if (required()) {
      <span uiBadge>Bắt buộc</span>
    } @else {
      <span uiBadge outline>Tự chọn</span>
    }`,
})
export class RequiredMark {
  readonly required = input.required<boolean>();
}
