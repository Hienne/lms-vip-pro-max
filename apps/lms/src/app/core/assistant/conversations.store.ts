import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type ConversationDetail,
  conversationEndpoints,
  type ConversationSummary,
} from '@lms/contracts';
import { confirm } from '@lms/ui';
import { filter, Subject, tap, type Observable } from 'rxjs';
import { invalidation } from '../data-access/invalidation';
import { serverData } from '../data-access/server-data';
import { serverMutation } from '../data-access/server-mutation';
import { EndpointClient } from '../http/endpoint-client';
import { SessionStore } from '../session/session.store';

/** How many conversations the history lists; a search narrows it, there is no paging. */
export const CONVERSATIONS_PAGE_SIZE = 50;

/**
 * The caller's saved conversations, shared by the quick chat and the `/assistant` page: the list
 * (newest activity first, searchable by title) and the commands on it. The server owns every
 * conversation; this store only reads the list, renames and deletes, and tells the two chats when
 * a conversation they may have open is gone (`removed`). A chat bumps `touch()` after a turn so
 * the list shows it.
 */
@Injectable({ providedIn: 'root' })
export class ConversationsStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly changes = invalidation();
  private readonly gone = new Subject<number | 'all'>();
  private readonly state = { query: signal(''), listed: signal(false) };

  /** Emits the id of a conversation once it is deleted, or `'all'` after "delete all". */
  readonly removed = this.gone.asObservable();
  readonly query$ = this.state.query.asReadonly();

  private readonly listData = serverData(
    (key: { userId: string; q: string }) =>
      this.client.call(conversationEndpoints.list, {
        query: {
          size: CONVERSATIONS_PAGE_SIZE,
          ...(key.q ? { q: key.q } : {}),
        },
      }),
    {
      // Only a signed-in user has a history, and nothing is fetched until a screen shows the list:
      // the quick chat is on every page, and most visits never open it.
      params: () => {
        const userId = this.session.user$()?.userId;
        return userId && this.state.listed()
          ? { userId, q: this.state.query() }
          : undefined;
      },
      reloadOn: this.changes,
    },
  );

  readonly items$ = computed<readonly ConversationSummary[]>(
    () => this.listData.value()?.items ?? [],
  );
  readonly total$ = computed(() => this.listData.value()?.totalElements ?? 0);
  readonly isLoading$ = this.listData.isLoading;
  readonly loadError$ = this.listData.error;
  /** Nothing saved at all, as opposed to nothing matching the search. */
  readonly isEmpty$ = computed(
    () => this.items$().length === 0 && this.query$() === '',
  );

  private readonly renameMutation = serverMutation(
    (input: { id: number; title: string }) =>
      this.client.call(conversationEndpoints.rename, {
        params: { conversationId: input.id },
        body: { title: input.title },
      }),
    { errors: 'toast', invalidates: this.changes },
  );

  private readonly removeMutation = serverMutation(
    (id: number) =>
      this.client
        .call(conversationEndpoints.remove, { params: { conversationId: id } })
        .pipe(tap(() => this.gone.next(id))),
    { errors: 'toast', invalidates: this.changes },
  );

  private readonly removeAllMutation = serverMutation(
    () => this.client.call(conversationEndpoints.removeAll),
    {
      errors: 'toast',
      invalidates: this.changes,
      onSuccess: () => this.gone.next('all'),
    },
  );

  readonly isChanging$ = computed(
    () =>
      this.renameMutation.isPending() ||
      this.removeMutation.isPending() ||
      this.removeAllMutation.isPending(),
  );

  /** A screen is about to show the list: from now on it is read, and kept fresh. */
  watch(): void {
    this.state.listed.set(true);
  }

  setQuery(query: string): void {
    this.state.query.set(query.trim());
  }

  /** The list shows a turn that was just saved, or the title the first question gave. */
  touch(): void {
    this.changes.bump();
  }

  retryLoad(): void {
    this.listData.reload();
  }

  /** One conversation with its turns, for the chat that reopens it. */
  detail(id: number): Observable<ConversationDetail> {
    return this.client.call(conversationEndpoints.detail, {
      params: { conversationId: id },
    });
  }

  rename(id: number, title: string): void {
    this.renameMutation.run({ id, title });
  }

  /** Deletes one conversation after the user agrees; nothing is sent otherwise. */
  remove(conversation: ConversationSummary): void {
    confirm(this.dialog, {
      title: 'Xoá hội thoại này?',
      message: `“${conversation.title}” và mọi câu trả lời trong đó sẽ bị xoá hẳn, không khôi phục được.`,
      confirmLabel: 'Xoá',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.removeMutation.run(conversation.id));
  }

  /** Deletes every conversation of the caller after the user agrees. */
  removeAll(): void {
    confirm(this.dialog, {
      title: 'Xoá toàn bộ hội thoại?',
      message:
        'Mọi hội thoại của bạn với trợ lý sẽ bị xoá hẳn, không khôi phục được.',
      confirmLabel: 'Xoá tất cả',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.removeAllMutation.run(undefined));
  }
}
