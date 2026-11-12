import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { concatMap, filter, finalize, from, map, take, tap } from 'rxjs';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { chunkedUpload } from './chunked-upload';
import { Sha256Hasher } from './sha256-hasher';
import type { AssetValue } from '../course-draft';

@Injectable()
export class LessonInlineMediaStore {
  private readonly client = inject(EndpointClient);
  private readonly hasher = inject(Sha256Hasher);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pending = signal(false);
  private readonly failure = signal('');
  readonly pending$ = this.pending.asReadonly();
  readonly error$ = this.failure.asReadonly();

  upload(
    files: readonly File[],
    ownerOrgId: number | undefined,
    existing: number,
    added: (asset: AssetValue) => void,
  ): void {
    if (this.pending() || !files.length) return;
    this.failure.set('');
    if (!ownerOrgId) {
      this.failure.set('Chưa xác định được đơn vị sở hữu ảnh.');
      return;
    }
    if (existing + files.length > 20) {
      this.failure.set('Mỗi khối văn bản chứa tối đa 20 ảnh.');
      return;
    }
    if (
      files.some(
        (file) =>
          !/\.(png|jpe?g|webp)$/i.test(file.name) ||
          file.size <= 0 ||
          file.size > 5_000_000,
      )
    ) {
      this.failure.set('Chọn ảnh PNG, JPG hoặc WebP, tối đa 5 MB mỗi ảnh.');
      return;
    }
    this.pending.set(true);
    from(files)
      .pipe(
        concatMap((file) =>
          chunkedUpload(this.client, this.hasher, file, ownerOrgId).pipe(
            tap((event) => {
              if (event.type === 'failed') throw new Error(event.message);
              if (event.type === 'stalled')
                throw new Error(
                  'Ảnh đang xử lý lâu. Hãy chọn lại ảnh sau khi kiểm tra kết nối.',
                );
            }),
            filter((event) => event.type === 'ready'),
            take(1),
            map((event): AssetValue => {
              if (!event.upload.assetId)
                throw new Error('Chưa nhận được ảnh đã xử lý.');
              return {
                assetId: event.upload.assetId,
                name: file.name,
                sizeBytes: file.size,
                usage: 'image',
              };
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: added,
        error: (error: unknown) =>
          this.failure.set(
            error instanceof Error
              ? error.message
              : 'Chưa tải được ảnh. Hãy thử lại.',
          ),
      });
  }
}
