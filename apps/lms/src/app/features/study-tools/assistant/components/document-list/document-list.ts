import {
  afterRenderEffect,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { KnowledgeDocument } from '@lms/contracts';
import {
  Badge,
  ErrorState,
  FmtDatetimePipe,
  FmtRelativePipe,
  Icon,
  IconButton,
  Input,
  Menu,
  type MenuEntry,
  Pagination,
  Skeleton,
} from '@lms/ui';
import { SCOPE_LABEL, STATUS_VIEW } from '../../data-access/knowledge-status';
import { UPLOAD_ACCEPT } from '../../data-access/upload-rules';

type RowAction = 'rename' | 'replace';

const ROW_ACTIONS: readonly MenuEntry<RowAction>[] = [
  { kind: 'item', value: 'rename', label: 'Đổi tên', icon: 'pen-line' },
  { kind: 'item', value: 'replace', label: 'Thay bản mới', icon: 'upload' },
];

/**
 * The documents the caller may read: who added each, who can find it and where processing stands. It has
 * no heading of its own; the documents panel or drawer around it names it. A row the caller may change has
 * a menu to rename it (in place) or pick a file that replaces it; the list only says what was asked, the
 * store sends it.
 */
@Component({
  selector: 'app-document-list',
  imports: [
    Badge,
    ErrorState,
    FmtDatetimePipe,
    FmtRelativePipe,
    Icon,
    IconButton,
    Input,
    Menu,
    Pagination,
    Skeleton,
  ],
  templateUrl: './document-list.html',
  styleUrl: './document-list.scss',
})
export class DocumentList {
  readonly documents = input.required<readonly KnowledgeDocument[]>();
  readonly total = input.required<number>();
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly loading = input(false);
  readonly failed = input(false);
  /** Whether the caller may delete a document; the server checks again. */
  readonly canRemove = input<(document: KnowledgeDocument) => boolean>(
    () => false,
  );
  /** Whether the caller may rename or replace a document (the same people as delete); the server checks again. */
  readonly canEdit = input<(document: KnowledgeDocument) => boolean>(
    () => false,
  );
  /** A row to point at, such as the document an upload turned out to repeat. */
  readonly highlightId = input<number | null>(null);

  readonly pageChange = output<number>();
  readonly retry = output<void>();
  readonly remove = output<KnowledgeDocument>();
  readonly renamed = output<{
    readonly document: KnowledgeDocument;
    readonly title: string;
  }>();
  readonly replaced = output<{
    readonly document: KnowledgeDocument;
    readonly file: File;
  }>();

  protected readonly statusView = STATUS_VIEW;
  protected readonly scopeLabel = SCOPE_LABEL;
  protected readonly rowActions = ROW_ACTIONS;
  protected readonly accept = UPLOAD_ACCEPT;
  protected readonly editingId = signal<number | null>(null);

  private readonly document = inject(DOCUMENT);
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');
  private readonly editor = viewChild<ElementRef<HTMLInputElement>>('editor');
  private replacing: KnowledgeDocument | null = null;

  constructor() {
    afterRenderEffect(() => {
      const editor = this.editor();
      if (editor) {
        editor.nativeElement.focus();
        editor.nativeElement.select();
      }
    });
    afterRenderEffect(() => {
      if (this.highlightId() === null) return;
      this.document
        .querySelector<HTMLElement>('.doc--highlight')
        ?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  protected act(action: RowAction, document: KnowledgeDocument): void {
    if (action === 'rename') {
      this.editingId.set(document.id);
      return;
    }
    this.replacing = document;
    this.picker()?.nativeElement.click();
  }

  protected saveRename(document: KnowledgeDocument, raw: string): void {
    const title = raw.trim();
    this.editingId.set(null);
    if (title && title !== document.title) {
      this.renamed.emit({ document, title });
    }
  }

  protected cancelRename(): void {
    this.editingId.set(null);
  }

  protected picked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const document = this.replacing;
    this.replacing = null;
    // The same file may be chosen again later, so the input is emptied.
    input.value = '';
    if (file && document) this.replaced.emit({ document, file });
  }
}
