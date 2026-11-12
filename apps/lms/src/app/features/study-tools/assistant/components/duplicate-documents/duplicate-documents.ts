import { Component, computed, input, output } from '@angular/core';
import type { DuplicateGroup, KnowledgeDocument } from '@lms/contracts';
import { FmtRelativePipe, Icon, IconButton } from '@lms/ui';
import { SCOPE_LABEL } from '../../data-access/knowledge-status';

/**
 * "Tài liệu trùng": the caller's documents that share a file in one scope, so old duplicates can be
 * cleaned up by hand. Nothing is removed automatically; each copy has its own delete, which the store
 * confirms. It shows nothing when there is no duplicate.
 */
@Component({
  selector: 'app-duplicate-documents',
  imports: [FmtRelativePipe, Icon, IconButton],
  templateUrl: './duplicate-documents.html',
  styleUrl: './duplicate-documents.scss',
})
export class DuplicateDocuments {
  readonly groups = input.required<readonly DuplicateGroup[]>();
  readonly remove = output<KnowledgeDocument>();

  protected readonly scopeLabel = SCOPE_LABEL;
  protected readonly copies = computed(() =>
    this.groups().reduce((sum, group) => sum + group.documents.length, 0),
  );
}
