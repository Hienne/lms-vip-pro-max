import { Component, input, output } from '@angular/core';
import type { KnowledgeDocument } from '@lms/contracts';
import {
  Badge,
  ErrorState,
  FmtDatetimePipe,
  FmtRelativePipe,
  Icon,
  IconButton,
  Pagination,
  Skeleton,
} from '@lms/ui';
import { SCOPE_LABEL, STATUS_VIEW } from '../../data-access/knowledge-status';

/**
 * The documents the caller may read: who added each, who can find it and where processing stands. It has
 * no heading of its own; the documents panel or drawer around it names it.
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

  readonly pageChange = output<number>();
  readonly retry = output<void>();
  readonly remove = output<KnowledgeDocument>();

  protected readonly statusView = STATUS_VIEW;
  protected readonly scopeLabel = SCOPE_LABEL;
}
