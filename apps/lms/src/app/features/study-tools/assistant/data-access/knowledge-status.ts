import type { DocumentScope, DocumentStatus } from '@lms/contracts';
import type { BadgeTone } from '@lms/ui';

export interface StatusView {
  readonly label: string;
  readonly tone: BadgeTone;
}

/** How a document's processing status reads on screen; the server decides the status itself. */
export const STATUS_VIEW: Readonly<Record<DocumentStatus, StatusView>> = {
  queued: { label: 'Đang chờ', tone: 'neutral' },
  processing: { label: 'Đang xử lý', tone: 'info' },
  ready: { label: 'Sẵn sàng', tone: 'success' },
  failed: { label: 'Không xử lý được', tone: 'danger' },
};

/** Who finds a document, as the picker and the list word it. */
export const SCOPE_LABEL: Readonly<Record<DocumentScope, string>> = {
  personal: 'Chỉ mình tôi',
  unit: 'Đơn vị của tôi',
  global: 'Toàn hệ thống',
};

/** The picker's choices; `global` is offered to admins only (the server refuses it for others). */
export function scopeOptions(
  canShareGlobally: boolean,
): readonly { value: DocumentScope; label: string }[] {
  const scopes: readonly DocumentScope[] = canShareGlobally
    ? ['personal', 'unit', 'global']
    : ['personal', 'unit'];
  return scopes.map((value) => ({ value, label: SCOPE_LABEL[value] }));
}
