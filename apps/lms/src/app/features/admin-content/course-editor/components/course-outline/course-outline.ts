import { Dialog } from '@angular/cdk/dialog';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  input,
  output,
} from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  confirm,
  FmtMinutesPipe,
  Icon,
  IconButton,
  Input,
  LinkButton,
  Progress,
  SortableItem,
  SortableList,
  Tooltip,
  type SortableMove,
} from '@lms/ui';
import { firstValueFrom } from 'rxjs';
import type { LessonAiState } from '@lms/contracts';
import {
  CourseAiJobStore,
  lessonPlace,
} from '../../data-access/course-ai-job.store';
import type { LessonTarget } from '../../data-access/course-editor.store';
import type { LessonNoteView } from '../../data-access/drafting-fill';
import { SuggestedMark } from '../suggested-mark/suggested-mark';
import {
  isBusy,
  lessonUploadOf,
  UPLOADS_CANCELLED,
  type UploadEntry,
} from '../../data-access/upload-entry';
import {
  BLOCK_TYPES,
  draftTotals,
  lessonProblem,
  newChapter,
  newLesson,
  type ChapterValue,
  type CourseDraftValue,
  type LessonValue,
} from '../../course-draft';

const AI_STATES: Readonly<
  Record<LessonAiState, { label: string; tone: 'neutral' | 'info' | 'success' }>
> = {
  pending: { label: 'Chờ AI', tone: 'neutral' },
  writing: { label: 'AI đang viết', tone: 'info' },
  written: { label: 'AI đã viết', tone: 'success' },
  user_edited: { label: 'Bạn đã sửa', tone: 'neutral' },
};

/**
 * Step 2 of the editor: chapters and their lessons. Chapters are renamed in place, lessons are
 * reordered by drag or the move buttons and opened in the lesson drawer. It edits the page's form
 * through the field tree it is given. A published revision (`editable` false) shows the outline as
 * text, with no control that would change it.
 */
