import { Component, inject } from '@angular/core';
import { Card, CardBody, Checkbox } from '@lms/ui';
import { CourseEditorStore } from '../../../../data-access/course-editor.store';

/**
 * "Chia sẻ cho đơn vị khác" on step 4: tick the units the course is shared with as it is
 * published. Sharing only adds; the owner unit and units already shared show ticked and locked,
 * and revoking stays in the course list's "Chia sẻ" menu.
 */
@Component({
  selector: 'app-share-units',
  imports: [Card, CardBody, Checkbox],
  templateUrl: './share-units.html',
  styleUrl: './share-units.scss',
})
export class ShareUnits {
  protected readonly store = inject(CourseEditorStore);

  protected toggle(orgId: number, event: Event): void {
    this.store.toggleShare(orgId, (event.target as HTMLInputElement).checked);
  }
}
