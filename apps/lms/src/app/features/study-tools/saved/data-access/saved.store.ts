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
import { EMPTY, expand, filter, reduce } from 'rxjs';
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
  /** PDF notes open on the saved page. Video notes open the block at its study resume point. */
  readonly query: Readonly<Record<string, number>>;
}

const queryOf = (item: SavedItemView): SavedRow['query'] => {
  const { type, blockId, page } = item.anchor;
  if (blockId === null) return {};
  if (type === 'pdf' && page !== null) return { block: blockId, page };
  if (type === 'video') return { block: blockId };
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
    search: signal(''),
    lesson: signal(''),
    sort: signal('newest'),
    selectedId: signal<number | null>(null),
    /** The counts of both tabs; they stay while the other tab loads, so the tab labels do not blink. */
    counts: linkedSignal<Counts | undefined, Counts | undefined>({
      source: () => this.data.value()?.counts,
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  // Typed outright: `state` and `data` read each other, so inference cannot settle either.
  private readonly data: ServerData<SavedPage> = serverData(
    (query: { kind: Tab; page: number; size: number }) =>
      this.client.call(personalEndpoints.saved, { query }).pipe(
        expand((result, index) =>
          result.page.page === query.page + index &&
          (result.page.page + 1) * SAVED_PAGE_SIZE < result.page.totalElements
            ? this.client.call(personalEndpoints.saved, {
                query: { ...query, page: result.page.page + 1 },
              })
            : EMPTY,
        ),
        filter((result, index) => result.page.page === query.page + index),
        reduce(
          (all: SavedPage | undefined, next: SavedPage): SavedPage =>
            all
              ? {
                  ...next,
                  page: {
                    ...next.page,
                    items: [...all.page.items, ...next.page.items],
                  },
                }
              : next,
          undefined,
        ),
        filter((result): result is SavedPage => result !== undefined),
      ),
    {
      params: () => ({
        kind: this.state.tab(),
        page: 0,
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
        const rows = this.rows$().length;
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
  readonly total$ = computed(() => this.filteredRows$().length);
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  readonly isSaving$ = this.removal.isPending;
  private readonly allRows = computed<readonly SavedRow[]>(() =>
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
  readonly search$ = this.state.search.asReadonly();
  readonly lesson$ = this.state.lesson.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly lessons$ = computed(() => [
    ...new Map(
      this.allRows().map((row) => [
        String(row.item.lessonId),
        row.item.lessonTitle,
      ]),
    ).entries(),
  ]);
  readonly filteredRows$ = computed(() => {
    const q = this.state.search().trim().toLocaleLowerCase('vi');
    return this.allRows()
      .filter(
        (row) =>
          (!this.state.lesson() ||
            String(row.item.lessonId) === this.state.lesson()) &&
          (!q ||
            [row.title, row.item.lessonTitle, row.item.courseTitle]
              .join(' ')
              .toLocaleLowerCase('vi')
              .includes(q)),
      )
      .sort(
        (a, b) =>
          (this.state.sort() === 'oldest' ? 1 : -1) *
          a.item.createTime.localeCompare(b.item.createTime),
      );
  });
  readonly rows$ = computed(() =>
    this.filteredRows$().slice(
      this.page$() * SAVED_PAGE_SIZE,
      (this.page$() + 1) * SAVED_PAGE_SIZE,
    ),
  );
  readonly selected$ = computed<SavedRow | undefined>(
    () =>
      this.rows$().find((row) => row.item.id === this.state.selectedId()) ??
      this.rows$()[0],
  );
  readonly groups$ = computed(() => {
    const groups = new Map<number, { title: string; rows: SavedRow[] }>();
    for (const row of this.rows$()) {
      const group = groups.get(row.item.lessonId) ?? {
        title: row.item.lessonTitle,
        rows: [],
      };
      group.rows.push(row);
      groups.set(row.item.lessonId, group);
    }
    return [...groups.entries()].map(([id, group]) => ({ id, ...group }));
  });
  setSearch(value: string): void {
    this.state.search.set(value);
    this.setPage(0);
  }
  setLesson(value: string): void {
    this.state.lesson.set(value);
    this.setPage(0);
  }
  setSort(value: string): void {
    this.state.sort.set(value);
    this.setPage(0);
  }
  setSelectedId(id: number): void {
    this.state.selectedId.set(id);
  }
  selectNote(id: number): void {
    this.setSelectedId(id);
  }
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
    this.setLesson('');
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
