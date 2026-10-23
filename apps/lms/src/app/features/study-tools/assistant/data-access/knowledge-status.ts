import type { DocumentStatus } from '@lms/contracts';
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
