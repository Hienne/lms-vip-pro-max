import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { computed, DestroyRef, inject, signal } from '@angular/core';
import {
  communityMediaEndpoints as media,
  type AssetInput,
} from '@lms/contracts';
import {
  defer,
  EMPTY,
  expand,
  from,
  map,
  of,
  switchMap,
  take,
  timeout,
  timer,
  throwError,
  filter,
} from 'rxjs';
import { serverMutation } from '../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../core/http/endpoint-client';

async function checksum(file: Blob): Promise<string> {
  return bytesToHex(sha256(new Uint8Array(await file.arrayBuffer())));
}

/** The editor's pending cover. Unattached uploads are reclaimed by the server's orphan cleanup. */
export function communityCoverUpload() {
  const client = inject(EndpointClient);
  const state = {
    selection: signal<AssetInput | null | undefined>(undefined),
    preview: signal<string | undefined>(undefined),
    validation: signal<string | undefined>(undefined),
  };
  const upload = serverMutation(
    (file: File) =>
      defer(() => from(checksum(file))).pipe(
        switchMap((hash) =>
          client.call(media.startUpload, {
            body: {
              requestId: crypto.randomUUID(),
              originalName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              checksumSha256: hash,
            },
          }),
        ),
        switchMap((session) => {
          const parts = Array.from(
            { length: Math.ceil(file.size / session.partSize) },
            (_, i) => i + 1,
          );
          // Parts are acknowledged sequentially, including when the server chooses a smaller chunk size.
          return of(0).pipe(
            expand(
              (index) =>
                index < parts.length
                  ? defer(() => {
                      const chunk = file.slice(
                        index * session.partSize,
                        (index + 1) * session.partSize,
                      );
                      return from(checksum(chunk)).pipe(
                        switchMap((hash) =>
                          client.call(media.uploadPart, {
                            params: {
                              uploadId: session.uploadId,
                              partNumber: index + 1,
                            },
                            headers: { 'X-Part-SHA256': hash },
                            body: chunk,
                          }),
                        ),
                        map(() => index + 1),
                      );
                    })
                  : EMPTY,
              1,
            ),
            filter((index) => index === parts.length),
            take(1),
            switchMap(() =>
              client.call(media.completeUpload, {
                params: { uploadId: session.uploadId },
              }),
            ),
          );
        }),
        expand(
          (session) =>
            ['ready', 'failed', 'aborted', 'expired'].includes(session.status)
              ? EMPTY
              : timer(Math.max(1, session.retryAfterSeconds ?? 1) * 1000).pipe(
                  switchMap(() =>
                    client.call(media.uploadStatus, {
                      params: { uploadId: session.uploadId },
                    }),
                  ),
                ),
          1,
        ),
        filter((session) =>
          ['ready', 'failed', 'aborted', 'expired'].includes(session.status),
        ),
        take(1),
        timeout(120_000),
        switchMap((session) =>
          session.status === 'ready'
            ? of({ file, assetId: session.assetId })
            : throwError(
                () =>
                  new Error(
                    'Không xử lý được ảnh. Hãy chọn lại hoặc thử ảnh khác.',
                  ),
              ),
        ),
      ),
    {
      errors: 'alert',
      onSuccess: ({ file, assetId }) => {
        setPreview(URL.createObjectURL(file));
        setSelection({ assetId, usage: 'cover', sortNo: 0 });
      },
    },
  );

  const selection$ = state.selection.asReadonly();
  const preview$ = state.preview.asReadonly();
  const isPending$ = upload.isPending;
  const error$ = computed(() => state.validation() ?? upload.error()?.message);

  inject(DestroyRef).onDestroy(() => {
    const src = state.preview();
    if (src) URL.revokeObjectURL(src);
  });
  function setSelection(value: AssetInput | null | undefined): void {
    state.selection.set(value);
  }
  function setValidation(value: string | undefined): void {
    state.validation.set(value);
  }
  function setPreview(value: string | undefined): void {
    const previous = state.preview();
    if (previous) URL.revokeObjectURL(previous);
    state.preview.set(value);
  }
  function choose(file: File): void {
    if (isPending$()) return;
    upload.reset();
    setValidation(undefined);
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      !file.size ||
      file.size > 5_000_000
    ) {
      setValidation('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.');
      return;
    }
    upload.run(file);
  }
  function remove(): void {
    if (isPending$()) return;
    reset();
    setSelection(null);
  }
  function reset(): void {
    upload.reset();
    setValidation(undefined);
    setPreview(undefined);
    setSelection(undefined);
  }
  return { selection$, preview$, isPending$, error$, choose, remove, reset };
}
