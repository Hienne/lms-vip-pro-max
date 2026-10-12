import { Component, computed, input } from '@angular/core';
import type { PublishStatus as PublishStatusValue } from '@lms/contracts';
import { Badge } from '@lms/ui';
import type { StatusView } from './status-view';

/** The mockup's `PUB`; a missing enum value is a compile error. */
const PUBLISH_STATUS_VIEW: Record<PublishStatusValue, StatusView> = {
  draft: { label: 'Nháp', tone: 'neutral', outline: true, dot: true },
  published: { label: 'Đã xuất bản', tone: 'success', dot: true },
  paused: { label: 'Tạm dừng', tone: 'warning', dot: true },
  locked: { label: 'Đã khóa', tone: 'danger', dot: true },
};

/** Publish state of a course or content node, as a badge with a status dot. */
@Component({
  selector: 'app-publish-status',
  imports: [Badge],
  template: `<span
    uiBadge
    dot
    [tone]="view().tone"
    [outline]="view().outline ?? false"
    >{{ view().label }}</span
  >`,
})
export class PublishStatus {
  readonly status = input.required<PublishStatusValue>();

  protected readonly view = computed(() => PUBLISH_STATUS_VIEW[this.status()]);
}
