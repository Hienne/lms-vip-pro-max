import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  personalEndpoints,
  type SavedItemView,
  type SavedPage,
} from '@lms/contracts';
import { confirm } from '@lms/ui';
import {
  EMPTY,
  expand,
  filter,
  forkJoin,
  map,
  reduce,
  type Observable,
} from 'rxjs';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import {
  serverData,
  type ServerData,
} from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { anchorText } from '../../../../shared/learning/anchor';

/** The largest page the server sends; the screen reads every page of both kinds. */
export const SAVED_PAGE_SIZE = 100;

/** The lesson page shows both kinds, or one. */
export type SavedKindFilter = 'all' | 'note' | 'bookmark';

type QueryKind = 'notes' | 'bookmarks';
type Counts = SavedPage['counts'];

/** Both kinds, every page, and the counts the server sent with them. */
interface SavedAll {
  readonly items: readonly SavedItemView[];
  readonly counts: Counts;
}

/** An entry of a lesson's page: what to show and where it leads, so the template only prints it. */
export interface SavedRow {
  readonly item: SavedItemView;
  /** The note's text, or the bookmark's label. */
  readonly title: string;
  /** "Trang 3", "Video 1:15" or "Cả bài". */
  readonly where: string;
  readonly link: readonly (string | number)[];
  /** PDF entries open on the saved page. Video entries open the block at its study resume point. */
  readonly query: Readonly<Record<string, number>>;
}

/** A lesson of the index, with how many notes and bookmarks the learner kept on it. */
export interface SavedLesson {
  readonly lessonId: number;
  readonly lessonTitle: string;
  readonly courseId: number;
  readonly courseTitle: string;
  readonly notes: number;
  readonly bookmarks: number;
  /** The newest entry's time, to put the course worked on last first. */
  readonly latest: string;
  readonly rows: readonly SavedRow[];
}

export interface SavedCourse {
  readonly courseId: number;
  readonly courseTitle: string;
  readonly lessons: readonly SavedLesson[];
}

const queryOf = (item: SavedItemView): SavedRow['query'] => {
  const { type, blockId, page } = item.anchor;
  if (blockId === null) return {};
  if (type === 'pdf' && page !== null) return { block: blockId, page };
  if (type === 'video') return { block: blockId };
  return {};
};

/** Reading order inside a lesson: the whole lesson first, then each file block by page or second. */
const byPlace = (a: SavedRow, b: SavedRow): number => {
  const x = a.item.anchor;
  const y = b.item.anchor;
  const rank = (type: string) => (type === 'none' ? 0 : 1);
  return (
    rank(x.type) - rank(y.type) ||
    (x.blockId ?? 0) - (y.blockId ?? 0) ||
    (x.page ?? x.second ?? 0) - (y.page ?? y.second ?? 0) ||
    a.item.createTime.localeCompare(b.item.createTime)
  );
};

const byTitle = (a: SavedLesson, b: SavedLesson): number =>
  a.lessonTitle.localeCompare(b.lessonTitle, 'vi', { numeric: true });

/**
 * "Đã lưu & ghi chú" as a notebook: an index of the lessons the learner kept notes or bookmarks on,
 * grouped by course, and the selected lesson's notes and bookmarks in the order they sit in its files.
 * The selected lesson lives in the URL (`?bai=`), so a reload or a shared link opens the same page.
 */
@Injectable()
export class SavedStore {
  private readonly client = inject(EndpointClient);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changes = inject(LearningChanges);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly state = {
    search: signal(''),
    kind: signal<SavedKindFilter>('all'),
  };

