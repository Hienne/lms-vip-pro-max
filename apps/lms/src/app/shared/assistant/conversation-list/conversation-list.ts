import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { ConversationSummary } from '@lms/contracts';
import {
  Alert,
  AlertAction,
  Button,
  Empty,
  FmtRelativePipe,
  Icon,
  IconButton,
  Input,
  List,
  ListItem,
  Search,
  Skeleton,
} from '@lms/ui';

/**
 * The saved conversations as a list: search by title, a "new conversation" button, and per row
 * open, rename (in place) and delete. It shows what it is given and says what the user asked for;
 * the shared `ConversationsStore` does the work, so the quick chat and the assistant page list the
 * same conversations. After a delete, focus moves to the list instead of to a row that is gone.
 */
@Component({
  selector: 'app-conversation-list',
  imports: [
    Alert,
    AlertAction,
    Button,
    Empty,
    FmtRelativePipe,
    Icon,
    IconButton,
    Input,
    List,
    ListItem,
    Search,
    Skeleton,
  ],
  templateUrl: './conversation-list.html',
  styleUrl: './conversation-list.scss',
})
export class ConversationList {
  readonly items = input.required<readonly ConversationSummary[]>();
  /** The conversation the chat is on, marked in the list. */
  readonly activeId = input<number | null>(null);
  readonly loading = input(false);
  readonly failed = input(false);
  /** A search is typed, so an empty list means "no match" rather than "nothing saved". */
  readonly searching = input(false);
  /** Why the last open failed, or null. */
  readonly openError = input<string | null>(null);
  /** A command is on its way, or a reply is: row actions wait. */
  readonly busy = input(false);

  readonly searched = output<string>();
  readonly created = output<void>();
  readonly opened = output<number>();
  readonly renamed = output<{ readonly id: number; readonly title: string }>();
  readonly removed = output<ConversationSummary>();
  readonly removedAll = output<void>();
  readonly retried = output<void>();

  protected readonly editingId = signal<number | null>(null);
  private readonly document = inject(DOCUMENT);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private readonly editor = viewChild<ElementRef<HTMLInputElement>>('editor');
  private lastCount = 0;

  protected readonly showEmpty = computed(
    () => !this.loading() && !this.failed() && this.items().length === 0,
  );

  constructor() {
    // The row that had focus is gone after a delete: the list takes it, so a keyboard user is not
    // dropped at the top of the page.
    afterRenderEffect(() => {
      const count = this.items().length;
      const shrank = count < this.lastCount;
      this.lastCount = count;
      if (!shrank) return;
      const active = this.document.activeElement;
      // A removed row leaves focus on the body; focus anywhere else is the user's own.
      const lost = !active || active === this.document.body;
      if (lost) untracked(() => this.list())?.nativeElement.focus();
    });
    afterRenderEffect(() => {
      const editor = this.editor();
      if (editor) {
        editor.nativeElement.focus();
        editor.nativeElement.select();
      }
    });
  }

  protected startRename(conversation: ConversationSummary): void {
    this.editingId.set(conversation.id);
  }

  protected cancelRename(): void {
    this.editingId.set(null);
  }

  protected saveRename(conversation: ConversationSummary, raw: string): void {
    const title = raw.trim();
    this.editingId.set(null);
    if (title && title !== conversation.title) {
      this.renamed.emit({ id: conversation.id, title });
    }
  }
}
