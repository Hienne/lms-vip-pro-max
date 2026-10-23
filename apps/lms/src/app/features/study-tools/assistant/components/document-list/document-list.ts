import { Component, input, output } from '@angular/core';
import type { KnowledgeDocument } from '@lms/contracts';
import {
  Badge,
  ErrorState,
  FmtDatetimePipe,
  FmtRelativePipe,
  Pagination,
  Skeleton,
} from '@lms/ui';
import { STATUS_VIEW } from '../../data-access/knowledge-status';

/**
 * The shared knowledge base: every document with who added it and where processing stands. It has
 * no heading of its own; the documents panel or drawer around it names it.
 */
@Component({
  selector: 'app-document-list',
  imports: [
    Badge,
    ErrorState,
    FmtDatetimePipe,
    FmtRelativePipe,
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

  readonly pageChange = output<number>();
  readonly retry = output<void>();

  protected readonly statusView = STATUS_VIEW;
}
