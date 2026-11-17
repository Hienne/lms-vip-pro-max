import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Button, DrawerOutlet, Icon, IconButton } from '@lms/ui';
import { map } from 'rxjs';
import { ConversationsStore } from '../../../core/assistant/conversations.store';
import { SourceViewerStore } from '../../../core/assistant/source-viewer.store';
import { DocumentTrackerStore } from '../../../core/knowledge/document-tracker.store';
import { ConversationList } from '../../../shared/assistant/conversation-list/conversation-list';
import { SourceText } from '../../../shared/assistant/source-text/source-text';
import { AskForm } from './components/ask-form/ask-form';
import { ChatLog } from './components/chat-log/chat-log';
import { DocumentList } from './components/document-list/document-list';
import { DocumentUpload } from './components/document-upload/document-upload';
import { DuplicateDocuments } from './components/duplicate-documents/duplicate-documents';
import { AssistantStore } from './data-access/assistant.store';
import {
  DOCUMENTS_PAGE_SIZE,
  KnowledgeDocumentsStore,
} from './data-access/knowledge-documents.store';

/** The query parameter that keeps the documents drawer open, so a link (or Back) can open or close it. */
export const DOCUMENTS_PARAM = 'tai-lieu';

/**
 * "Trợ lý AI": the saved conversations on the left (a drawer on a narrow screen), the chat in the
 * middle, and the source a citation opens on the right (the shell's drawer on a narrow screen). The
 * line under the question says which documents it searches and opens them in a drawer (upload, the
 * list, duplicates) without leaving the conversation. The route uses the `workspace` layout, so
 * each region scrolls inside itself.
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
    IconButton,
    NgTemplateOutlet,
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
  private readonly tracker = inject(DocumentTrackerStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly pageSize = DOCUMENTS_PAGE_SIZE;

  /** The documents drawer is open while the URL carries `?tai-lieu`. */
  protected readonly documentsOpen$ = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.has(DOCUMENTS_PARAM))),
    { initialValue: false },
  );

  /** The signed-in user's own files still being indexed; they cannot be cited yet. */
  protected readonly processing$ = computed(
    () => this.tracker.pending$().length,
  );

  protected openDocuments(): void {
    this.setDocumentsParam('1');
  }

  protected closeDocuments(): void {
    this.setDocumentsParam(null);
  }

  private setDocumentsParam(value: '1' | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [DOCUMENTS_PARAM]: value },
      queryParamsHandling: 'merge',
    });
  }
}
