import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, Component, computed, input } from '@angular/core';
import type { BodyFormat } from '@lms/contracts';
import { parseContent, type Inline } from './markdown.parse';

/**
 * A lesson text (the mockup's `UI.Markdown`): the markdown subset of the course editor, a body
 * saved as HTML rebuilt from an allowlist, or plain text with its line breaks. The parser returns
 * data and this template builds every element, so there is no `innerHTML` and no way for a body to
 * bring in a `script`, `style`, `iframe` or an `on*` attribute.
 */
@Component({
  selector: 'app-markdown',
  imports: [NgTemplateOutlet],
  templateUrl: './markdown.html',
  styleUrl: './markdown.scss',
})
export class Markdown {
  readonly source = input.required<string>();
  readonly format = input<BodyFormat>('markdown');
  /** Optional per-document anchor namespace, used by the community table of contents. */
  readonly headingPrefix = input<string>();
  /**
   * The body sits under a heading of its own at the `lg` size (the lesson's block title): its
   * headings step one size down, so `##` never reads as large as that title.
   */
  readonly nested = input(false, { transform: booleanAttribute });

  protected readonly blocks = computed(() =>
    parseContent(this.source(), this.format()),
  );

  protected readonly inlineContext = (inlines: readonly Inline[]) => ({
    $implicit: inlines,
  });
}
