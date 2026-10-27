import { HttpErrorResponse } from '@angular/common/http';
import {
  ASSET_MAX_BYTES,
  assetEndpoints,
  MEDIA_PROCESSING_UNAVAILABLE_CODE,
  type Upload,
} from '@lms/contracts';
import {
  filter,
  firstValueFrom,
  Observable,
  Subject,
  takeUntil,
  tap,
} from 'rxjs';
import { toAppError } from '../../../../core/errors/app-error';
import { ApiError } from '../../../../core/http/api-error';
import type { EndpointClient } from '../../../../core/http/endpoint-client';
import type { Hasher } from './sha256-hasher';

/** How often the server is asked whether it finished processing a file. */
export const POLL_MS = 3_000;
/** How long the app keeps asking before it says the server is slow. */
export const POLL_LIMIT_MS = 15 * 60_000;
/** The pause before a part or a poll is tried again after a server error. */
export const SERVER_RETRY_MS = 5_000;
/** Server errors in a row (no answer in between) before the upload is given up. */
export const SERVER_RETRIES = 6;

const MISMATCH_CODE = 'LEARNING-UPLOAD_FILE_MISMATCH';
const EXPIRED_CODE = 'LEARNING-UPLOAD_EXPIRED';

/** What the row of one upload shows, in the order it happens. */
export type UploadProgress =
  /** The whole file is read and hashed before anything is sent. */
  | { readonly type: 'hashing'; readonly percent: number }
  /** The server knows the upload: keep this to resume after a reload. */
  | {
      readonly type: 'started';
      readonly uploadId: string;
      readonly checksumSha256: string;
      /** When the server forgets the upload; null when it does not say. */
      readonly expiresAt: string | null;
    }
  | {
      readonly type: 'uploading';
      readonly uploadId: string;
      readonly uploadedBytes: number;
      readonly totalBytes: number;
    }
  /** No network (or the server is failing): the upload goes on by itself. */
  | { readonly type: 'waiting' }
  /** All bytes are there; the server is checking and preparing the file. */
  | { readonly type: 'processing'; readonly uploadId: string }
  /** The server did not finish in `POLL_LIMIT_MS`: "Kiểm tra lại" asks again. */
  | { readonly type: 'stalled'; readonly uploadId: string }
  /** The file is in the library; `upload` carries the duration and page count the server read. */
  | { readonly type: 'ready'; readonly upload: Upload }
  | {
      readonly type: 'failed';
      readonly code: string | null;
      readonly message: string;
      /** The file is fine but the server could not run its checks: completing again retries. */
      readonly retryProcessing: boolean;
    };

/** An upload kept across a reload, and the file the author picks to continue it. */
export interface ResumeTarget {
  readonly uploadId: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
}

export interface ChunkedUploadOptions {
  readonly resume?: ResumeTarget;
  /** Resolves when the network is back; defaults to waiting `SERVER_RETRY_MS`. */
  readonly online?: () => Promise<void>;
}

class Cancelled extends Error {}

class Failed extends Error {
  constructor(
    readonly code: string | null,
    message: string,
    readonly retryProcessing = false,
  ) {
    super(message);
  }
}

/** The work of one upload as an Observable of rows; unsubscribing cancels the request in flight. */
interface Run {
  emit(event: UploadProgress): void;
  call<T>(source: Observable<T>): Promise<T>;
  wait(ms: number): Promise<void>;
}

/**
 * A raw RxJS stream on purpose: an upload is long-running work with its own pauses and polls, not
 * one request, so `serverMutation` (one run, cancelled by the next) does not fit it.
 */
function stream(work: (run: Run) => Promise<void>): Observable<UploadProgress> {
  return new Observable<UploadProgress>((subscriber) => {
    const cancelled = new Subject<void>();
    let isCancelled = false;
    const run: Run = {
      emit: (event) => {
        if (!isCancelled) subscriber.next(event);
      },
      call: (source) => firstValueFrom(source.pipe(takeUntil(cancelled))),
      wait: (ms) =>
        new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, ms);
          cancelled.subscribe(() => {
            clearTimeout(timer);
            reject(new Cancelled());
          });
        }),
    };
    work(run)
      .catch((error: unknown) => {
        if (isCancelled) return;
        if (error instanceof Failed) {
          run.emit({
            type: 'failed',
            code: error.code,
            message: error.message,
            retryProcessing: error.retryProcessing,
          });
          return;
        }
        const failure = toAppError(error);
        run.emit({
          type: 'failed',
          code: failure.messageCode ?? null,
          message: failure.message,
          retryProcessing: false,
        });
      })
      .then(() => {
        if (!isCancelled) subscriber.complete();
      });
    return () => {
      isCancelled = true;
      cancelled.next();
      cancelled.complete();
    };
  });
}

