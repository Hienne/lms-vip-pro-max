import { Directive } from '@angular/core';

/** Overlapping row of `ui-avatar`s: `<div uiAvatarGroup aria-label="Nhóm"><ui-avatar … /></div>`. */
@Directive({
  selector: '[uiAvatarGroup]',
  host: { class: 'avatar-group', role: 'group' },
})
export class AvatarGroup {}
