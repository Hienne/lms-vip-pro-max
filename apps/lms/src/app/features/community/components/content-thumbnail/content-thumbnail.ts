import { NgOptimizedImage } from '@angular/common';
import {
  Component,
  computed,
  inject,
  Injectable,
  Injector,
  input,
  signal,
} from '@angular/core';
import { communityMediaEndpoints } from '@lms/contracts';
import { Observable } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';

@Injectable()
class ContentThumbnailStore {
  private readonly state = { failedSource: signal('') };
  readonly failedSource$ = this.state.failedSource.asReadonly();
  fail(source: string): void {
    this.setFailedSource(source);
  }
  private setFailedSource(source: string): void {
    this.state.failedSource.set(source);
  }
  private readonly injector = inject(Injector);
  connect(id: () => number | null | undefined) {
    return serverData(
      (revisionAssetId: number) =>
        new Observable<string>((subscriber) => {
          let src: string | undefined;
          // Keep the URL live until the resource changes or the row is destroyed.
          const read = this.injector
            .get(EndpointClient)
            .call(communityMediaEndpoints.content, {
              params: { revisionAssetId },
            })
            .subscribe({
              next: (blob) => {
                src = URL.createObjectURL(blob);
                subscriber.next(src);
              },
              error: () => subscriber.next(''),
            });
          return () => {
            read.unsubscribe();
            if (src) URL.revokeObjectURL(src);
          };
        }),
      { params: () => id() ?? undefined },
    );
  }
}

/**
 * Decorative cover: the adjacent title is the accessible link text. It shows only an image the
 * author uploaded; with none (or one that fails to load) it renders nothing and takes no room.
 */
@Component({
  selector: 'app-content-thumbnail',
  imports: [NgOptimizedImage],
  providers: [ContentThumbnailStore],
  host: { '[class.thumbnail--empty]': '!hasImage()' },
  // Authenticated bytes use object URLs, which NgOptimizedImage explicitly rejects.
  template:
    '@if (hasImage()) { @if (isBlob()) { <img [src]="src()" width="1280" height="720" alt="" loading="lazy" (error)="store.fail(src())" /> } @else { <img [ngSrc]="src()" width="1280" height="720" alt="" loading="lazy" (error)="store.fail(src())" /> } }',
  styleUrl: './content-thumbnail.scss',
})
export class ContentThumbnail {
  readonly revisionAssetId = input<number | null>();
  readonly preview = input<string>();
  protected readonly store = inject(ContentThumbnailStore);
  private readonly cover = this.store.connect(this.revisionAssetId);
  protected readonly isBlob = computed(() => this.src().startsWith('blob:'));
  protected readonly src = computed(
    () => this.preview() || this.cover.value() || '',
  );
  protected readonly hasImage = computed(
    () => !!this.src() && this.store.failedSource$() !== this.src(),
  );
}