type Transient = 'offline' | 'server' | null;

/** A dead network, or the server failing (not refusing): worth trying again. */
function transient(error: unknown): Transient {
  if (toAppError(error).kind === 'offline') return 'offline';
  const status =
    error instanceof ApiError
      ? error.httpStatus
      : error instanceof HttpErrorResponse
        ? error.status
        : 0;
  return status >= 500 ? 'server' : null;
}

function failureOf(error: unknown): Failed {
  const failure = toAppError(error);
  return new Failed(failure.messageCode ?? null, failure.message);
}

function requestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** What one upload needs from the page: the backend, a hasher, and how to wait for the network. */
class Flow {
  /** Server errors since the last answer. */
  private serverErrors = 0;

  constructor(
    private readonly run: Run,
    private readonly client: EndpointClient,
    private readonly hasher: Hasher,
    private readonly online: () => Promise<void>,
  ) {}

  /**
   * One request; a dead network or a server error waits and sends it again, a refusal fails. An
   * answer ends the run of server errors, unless the caller is itself recovering from one
   * (`recovering`: the manifest read after a lost part must not hide that the part keeps failing).
   */
  async send<T>(request: () => Observable<T>, recovering = false): Promise<T> {
    for (;;) {
      try {
        const answer = await this.run.call(request());
        if (!recovering) this.serverErrors = 0;
        return answer;
      } catch (error) {
        await this.pause(error);
      }
    }
  }

  /** The request this upload keeps retrying got its answer. */
  answered(): void {
    this.serverErrors = 0;
  }

  /** Waits after a transient failure, or throws the failure when it is not one. */
  async pause(error: unknown): Promise<void> {
    if (error instanceof Cancelled) throw error;
    const kind = transient(error);
    if (kind === null) throw failureOf(error);
    if (kind === 'server' && ++this.serverErrors > SERVER_RETRIES) {
      throw failureOf(error);
    }
    this.run.emit({ type: 'waiting' });
    await (kind === 'offline' ? this.online() : this.run.wait(SERVER_RETRY_MS));
  }

  hash(blob: Blob, onProgress?: (percent: number) => void): Promise<string> {
    return this.run
      .call(
        this.hasher.hash(blob).pipe(
          tap((event) => {
            if (event.type === 'progress') {
              onProgress?.(
                event.total === 0
                  ? 100
                  : Math.floor((event.hashed / event.total) * 100),
              );
            }
          }),
          filter((event) => event.type === 'done'),
        ),
      )
      .then((event) => (event as { hex: string }).hex);
  }

  status(uploadId: string): Observable<Upload> {
    return this.client.call(assetEndpoints.uploadStatus, {
      params: { uploadId },
    });
  }

  complete(uploadId: string): Observable<Upload> {
    return this.client.call(assetEndpoints.completeUpload, {
      params: { uploadId },
    });
  }

  /** Asks until the server has an end state, or `POLL_LIMIT_MS` passed. */
  async settle(first: Upload): Promise<void> {
    const startedAt = Date.now();
    let upload = first;
    for (;;) {
      switch (upload.status) {
        case 'ready':
          this.run.emit({ type: 'ready', upload });
          return;
        case 'failed':
          this.run.emit({
            type: 'failed',
            code: upload.errorCode ?? null,
            message: upload.errorMessage ?? 'Máy chủ không xử lý được tệp.',
            retryProcessing:
              upload.errorCode === MEDIA_PROCESSING_UNAVAILABLE_CODE,
          });
          return;
        case 'canceling':
        case 'canceled':
        case 'expired':
        case 'deleted':
          this.run.emit({
            type: 'failed',
            code: EXPIRED_CODE,
            message: 'Phiên tải lên đã hết hạn hoặc bị hủy.',
            retryProcessing: false,
          });
          return;
        default:
          this.run.emit({ type: 'processing', uploadId: upload.uploadId });
      }
      if (Date.now() - startedAt >= POLL_LIMIT_MS) {
        this.run.emit({ type: 'stalled', uploadId: upload.uploadId });
        return;
      }
      await this.run.wait(POLL_MS);
      upload = await this.send(() => this.status(upload.uploadId));
    }
  }
}

const defaultOnline = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, SERVER_RETRY_MS));

