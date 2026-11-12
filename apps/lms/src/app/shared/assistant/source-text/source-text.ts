import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
} from '@angular/core';
import type { TextChunk } from '@lms/contracts';
import { Button, Card } from '@lms/ui';
import { SourceViewerStore } from '../../../core/assistant/source-viewer.store';
import { citationLocation } from '../citation-label';

/**
 * The text of the open source: the extracted chunks around the cited passage, that passage
 * highlighted and scrolled into view, and "Xem thêm" on each side. Shown in the shell's drawer and
 * in the `/assistant` page's source pane; both only frame it.
 */
@Component({
  selector: 'app-source-text',
  imports: [Button, Card],
  templateUrl: './source-text.html',
  styleUrl: './source-text.scss',
})
export class SourceText {
  protected readonly store = inject(SourceViewerStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Each chunk with its place, and the section path only where it changes. */
  protected readonly blocks = computed(() => {
    const text = this.store.text$();
    if (!text) return [];
    let previous: string | null = null;
    return text.chunks.map((chunk) => {
      const heading = chunk.sectionPath !== previous ? chunk.sectionPath : '';
      previous = chunk.sectionPath;
      return {
        chunk,
        heading,
        location: this.location(text.fileName, chunk),
        cited: chunk.chunkId === text.aroundChunkId,
      };
    });
  });

  /** The place the cited chunk was found at, shown above the text. */
  protected readonly citedPath = computed(
    () =>
      this.store
        .text$()
        ?.chunks.find((c) => c.chunkId === this.store.citedChunkId$())
        ?.sectionPath ?? '',
  );

  private scrolledFor: unknown = null;

  constructor() {
    // Scroll once per opened source; "Xem thêm" must not move the reader.
    afterRenderEffect(() => {
      const text = this.store.text$();
      const status = this.store.status$();
      if (status !== 'ready' || !text) {
        this.scrolledFor = null;
        return;
      }
      if (this.scrolledFor === text.documentId + ':' + text.aroundChunkId)
        return;
      const cited =
        this.host.nativeElement.querySelector<HTMLElement>('.chunk--cited');
      if (!cited) return;
      this.scrolledFor = text.documentId + ':' + text.aroundChunkId;
      cited.scrollIntoView?.({ block: 'center' });
    });
  }

  private location(fileName: string, chunk: TextChunk): string {
    return citationLocation({
      n: 1,
      documentId: 0,
      fileName,
      page: chunk.page,
      lineStart: chunk.lineStart,
      lineEnd: chunk.lineEnd,
      snippet: '',
    });
  }
}
