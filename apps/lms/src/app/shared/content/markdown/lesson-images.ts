import {
  afterRenderEffect,
  Directive,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import type { AssetContentQuery } from '@lms/contracts';
import { courseEndpoints } from '@lms/contracts';
import type { Subscription } from 'rxjs';
import { EndpointClient } from '../../../core/http/endpoint-client';
import { cleanLessonHtml, lessonImageId } from './lesson-html';

/** Image bytes are read through the authenticated client. Stored HTML contains only asset references. */
@Directive({ selector: '[appLessonImages]' })
export class LessonImages {
  readonly appLessonImages = input.required<string>();
  readonly imageQuery = input<AssetContentQuery>({});
  readonly imageAssets = input<readonly number[]>([]);
  readonly renderLessonHtml = input(false);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly client = inject(EndpointClient);
  private readonly changed = signal(0);
  private context = '';
  private rendered: string | undefined;
  private readonly files = new Map<
    number,
    { subscription?: Subscription; url?: string; failed?: boolean }
  >();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clear());
    afterRenderEffect(() => {
      const source = this.appLessonImages();
      this.changed();
      const query = this.imageQuery();
      const context = JSON.stringify(query);
      if (context !== this.context) {
        this.clear();
        this.context = context;
      }
      const allowed = new Set(this.imageAssets());
      if (this.renderLessonHtml() && source !== this.rendered) {
        // Only the rebuilt allowlisted fragment enters the DOM. Image URLs are resolved below.
        const template = this.document.createElement('template');
        template.innerHTML = cleanLessonHtml(source, this.document, true);
        this.host.nativeElement.replaceChildren(template.content);
        this.rendered = source;
      }
      for (const image of this.host.nativeElement.querySelectorAll<HTMLImageElement>(
        'img[data-asset-id]',
      )) {
        const id = lessonImageId(image);
        if (id === null || !allowed.has(id)) {
          image.removeAttribute('src');
          continue;
        }
        let file = this.files.get(id);
        if (!file) {
          file = {};
          this.files.set(id, file);
          const entry = file;
          entry.subscription = this.client
            .call(courseEndpoints.getAssetContent, {
              params: { assetId: id },
              query,
            })
            .subscribe({
              next: (blob) => {
                if (
                  !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)
                ) {
                  entry.failed = true;
                } else {
                  entry.url = URL.createObjectURL(blob);
                }
                this.changed.update((value) => value + 1);
              },
              error: () => {
                entry.failed = true;
                this.changed.update((value) => value + 1);
              },
            });
        }
        if (file.url) image.src = file.url;
        else image.removeAttribute('src');
        if (file.failed && !image.alt) image.alt = 'Không tải được ảnh bài học';
      }
    });
  }

  private clear(): void {
    for (const file of this.files.values()) {
      file.subscription?.unsubscribe();
      if (file.url) URL.revokeObjectURL(file.url);
    }
    this.files.clear();
  }
}
