import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, DrawerOutlet, Icon, IconButton } from '@lms/ui';
import { ConversationsStore } from '../../../core/assistant/conversations.store';
import { SourceViewerStore } from '../../../core/assistant/source-viewer.store';
import { ConversationList } from '../../../shared/assistant/conversation-list/conversation-list';
import { SourceText } from '../../../shared/assistant/source-text/source-text';
import { AskForm } from './components/ask-form/ask-form';
import { ChatLog } from './components/chat-log/chat-log';
import { AssistantStore } from './data-access/assistant.store';
import { KnowledgeDocumentsStore } from './data-access/knowledge-documents.store';

/**
 * "Trợ lý AI": the saved conversations on the left (a drawer on a narrow screen), the chat in the
 * middle, and the source a citation opens on the right (the shell's drawer on a narrow screen). The
 * chat says which documents it searches; they are managed on `/assistant/tai-lieu`. The route
 * uses the `workspace` layout, so each region scrolls inside itself.
 */
@Component({
  selector: 'app-assistant',
  imports: [
    AskForm,
    Button,
    ChatLog,
    ConversationList,
    DrawerOutlet,
    Icon,
    IconButton,
    NgTemplateOutlet,
    RouterLink,
    SourceText,
  ],
  providers: [AssistantStore, KnowledgeDocumentsStore],
  host: {
    '[class.assistant--history]': 'store.historyBeside$()',
    '[class.assistant--source]': 'store.sourceBeside$()',
  },
  templateUrl: './assistant.html',
  styleUrl: './assistant.scss',
})
export class Assistant {
  protected readonly store = inject(AssistantStore);
  protected readonly documents = inject(KnowledgeDocumentsStore);
  protected readonly history = inject(ConversationsStore);
  protected readonly viewer = inject(SourceViewerStore);
}