@Component({
  selector: 'app-course-outline',
  imports: [
    Badge,
    SuggestedMark,
    Button,
    Card,
    CardBody,
    CardHeader,
    FmtMinutesPipe,
    FormField,
    Icon,
    IconButton,
    Input,
    LinkButton,
    NgTemplateOutlet,
    Progress,
    SortableItem,
    SortableList,
    Tooltip,
  ],
  templateUrl: './course-outline.html',
  styleUrl: './course-outline.scss',
})
export class CourseOutline {
  readonly draft = input.required<FieldTree<CourseDraftValue>>();
  readonly editable = input(true);
  /**
   * The assistant's line under the lessons it proposed: by saved lesson id (`id:…`), or by row key
   * (`key:…`) for a lesson not saved yet.
   */
  readonly lessonNotes = input<ReadonlyMap<string, LessonNoteView>>(new Map());
  /** The files chosen in this editor by block key: a lesson row shows the ones still on their way. */
  readonly uploads = input<Readonly<Record<string, UploadEntry>>>({});
  readonly editLesson = output<LessonTarget>();
  /** Blocks deleted with files still uploading: the page stops those uploads. */
  readonly uploadsDropped = output<readonly string[]>();

  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);
  protected readonly ai = inject(CourseAiJobStore);

  /** Why the structure cannot change now (the AI is writing the lessons); null when it can. */
  protected readonly lockReason = this.ai.structureLock$;

  /** What the AI is doing with a lesson, as the row says it; undefined for a lesson of the author's. */
  protected readonly stateOf = (
    chapter: number,
    lesson: number,
  ): { label: string; tone: 'neutral' | 'info' | 'success' } | undefined => {
    const state: LessonAiState | undefined = this.ai
      .lessonStates$()
      .get(lessonPlace(chapter, lesson));
    return state ? AI_STATES[state] : undefined;
  };

  /** Block labels by type, keyed loosely for the lesson template's untyped context. */
  protected readonly blockLabels: Readonly<Record<string, string>> =
    Object.fromEntries(
      Object.entries(BLOCK_TYPES).map(([type, { label }]) => [type, label]),
    );
  protected readonly problemOf = lessonProblem;
  /** The assistant's line under each lesson row, by row key. */
  protected readonly notes = computed(
    (): ReadonlyMap<string, LessonNoteView> => {
      const notes = this.lessonNotes();
      const byRow = new Map<string, LessonNoteView>();
      for (const chapter of this.draft()().value().chapters) {
        for (const lesson of chapter.lessons) {
          const note =
            (lesson.id !== undefined
              ? notes.get(`id:${lesson.id}`)
              : undefined) ?? notes.get(`key:${lesson.key}`);
          if (note) byRow.set(lesson.key, note);
        }
      }
      return byRow;
    },
  );
  protected readonly uploadOf = (lesson: LessonValue) =>
    lessonUploadOf(
      lesson.blocks.map((b) => b.key),
      this.uploads(),
    );
  protected readonly totals = computed(() =>
    draftTotals(this.draft()().value()),
  );

  private get chapters() {
    return this.draft().chapters().value;
  }

  /** Adds a chapter and puts the cursor in its title, once the title is on the page. */
  protected addChapter(): void {
    const index = this.chapters().length;
    this.chapters.update((list) => [...list, newChapter(list.length + 1)]);
    afterNextRender(
      () => this.draft().chapters[index]?.title().focusBoundControl(),
      { injector: this.injector },
    );
  }

  /** The keys of the blocks of `lessons` whose file is still on its way. */
  private uploadingKeys(lessons: readonly LessonValue[]): readonly string[] {
    const uploads = this.uploads();
    return lessons
      .flatMap((lesson) => lesson.blocks.map((b) => b.key))
      .filter((key) => isBusy(uploads[key]));
  }

  protected async removeChapter(index: number): Promise<void> {
    const chapter = this.chapters()[index];
    const uploading = this.uploadingKeys(chapter.lessons);
    if (
      chapter.lessons.length &&
      !(await firstValueFrom(
        confirm(this.dialog, {
          title: 'Xóa chương?',
          message: `Chương có ${chapter.lessons.length} bài học sẽ bị xóa cùng khi lưu.${uploading.length ? ` ${UPLOADS_CANCELLED}` : ''}`,
          confirmLabel: 'Xóa chương',
          tone: 'danger',
        }),
      ))
    ) {
      return;
    }
    this.uploadsDropped.emit(uploading);
    this.chapters.update((list) => list.filter((_, i) => i !== index));
  }

  /** Adds a lesson and opens it in the drawer. */
  protected addLesson(chapter: number): void {
    const position = this.chapters()[chapter].lessons.length;
    this.updateChapter(chapter, (c) => ({
      ...c,
      lessons: [...c.lessons, newLesson(position + 1)],
    }));
    this.editLesson.emit({ chapter, lesson: position });
  }

  protected moveLesson(chapter: number, { from, to }: SortableMove): void {
    this.updateChapter(chapter, (c) => {
      const lessons = [...c.lessons];
      const [moved] = lessons.splice(from, 1);
      lessons.splice(to, 0, moved);
      return { ...c, lessons };
    });
  }

  protected async removeLesson(chapter: number, lesson: number): Promise<void> {
    const uploading = this.uploadingKeys([
      this.chapters()[chapter].lessons[lesson],
    ]);
    const confirmed = await firstValueFrom(
      confirm(this.dialog, {
        title: 'Xóa bài học?',
        message: `Bài học và các khối nội dung sẽ bị xóa khi lưu.${uploading.length ? ` ${UPLOADS_CANCELLED}` : ''}`,
        confirmLabel: 'Xóa',
        tone: 'danger',
      }),
    );
    if (!confirmed) return;
    this.uploadsDropped.emit(uploading);
    this.updateChapter(chapter, (c) => ({
      ...c,
      lessons: c.lessons.filter((_, i) => i !== lesson),
    }));
  }

  private updateChapter(
    index: number,
    change: (chapter: ChapterValue) => ChapterValue,
  ): void {
    this.chapters.update((list) =>
      list.map((chapter, i) => (i === index ? change(chapter) : chapter)),
    );
  }
}
