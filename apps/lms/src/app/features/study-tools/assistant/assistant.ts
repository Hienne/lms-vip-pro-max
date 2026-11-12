import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Button, DrawerOutlet, Icon } from '@lms/ui';
import { ConversationsStore } from '../../../core/assistant/conversations.store';
import { ConversationList } from '../../../shared/assistant/conversation-list/conversation-list';
import { AskForm } from './components/ask-form/ask-form';
import { ChatLog } from './components/chat-log/chat-log';
import { DocumentList } from './components/document-list/document-list';
import { DocumentUpload } from './components/document-upload/document-upload';
import { DuplicateDocuments } from './components/duplicate-documents/duplicate-documents';
import {
  AssistantStore,
  DOCUMENTS_PAGE_SIZE,
} from './data-access/assistant.store';

/**
 * "Trợ lý AI": a chat that fills the page, answered from the shared documents, and a documents
 * panel beside it (a drawer on a narrow screen) to add documents and follow their processing, and
 * the saved conversations in a column on the left (a drawer on a narrow screen). The route uses the
 * `workspace` layout, so the chat and the panels scroll inside themselves.
 */
@Component({
  selector: 'app-assistant',
  imports: [
    AskForm,
    Button,
    ChatLog,
    ConversationList,
    DocumentList,
    DocumentUpload,
    DrawerOutlet,
    DuplicateDocuments,
    Icon,
    NgTemplateOutlet,
  ],
  providers: [AssistantStore],
  host: {
    '[class.assistant--panel]': 'store.panelBeside$()',
    '[class.assistant--history]': 'store.historyBeside$()',
  },
  templateUrl: './assistant.html',
  styleUrl: './assistant.scss',
})
export class Assistant {
  protected readonly store = inject(AssistantStore);
  protected readonly history = inject(ConversationsStore);
  protected readonly pageSize = DOCUMENTS_PAGE_SIZE;
}
