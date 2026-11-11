import {
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { LessonBlock } from '@lms/contracts';
import { Markdown } from '../../../../../shared/content/markdown/markdown';
import { cleanLessonHtml } from '../../../../../shared/content/markdown/lesson-html';

/** A `text` block: its body in the format the author saved it in. */
@Component({
  selector: 'app-text-block',
  imports: [Markdown],
  template: `
    @if (body(); as source) {
      @if (block().bodyFormat === 'html') {
        <div class="lesson-html" [innerHTML]="source"></div>
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
})
export class TextBlock {
  readonly block = input.required<LessonBlock>();
  private readonly document = inject(DOCUMENT);

  protected readonly body = computed(() => {
    const block = this.block();
    const source = block.body?.trim() ?? '';
    return block.bodyFormat === 'html'
      ? cleanLessonHtml(source, this.document, true)
      : source;
  });
}
