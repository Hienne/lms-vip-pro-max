import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { personalEndpoints, type Anchor } from '@lms/contracts';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';

@Injectable()
export class LessonStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly changes = inject(LearningChanges);
  private readonly params = toSignal(this.route.paramMap);
  private readonly query = toSignal(this.route.queryParamMap);
  private readonly noteText = signal('');
  private readonly anchorState = signal<Anchor>({ type: 'pdf', page: 1 });
  private readonly bookmark = serverMutation(
    (input: { lessonId: string; anchor: Anchor }) =>
      this.client.call(personalEndpoints.toggleBookmark, {
        body: { ...input, label: this.anchorLabel(input.anchor) },
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
      errors: 'toast',
      invalidates: this.changes.saved,
      success: () => 'Đã lưu ghi chú tại vị trí này',
      onSuccess: () => this.noteText.set(''),
    },
  );

  readonly courseId$ = computed(() => this.params()?.get('courseId') ?? '');
  readonly lessonId$ = computed(() => this.params()?.get('lessonId') ?? '');
  readonly anchor$ = this.anchorState.asReadonly();
  readonly noteText$ = this.noteText.asReadonly();
  readonly isSaving$ = computed(
    () => this.bookmark.isPending() || this.note.isPending(),
  );
  readonly isPdf$ = computed(() => this.anchorState().type === 'pdf');
  readonly page$ = computed(() => {
    const anchor = this.anchorState();
    return anchor.type === 'pdf' ? anchor.page : 1;
  });
  readonly seconds$ = computed(() => {
    const anchor = this.anchorState();
    return anchor.type === 'video' ? anchor.seconds : 0;
  });

  constructor() {
    const query = this.query();
    const page = Number(query?.get('page'));
    const seconds = Number(query?.get('seconds'));
    if (query?.get('anchorType') === 'video')
      this.anchorState.set({
        type: 'video',
        seconds: Number.isFinite(seconds) ? Math.max(0, seconds) : 0,
      });
    else
      this.anchorState.set({
        type: 'pdf',
        page: Number.isInteger(page) && page > 0 ? page : 1,
      });
  }

  setPage(value: string | number): void {
    const page = Math.max(1, Math.trunc(Number(value) || 1));
    this.anchorState.set({ type: 'pdf', page });
  }
  setSeconds(value: string | number): void {
    const seconds = Math.max(0, Math.trunc(Number(value) || 0));
    this.anchorState.set({ type: 'video', seconds });
  }
  setNote(value: string): void {
    this.noteText.set(value);
  }
  saveBookmark(): void {
    const lessonId = this.lessonId$();
    if (lessonId) this.bookmark.run({ lessonId, anchor: this.anchorState() });
  }
  saveNote(): void {
    const lessonId = this.lessonId$();
    const text = this.noteText().trim();
    if (lessonId && text)
      this.note.run({ lessonId, anchor: this.anchorState(), text });
  }

  private anchorLabel(anchor: Anchor): string {
    return anchor.type === 'pdf'
      ? `Trang ${anchor.page}`
      : `Video ${Math.floor(anchor.seconds / 60)}:${String(anchor.seconds % 60).padStart(2, '0')}`;
  }
}
