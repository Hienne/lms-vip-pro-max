import { Component, computed, inject } from '@angular/core';
import { Card, CardBody, MultiSelect } from '@lms/ui';
import { CourseEditorStore } from '../../../../data-access/course-editor.store';

/**
 * "Chia sẻ cho đơn vị khác" on step 4: tick the units the course is shared with as it is
 * published. Sharing only adds; the owner unit and units already shared show ticked and locked,
 * and revoking stays in the course list's "Chia sẻ" menu.
 */
@Component({
  selector: 'app-share-units',
  imports: [Card, CardBody, MultiSelect],
  templateUrl: './share-units.html',
  styleUrl: './share-units.scss',
})
export class ShareUnits {
  protected readonly store = inject(CourseEditorStore);

  protected readonly options = computed(() =>
    this.store.shareUnits$().map((unit) => ({
      value: String(unit.orgId),
      label:
        unit.name +
        (unit.locked === 'owner'
          ? ' (đơn vị sở hữu)'
          : unit.locked === 'shared'
            ? ' (đã chia sẻ)'
            : ''),
      disabled: unit.locked !== null || unit.full,
    })),
  );
  protected readonly selected = computed(() =>
    this.store
      .shareUnits$()
      .filter((unit) => unit.checked)
      .map((unit) => String(unit.orgId)),
  );
  protected select(values: readonly string[]): void {
    for (const unit of this.store.shareUnits$()) {
      const checked = values.includes(String(unit.orgId));
      if (checked !== unit.checked) this.store.toggleShare(unit.orgId, checked);
    }
  }
}
