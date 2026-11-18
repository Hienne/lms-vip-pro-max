import { Component } from '@angular/core';
import { Badge, Icon } from '@lms/ui';

/**
 * "AI đề xuất" beside a field, row or question the assistant wrote and the author has not changed
 * since: the one marker of a drafting session's proposals on the editor page.
 */
@Component({
  selector: 'app-suggested-mark',
  imports: [Badge, Icon],
  template: `<span uiBadge
    ><ui-icon name="sparkles" size="sm" />AI đề xuất</span
  >`,
  styleUrl: './suggested-mark.scss',
})
export class SuggestedMark {}
