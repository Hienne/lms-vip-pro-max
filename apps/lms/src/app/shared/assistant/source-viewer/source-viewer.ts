import { Component, computed, inject } from '@angular/core';
import { DrawerOutlet } from '@lms/ui';
import { SourceViewerStore } from '../../../core/assistant/source-viewer.store';
import { SourceText } from '../source-text/source-text';

/**
 * The drawer that opens from a source: the document's title over its text (`app-source-text`). It
 * is open while the store holds a source, unless a page shows the source in a pane of its own (the
 * `/assistant` page on a wide screen docks it).
 */
@Component({
  selector: 'app-source-viewer',
  imports: [DrawerOutlet, SourceText],
  templateUrl: './source-viewer.html',
  styleUrl: './source-viewer.scss',
})
export class SourceViewer {
  protected readonly store = inject(SourceViewerStore);

  protected readonly isOpen = computed(
    () => this.store.citation$() !== null && !this.store.docked$(),
  );
  protected readonly title = computed(
    () => this.store.citation$()?.fileName ?? 'Tài liệu',
  );
}
