import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  personalEndpoints,
  type SavedItemView,
  type SavedPage,
} from '@lms/contracts';
import { confirm } from '@lms/ui';
import { filter } from 'rxjs';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import {
  serverData,
  type ServerData,
} from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { anchorText } from '../../../../shared/learning/anchor';

export const SAVED_PAGE_SIZE = 20;

type Tab = 'notes' | 'bookmarks';
type Counts = { readonly notes: number; readonly bookmarks: number };

/** A row of the page: what to show and where it leads, so the template only prints it. */
export interface SavedRow {
  readonly item: SavedItemView;
  /** The note's text, or the bookmark's label. */
  readonly title: string;
  /** "Trang 3", "Video 1:15", or nothing for a note on the whole lesson. */
  readonly where: string;
  readonly link: readonly (string | number)[];
  /** `?block=&page=` or `?block=&t=`: the lesson opens on the spot (nothing for a whole-lesson note). */
  readonly query: Readonly<Record<string, number>>;
}

const queryOf = (item: SavedItemView): SavedRow['query'] => {
  const { type, blockId, page, second } = item.anchor;
  if (blockId === null) return {};
  if (type === 'pdf' && page !== null) return { block: blockId, page };
  if (type === 'video' && second !== null) return { block: blockId, t: second };
  return {};
};

/** "Đã lưu & ghi chú": the learner's notes and bookmarks across lessons, one tab and one page at a time. */
@Injectable()
export class SavedStore {
  private readonly client = inject(EndpointClient);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changes = inject(LearningChanges);

  private readonly state = {
    tab: signal<Tab>('notes'),
    page: signal(0),
    /** The counts of both tabs; they stay while the other tab loads, so the tab labels do not blink. */
    counts: linkedSignal<Counts | undefined, Counts | undefined>({
      source: () => this.data.value()?.counts,
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  // Typed outright: `state` and `data` read each other, so inference cannot settle either.
  private readonly data: ServerData<SavedPage> = serverData(
    (query: { kind: Tab; page: number; size: number }) =>
      this.client.call(personalEndpoints.saved, { query }),
    {
      params: () => ({
        kind: this.state.tab(),
        page: this.state.page(),
        size: SAVED_PAGE_SIZE,
      }),
      reloadOn: this.changes.saved,
    },
  );

  private readonly removal = serverMutation<SavedItemView, null>(
    (item) =>
      item.kind === 'note'
        ? this.client.call(personalEndpoints.deleteNote, {
            params: { noteId: item.id },
          })
        : this.client.call(personalEndpoints.deleteBookmark, {
            params: { bookmarkId: item.id },
          }),
    {
      errors: 'toast',
      success: (item) =>
        item.kind === 'note' ? 'Đã xóa ghi chú' : 'Đã bỏ đánh dấu',
      // The last row of a later page is gone: that page no longer exists, so step back to the one before.
      onSuccess: () => {
        const rows = this.data.value()?.page.items.length ?? 0;
        if (rows === 1 && this.state.page() > 0) {
          this.setPage(this.state.page() - 1);
        }
      },
      invalidates: this.changes.saved,
    },
  );

  // Selectors
  readonly tab$ = this.state.tab.asReadonly();
  readonly page$ = this.state.page.asReadonly();
  readonly total$ = computed(() => this.data.value()?.page.totalElements ?? 0);
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  readonly isSaving$ = this.removal.isPending;
  readonly rows$ = computed<readonly SavedRow[]>(() =>
    (this.data.value()?.page.items ?? []).map((item) => {
      const where = anchorText(item.anchor);
      return {
        item,
        title:
          (item.kind === 'note' ? item.text : item.label) ?? item.lessonTitle,
        where: where === 'Cả bài' ? '' : where,
        link: ['/lesson', item.courseId, item.lessonId],
        query: queryOf(item),
      };
    }),
  );
  readonly tabs$ = computed(() => {
    const counts = this.state.counts();
    return [
      { id: 'notes', label: 'Ghi chú', count: counts?.notes },
      { id: 'bookmarks', label: 'Đánh dấu', count: counts?.bookmarks },
    ];
  });

  // Commands
  setTab(tab: string): void {
    this.state.tab.set(tab === 'bookmarks' ? 'bookmarks' : 'notes');
    this.setPage(0);
  }

  setPage(page: number): void {
    this.state.page.set(page);
  }

  /** Asks first: a removed note or bookmark cannot come back. */
  remove(item: SavedItemView): void {
    const note = item.kind === 'note';
    confirm(this.dialog, {
      title: note ? 'Xóa ghi chú?' : 'Bỏ đánh dấu?',
      message: note
        ? 'Ghi chú sẽ bị xóa vĩnh viễn.'
        : 'Đánh dấu sẽ bị bỏ khỏi bài học.',
      confirmLabel: note ? 'Xóa' : 'Bỏ đánh dấu',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.removal.run(item));
  }

  retry(): void {
    this.data.reload();
  }
}
