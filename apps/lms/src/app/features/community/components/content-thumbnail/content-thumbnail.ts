import { NgOptimizedImage } from '@angular/common';
import {
  Component,
  computed,
  inject,
  Injectable,
  Injector,
  input,
} from '@angular/core';
import { communityMediaEndpoints } from '@lms/contracts';
import { Observable } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';

@Injectable()
class ContentThumbnailStore {
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

/** Decorative cover: the adjacent title is the accessible link text. */
@Component({
  selector: 'app-content-thumbnail',
  imports: [NgOptimizedImage],
  providers: [ContentThumbnailStore],
  // Authenticated bytes use object URLs, which NgOptimizedImage explicitly rejects.
  template:
    '@if (isBlob()) { <img [src]="src()" width="1280" height="720" alt="" loading="lazy" /> } @else { <img [ngSrc]="src()" width="1280" height="720" alt="" loading="lazy" /> }',
  styleUrl: './content-thumbnail.scss',
})
export class ContentThumbnail {
  readonly revisionAssetId = input<number | null>();
  readonly preview = input<string>();
  readonly kind = input('article');
  protected readonly defaultCover = computed(() =>
    this.kind() === 'question'
      ? '/images/question-default.webp'
      : '/images/course-default.webp',
  );
  private readonly cover = inject(ContentThumbnailStore).connect(
    this.revisionAssetId,
  );
  protected readonly isBlob = computed(() => this.src().startsWith('blob:'));
  protected readonly src = computed(
    () => this.preview() ?? (this.cover.value() || this.defaultCover()),
  );
}
