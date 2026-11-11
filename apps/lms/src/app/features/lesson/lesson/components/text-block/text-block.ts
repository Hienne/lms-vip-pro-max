import {
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type {
  LessonBlock,
  AssetDetail,
  AssetContentQuery,
} from '@lms/contracts';
import { LessonImages } from '../../../../../shared/content/markdown/lesson-images';
import { Markdown } from '../../../../../shared/content/markdown/markdown';
import { cleanLessonHtml } from '../../../../../shared/content/markdown/lesson-html';

/** A `text` block: its body in the format the author saved it in. */
@Component({
  selector: 'app-text-block',
  imports: [Markdown, LessonImages],
  template: `
    @if (body(); as source) {
      @if (block().bodyFormat === 'html') {
        <div
          class="lesson-html"
          [renderLessonHtml]="true"
          [appLessonImages]="source"
          [imageQuery]="imageQuery()"
          [imageAssets]="imageIds()"
        ></div>
      } @else {
        <app-markdown
          [source]="source"
          [format]="block().bodyFormat ?? 'markdown'"
          nested
        />
      }
    } @else {
      <p class="text-block__empty">Khối này chưa có nội dung.</p>
    }
  `,
  styleUrls: [
    './text-block.scss',
    '../../../../../shared/content/markdown/lesson-html.scss',
  ],
  encapsulation: ViewEncapsulation.None,
  host: { '[class.text-block--wide]': 'wide()' },
})
export class TextBlock {
  readonly block = input.required<LessonBlock>();
  readonly wide = input(false);
  readonly assets = input<readonly AssetDetail[]>([]);
  readonly imageQuery = input<AssetContentQuery>({});
  readonly mediaReady = input(true);
  private readonly document = inject(DOCUMENT);
  protected readonly imageIds = computed(() =>
    this.mediaReady()
      ? this.assets()
          .filter((asset) => asset.asset.mimeType.startsWith('image/'))
          .map((asset) => asset.asset.id)
      : [],
  );

  protected readonly body = computed(() => {
    const block = this.block();
    const source = block.body?.trim() ?? '';
    return block.bodyFormat === 'html'
      ? cleanLessonHtml(source, this.document, true)
      : source;
  });
}
