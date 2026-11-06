import { Component, computed, input } from '@angular/core';
import type { LessonBlock } from '@lms/contracts';
import { Markdown } from '../../../../../shared/content/markdown/markdown';

/** A `text` block: its body in the format the author saved it in. */
@Component({
  selector: 'app-text-block',
  imports: [Markdown],
  template: `
    @if (body(); as body) {
      <app-markdown
        [source]="body"
        [format]="block().bodyFormat ?? 'markdown'"
        nested
      />
    } @else {
      <p class="text-block__empty">Khối này chưa có nội dung.</p>
    }
  `,
  styleUrl: './text-block.scss',
})
export class TextBlock {
  readonly block = input.required<LessonBlock>();

  protected readonly body = computed(() => this.block().body?.trim() ?? '');
}