  private readonly lessonParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => Number(params.get('bai')))),
    { initialValue: 0 },
  );

  /** Every page of one kind, merged. Stops when the server does not send the page asked for. */
  private readAll(kind: QueryKind): Observable<SavedPage> {
    const query = { kind, page: 0, size: SAVED_PAGE_SIZE };
    return this.client.call(personalEndpoints.saved, { query }).pipe(
      expand((result, index) =>
        result.page.page === index &&
        (result.page.page + 1) * SAVED_PAGE_SIZE < result.page.totalElements
          ? this.client.call(personalEndpoints.saved, {
              query: { ...query, page: result.page.page + 1 },
            })
          : EMPTY,
      ),
      filter((result, index) => result.page.page === index),
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
    );
  }

  // Typed outright: the field initializer calls `readAll`, so inference cannot settle the type.
  private readonly data: ServerData<SavedAll> = serverData(
    () =>
      forkJoin([this.readAll('notes'), this.readAll('bookmarks')]).pipe(
        map(([notes, bookmarks]) => ({
          items: [...notes.page.items, ...bookmarks.page.items],
          counts: bookmarks.counts,
        })),
      ),
    { reloadOn: this.changes.saved },
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
      invalidates: this.changes.saved,
    },
  );

  // Selectors
  readonly search$ = this.state.search.asReadonly();
  readonly kind$ = this.state.kind.asReadonly();
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  readonly isSaving$ = this.removal.isPending;
  readonly counts$ = computed(
    (): Counts => this.data.value()?.counts ?? { notes: 0, bookmarks: 0 },
  );
  /** Nothing kept at all, before any search: the page shows the way to the lessons instead. */
  readonly isEmpty$ = computed(
    () => this.data.value() !== undefined && !this.data.value()?.items.length,
  );

  private readonly rows = computed<readonly SavedRow[]>(() =>
    (this.data.value()?.items ?? []).map((item) => ({
      item,
      title:
        (item.kind === 'note' ? item.text : item.label) ?? item.lessonTitle,
      where: anchorText(item.anchor),
      link: ['/lesson', item.courseId, item.lessonId],
      query: queryOf(item),
    })),
  );

  /** The rows the search keeps: their text, their lesson or their course holds the words. */
  private readonly matched = computed(() => {
    const q = this.state.search().trim().toLocaleLowerCase('vi');
    if (!q) return this.rows();
    return this.rows().filter((row) =>
      [row.title, row.item.lessonTitle, row.item.courseTitle]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(q),
    );
  });

  /** The index: courses worked on last first, their lessons in title order ("Bài 2" before "Bài 10"). */
  readonly courses$ = computed((): readonly SavedCourse[] => {
    const lessons = new Map<number, SavedRow[]>();
    for (const row of this.matched()) {
      const list = lessons.get(row.item.lessonId) ?? [];
      list.push(row);
      lessons.set(row.item.lessonId, list);
    }
    const courses = new Map<number, SavedLesson[]>();
    for (const rows of lessons.values()) {
      const { item } = rows[0];
      const lesson: SavedLesson = {
        lessonId: item.lessonId,
        lessonTitle: item.lessonTitle,
        courseId: item.courseId,
        courseTitle: item.courseTitle,
        notes: rows.filter((row) => row.item.kind === 'note').length,
        bookmarks: rows.filter((row) => row.item.kind === 'bookmark').length,
        latest: rows
          .map((row) => row.item.createTime)
          .reduce((a, b) => (a > b ? a : b)),
        rows: [...rows].sort(byPlace),
      };
      courses.set(item.courseId, [
        ...(courses.get(item.courseId) ?? []),
        lesson,
      ]);
    }
    const latest = (list: readonly SavedLesson[]) =>
      list.map((lesson) => lesson.latest).reduce((a, b) => (a > b ? a : b));
    return [...courses.values()]
      .sort((a, b) => latest(b).localeCompare(latest(a)))
      .map((list) => ({
        courseId: list[0].courseId,
        courseTitle: list[0].courseTitle,
        lessons: [...list].sort(byTitle),
      }));
  });

  readonly lessonCount$ = computed(() =>
    this.courses$().reduce((sum, course) => sum + course.lessons.length, 0),
  );

  /** The lesson named in the URL while the search keeps it, else the first one of the index. */
  readonly lesson$ = computed((): SavedLesson | undefined => {
    const all = this.courses$().flatMap((course) => course.lessons);
    return (
      all.find((lesson) => lesson.lessonId === this.lessonParam()) ?? all[0]
    );
  });

  /** The selected lesson's entries of the chosen kind, in reading order. */
  readonly entries$ = computed(() => {
    const kind = this.state.kind();
    const rows = this.lesson$()?.rows ?? [];
    return kind === 'all' ? rows : rows.filter((row) => row.item.kind === kind);
  });

  // Setters
  setSearch(value: string): void {
    this.state.search.set(value);
  }

  setKind(value: SavedKindFilter): void {
    this.state.kind.set(value);
  }

  // Commands
  /** Opens another lesson's page; the URL keeps it, without a history entry per click. */
  selectLesson(lessonId: number | string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { bai: Number(lessonId) || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
