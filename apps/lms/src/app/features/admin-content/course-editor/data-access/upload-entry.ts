import type { UploadState } from '@lms/ui';
import type { AssetValue } from '../course-draft';

export type UploadEntryState =
  | 'hashing'
  | 'uploading'
  /** No network: the upload goes on by itself when it is back. */
  | 'waiting'
  | 'processing'
  /** The server did not finish in time: "Kiểm tra lại" asks again. */
  | 'stalled'
  | 'done'
  | 'error';

/** A file the author chose for a block (by the block's key) and where its upload stands. */
export interface UploadEntry {
  readonly state: UploadEntryState;
  readonly name: string;
  readonly sizeBytes: number;
  /** The bar while hashing or sending, 0–100. */
  readonly percent?: number;
  /** The row's line of text on what is happening. */
  readonly status?: string;
  /** The server's id for the upload, once it knows it. */
  readonly uploadId?: string;
  readonly asset?: AssetValue;
  /** What went wrong, for `error` and `stalled`. */
  readonly message?: string;
  /** The file is fine but the server could not check it: "Xử lý lại" asks again. */
  readonly reprocess?: boolean;
  /** The kept upload ran out on the server: "Tải lên lại". */
  readonly expired?: boolean;
}

const megabytes = (bytes: number): string =>
  `${(bytes / 1_048_576).toFixed(1)} MB`;

export const hashingStatus = (percent: number): string =>
  `Đang kiểm tra tệp… ${percent}%`;

export const sendingStatus = (sent: number, total: number): string =>
  `Đang tải lên… ${megabytes(sent)} / ${megabytes(total)}`;

export const WAITING_STATUS = 'Mất kết nối, sẽ tiếp tục khi có mạng.';
export const PROCESSING_STATUS = 'Đang xử lý tệp…';
export const STALLED_MESSAGE = 'Máy chủ chưa xử lý xong. Kiểm tra lại sau.';
export const MISMATCH_MESSAGE = 'Tệp không khớp tệp đang tải lên.';

/** The upload item's state for a row; `done` rows are not shown as uploads. */
export function itemState(entry: UploadEntry): UploadState {
  switch (entry.state) {
    case 'hashing':
    case 'uploading':
    case 'waiting':
      return 'uploading';
    case 'processing':
      return 'processing';
    case 'done':
      return 'done';
    default:
      return 'error';
  }
}

/** Whether the file is still on its way: the lesson cannot be applied before it is there. */
export const isBusy = (entry: UploadEntry | undefined): boolean =>
  entry !== undefined &&
  ['hashing', 'uploading', 'waiting', 'processing', 'stalled'].includes(
    entry.state,
  );

/** Whether the author can still cancel: while the bytes are read or sent. */
export const isCancellable = (entry: UploadEntry): boolean =>
  ['hashing', 'uploading', 'waiting'].includes(entry.state);