/**
 * Uploads one file in the parts the server asks for (SPEC-asset-library → Upload flow): hash the
 * whole file, start (or take up the upload with `resume.uploadId`), send the parts the server does
 * not have yet one at a time, complete, and poll until the server says `ready`. Every outcome is
 * a row (`UploadProgress`); nothing here throws. Unsubscribing stops sending at once (it does not
 * cancel the upload on the server: `cancelUpload` does, and a reload resumes).
 */
export function chunkedUpload(
  client: EndpointClient,
  hasher: Hasher,
  file: File,
  ownerOrgId: number,
  options: ChunkedUploadOptions = {},
): Observable<UploadProgress> {
  return stream(async (run) => {
    const flow = new Flow(run, client, hasher, options.online ?? defaultOnline);
    const { resume } = options;
    const mismatch = new Failed(
      MISMATCH_CODE,
      'Tệp không khớp tệp đang tải lên.',
    );
    if (file.size < 1 || file.size > ASSET_MAX_BYTES) {
      throw new Failed(
        null,
        file.size < 1
          ? 'Tệp trống, không thể tải lên.'
          : 'Tệp vượt quá dung lượng tối đa 500 MB.',
      );
    }
    if (
      resume &&
      (resume.name !== file.name || resume.sizeBytes !== file.size)
    ) {
      throw mismatch;
    }
    const checksumSha256 = await flow.hash(file, (percent) =>
      run.emit({ type: 'hashing', percent }),
    );
    if (resume && resume.checksumSha256 !== checksumSha256) throw mismatch;

    const uploadId = resume?.uploadId ?? requestId();
    let upload = await flow.send(() =>
      client.call(assetEndpoints.startUpload, {
        body: {
          requestId: uploadId,
          ownerOrgId,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          checksumSha256,
        },
      }),
    );
    run.emit({
      type: 'started',
      uploadId,
      checksumSha256,
      expiresAt: upload.expiresAt ?? null,
    });

    if (upload.status === 'uploading') {
      const total = Math.ceil(file.size / upload.partSize);
      const bytes = (current: Upload) => ({
        type: 'uploading' as const,
        uploadId,
        uploadedBytes: current.uploadedBytes,
        totalBytes: current.totalBytes,
      });
      run.emit(bytes(upload));
      for (let partNumber = 1; partNumber <= total; partNumber++) {
        const has = (current: Upload) =>
          current.parts.some((part) => part.partNumber === partNumber);
        if (has(upload)) continue;
        const part = file.slice(
          (partNumber - 1) * upload.partSize,
          Math.min(partNumber * upload.partSize, file.size),
        );
        const partHash = await flow.hash(part);
        for (;;) {
          try {
            upload = await run.call(
              client.call(assetEndpoints.uploadPart, {
                params: { uploadId, partNumber },
                headers: { 'X-Part-SHA256': partHash },
                body: part,
              }),
            );
            flow.answered();
            break;
          } catch (error) {
            await flow.pause(error);
            // The part may have landed before the answer was lost: the manifest says.
            upload = await flow.send(() => flow.status(uploadId), true);
            if (has(upload)) {
              flow.answered();
              break;
            }
          }
        }
        run.emit(bytes(upload));
      }
      upload = await flow.send(() => flow.complete(uploadId));
    }
    await flow.settle(upload);
  });
}

/** Asks the server about an upload until it is ready, failed or `POLL_LIMIT_MS` passed ("Kiểm tra lại"). */
export function pollUpload(
  client: EndpointClient,
  uploadId: string,
  options: Pick<ChunkedUploadOptions, 'online'> = {},
): Observable<UploadProgress> {
  return stream(async (run) => {
    const flow = new Flow(
      run,
      client,
      { hash: () => new Observable() },
      options.online ?? defaultOnline,
    );
    await flow.settle(await flow.send(() => flow.status(uploadId)));
  });
}

/** Completes an upload again, for a file the server could not check the first time ("Xử lý lại"). */
export function reprocessUpload(
  client: EndpointClient,
  uploadId: string,
  options: Pick<ChunkedUploadOptions, 'online'> = {},
): Observable<UploadProgress> {
  return stream(async (run) => {
    const flow = new Flow(
      run,
      client,
      { hash: () => new Observable() },
      options.online ?? defaultOnline,
    );
    await flow.settle(await flow.send(() => flow.complete(uploadId)));
  });
}

/** Cancels an upload on the server ("Hủy"): its status becomes `canceled`. */
export function cancelUpload(
  client: EndpointClient,
  uploadId: string,
): Observable<Upload> {
  return client.call(assetEndpoints.cancelUpload, { params: { uploadId } });
}
