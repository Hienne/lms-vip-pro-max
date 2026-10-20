import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { personalEndpoints, type Anchor, type SavedItem } from '@lms/contracts';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
@Injectable()
export class LessonStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly changes = inject(LearningChanges);
  private readonly params = toSignal(this.route.paramMap);
  private readonly query = toSignal(this.route.queryParamMap);
  private readonly state = {
    anchor: linkedSignal((): Anchor => {
      const q = this.query(),
        p = Number(q?.get('page')),
        t = Number(q?.get('seconds'));
      return q?.get('anchorType') === 'video'
        ? { type: 'video', seconds: Number.isFinite(t) ? Math.max(0, t) : 0 }
        : { type: 'pdf', page: Number.isInteger(p) && p > 0 ? p : 1 };
    }),
    noteRevision: signal(0),
  };
  private readonly notes = serverData(
    () =>
      this.client.call(personalEndpoints.saved, {
        query: { type: 'notes', page: 0, size: 100, sort: 'createdAt,desc' },
      }),
    { reloadOn: this.changes.saved },
  );
  private readonly bookmarks = serverData(
    () =>
      this.client.call(personalEndpoints.saved, {
        query: {
          type: 'bookmarks',
          page: 0,
          size: 100,
          sort: 'createdAt,desc',
        },
      }),
    { reloadOn: this.changes.saved },
  );
  private readonly bookmark = serverMutation(
    (input: { lessonId: string; anchor: Anchor }) =>
      this.client.call(personalEndpoints.toggleBookmark, {
        body: {
          ...input,
          label:
            input.anchor.type === 'pdf'
              ? `Trang ${input.anchor.page}`
              : `Video ${input.anchor.seconds} giây`,
        },
      }),
    {
      errors: 'toast',
      invalidates: this.changes.saved,
      success: () => 'Đã đánh dấu vị trí này',
    },
  );
  private readonly note = serverMutation(
    (input: { lessonId: string; anchor: Anchor; text: string }) =>
      this.client.call(personalEndpoints.addNote, { body: input }),
    {
      errors: 'alert',
      invalidates: this.changes.saved,
      success: () => 'Đã lưu ghi chú tại vị trí này',
      onSuccess: () => this.setNoteRevision(this.state.noteRevision() + 1),
    },
  );
  readonly courseId$ = computed(() => this.params()?.get('courseId') ?? '');
  readonly lessonId$ = computed(() => this.params()?.get('lessonId') ?? '');
  readonly notes$ = computed(
    () =>
      this.notes
        .value()
        ?.items.filter((x) => x.lessonId === this.lessonId$()) ?? [],
  );
  readonly bookmarks$ = computed(
    () =>
      this.bookmarks
        .value()
        ?.items.filter((x) => x.lessonId === this.lessonId$()) ?? [],
  );
  readonly lessonTitle$ = computed(
    () =>
      this.notes$()[0]?.lessonTitle ??
      this.bookmarks$()[0]?.lessonTitle ??
      'Nội dung bài học',
  );
  readonly courseTitle$ = computed(
    () =>
      this.notes$()[0]?.courseTitle ??
      this.bookmarks$()[0]?.courseTitle ??
      'Khóa học',
  );
  readonly anchor$ = this.state.anchor.asReadonly();
  readonly noteRevision$ = this.state.noteRevision.asReadonly();
  readonly saveError$ = this.note.error;
  readonly readError$ = computed(
    () => this.notes.error() ?? this.bookmarks.error(),
  );
  readonly isSaving$ = computed(
    () => this.bookmark.isPending() || this.note.isPending(),
  );
  readonly isPdf$ = computed(() => this.anchor$().type === 'pdf');
  readonly page$ = computed(() => {
    const a = this.anchor$();
    return a.type === 'pdf' ? a.page : 1;
  });
  readonly seconds$ = computed(() => {
    const a = this.anchor$();
    return a.type === 'video' ? a.seconds : 0;
  });
  readonly tabs$ = computed(() => [
    { id: 'notes', label: 'Ghi chú', count: this.notes$().length },
  ]);
  private setNoteRevision(value: number): void {
    this.state.noteRevision.set(value);
  }
  setAnchor(anchor: Anchor): void {
    this.state.anchor.set(anchor);
  }
  setPage(value: string | number): void {
    this.setAnchor({
      type: 'pdf',
      page: Math.max(1, Math.trunc(Number(value) || 1)),
    });
  }
  setSeconds(value: string | number): void {
    this.setAnchor({
      type: 'video',
      seconds: Math.max(0, Math.trunc(Number(value) || 0)),
    });
  }
  saveBookmark(): void {
    if (this.lessonId$())
      this.bookmark.run({ lessonId: this.lessonId$(), anchor: this.anchor$() });
  }
  saveNote(text: string): void {
    if (this.lessonId$() && text.trim())
      this.note.run({
        lessonId: this.lessonId$(),
        anchor: this.anchor$(),
        text: text.trim(),
      });
  }
  jump(item: SavedItem): void {
    this.setAnchor(item.anchor);
  }
  retry(): void {
    this.notes.reload();
    this.bookmarks.reload();
  }
}
