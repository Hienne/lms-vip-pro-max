import { Component, inject } from '@angular/core';
import { PageHeader } from '@lms/ui';
import { AskForm } from './components/ask-form/ask-form';
import { ChatLog } from './components/chat-log/chat-log';
import { DocumentList } from './components/document-list/document-list';
import { DocumentUpload } from './components/document-upload/document-upload';
import {
  AssistantStore,
  DOCUMENTS_PAGE_SIZE,
} from './data-access/assistant.store';

/** "Trợ lý AI": ask questions answered from the shared documents, and add documents to them. */
@Component({
  selector: 'app-assistant',
  imports: [AskForm, ChatLog, DocumentList, DocumentUpload, PageHeader],
  providers: [AssistantStore],
  templateUrl: './assistant.html',
  styleUrl: './assistant.scss',
})
export class Assistant {
  protected readonly store = inject(AssistantStore);
  protected readonly pageSize = DOCUMENTS_PAGE_SIZE;
}
