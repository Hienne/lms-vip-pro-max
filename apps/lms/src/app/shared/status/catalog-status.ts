import { Component, computed, input } from '@angular/core';
import type { CatalogStatus as CatalogStatusValue } from '@lms/contracts';
import { Badge } from '@lms/ui';
import type { StatusView } from './status-view';

/**
 * The mockup's `PUB` for the backend's four states. The backend archives where the mockup locked,
 * so "Đã khóa" becomes "Lưu trữ": out of use, history kept.
 */
const CATALOG_STATUS_VIEW: Record<CatalogStatusValue, StatusView> = {
  draft: { label: 'Nháp', tone: 'neutral', outline: true, dot: true },
  published: { label: 'Đã xuất bản', tone: 'success', dot: true },
  paused: { label: 'Tạm dừng', tone: 'warning', dot: true },
  archived: { label: 'Lưu trữ', tone: 'neutral', dot: true },
};

export const CATALOG_STATUS_LABEL: Record<CatalogStatusValue, string> =
  Object.fromEntries(
    Object.entries(CATALOG_STATUS_VIEW).map(([key, view]) => [key, view.label]),
  ) as Record<CatalogStatusValue, string>;

/**
 * A course's state as one of the four: archived or paused win over the publication, a course
 * never published is a draft.
 */
export function courseCatalogStatus(card: {
  readonly publicationState?: string | null;
  readonly lifecycleStatus?: string | null;
}): CatalogStatusValue {
  const lifecycle = card.lifecycleStatus?.toLowerCase();
  if (lifecycle === 'archived' || lifecycle === 'paused') return lifecycle;
  return card.publicationState?.toLowerCase() === 'published'
    ? 'published'
    : 'draft';
}

/** State of a training catalogue row or a course, as a badge with a status dot. */
@Component({
  selector: 'app-catalog-status',
  imports: [Badge],
  template: `<span
    uiBadge
    dot
    [tone]="view().tone"
    [outline]="view().outline ?? false"
    >{{ view().label }}</span
  >`,
})
export class CatalogStatus {
  readonly status = input.required<CatalogStatusValue>();

  protected readonly view = computed(() => CATALOG_STATUS_VIEW[this.status()]);
}
