import { Component, inject } from '@angular/core';
import {
  Breadcrumb,
  type BreadcrumbItem,
  PageHeader,
  SectionCard,
} from '@lms/ui';
import { DocumentList } from '../components/document-list/document-list';
import { DocumentUpload } from '../components/document-upload/document-upload';
import { DuplicateDocuments } from '../components/duplicate-documents/duplicate-documents';
import {
  DOCUMENTS_PAGE_SIZE,
  KnowledgeDocumentsStore,
} from '../data-access/knowledge-documents.store';

/**
 * "Tài liệu của trợ lý" (`/assistant/tai-lieu`): the documents the assistant answers from, on a
 * page of their own so the chat keeps the whole width. Upload on the left, the list (with the
 * copies uploaded twice) on the right; stacked below `lg`.
 */
@Component({
  selector: 'app-assistant-documents',
  imports: [
    Breadcrumb,
    DocumentList,
    DocumentUpload,
    DuplicateDocuments,
    PageHeader,
    SectionCard,
  ],
  providers: [KnowledgeDocumentsStore],
  templateUrl: './assistant-documents.html',
  styleUrl: './assistant-documents.scss',
})
export class AssistantDocuments {
  protected readonly store = inject(KnowledgeDocumentsStore);
  protected readonly pageSize = DOCUMENTS_PAGE_SIZE;
  protected readonly crumbs: readonly BreadcrumbItem[] = [
    { label: 'Trợ lý AI', href: '/assistant' },
    { label: 'Tài liệu' },
  ];
}
