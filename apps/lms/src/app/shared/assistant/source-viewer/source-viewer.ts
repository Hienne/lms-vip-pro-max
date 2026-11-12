import { afterRenderEffect, Component, computed, inject } from '@angular/core';
import type { TextChunk } from '@lms/contracts';
import { Button, Card, DrawerOutlet } from '@lms/ui';
import { SourceViewerStore } from '../../../core/assistant/source-viewer.store';
import { citationLocation } from '../citation-label';

/**
 * The panel that opens from a source: the document's title, and the extracted text around the cited
 * passage with that passage highlighted and scrolled into view. It is open while the store holds a
 * source; the chat and the `/assistant` page only tell the store which one.
 */
@Component({
  selector: 'app-source-viewer',
  imports: [Button, Card, DrawerOutlet],
  templateUrl: './source-viewer.html',
  styleUrl: './source-viewer.scss',
})
export class SourceViewer {
  protected readonly store = inject(SourceViewerStore);

  protected readonly isOpen = computed(() => this.store.citation$() !== null);
  protected readonly title = computed(
    () => this.store.citation$()?.fileName ?? 'Tài liệu',
  );

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

  /** The place the cited chunk was found at, shown under the title. */
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
      const cited = document.querySelector<HTMLElement>('.chunk--cited');
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
