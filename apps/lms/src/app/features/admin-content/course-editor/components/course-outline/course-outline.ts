import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, inject, input, output } from '@angular/core';
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
  SortableItem,
  SortableList,
  type SortableMove,
} from '@lms/ui';
import { firstValueFrom } from 'rxjs';
import type { LessonTarget } from '../../data-access/course-editor.store';
import {
  BLOCK_TYPES,
  draftTotals,
  lessonProblem,
  newChapter,
  newLesson,
  type ChapterValue,
  type CourseDraftValue,
} from '../../course-draft';

/**
 * Step 2 of the editor: chapters and their lessons. Chapters are renamed in place, lessons are
 * reordered by drag or the move buttons and opened in the lesson drawer. It edits the page's form
 * through the field tree it is given.
 */
@Component({
  selector: 'app-course-outline',
  imports: [
    Badge,
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
    SortableItem,
    SortableList,
  ],
  templateUrl: './course-outline.html',
  styleUrl: './course-outline.scss',
})
export class CourseOutline {
  readonly draft = input.required<FieldTree<CourseDraftValue>>();
  readonly editLesson = output<LessonTarget>();

  private readonly dialog = inject(Dialog);

  protected readonly blockTypes = BLOCK_TYPES;
  protected readonly problemOf = lessonProblem;
  protected readonly totals = computed(() =>
    draftTotals(this.draft()().value()),
  );

  private get chapters() {
    return this.draft().chapters().value;
  }

  protected addChapter(): void {
    this.chapters.update((list) => [...list, newChapter(list.length + 1)]);
  }

  protected async removeChapter(index: number): Promise<void> {
    const chapter = this.chapters()[index];
    if (
      chapter.lessons.length &&
      !(await firstValueFrom(
        confirm(this.dialog, {
          title: 'Xóa chương?',
          message: `Chương có ${chapter.lessons.length} bài học sẽ bị xóa cùng khi lưu.`,
          confirmLabel: 'Xóa chương',
          tone: 'danger',
        }),
      ))
    ) {
      return;
    }
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
    const confirmed = await firstValueFrom(
      confirm(this.dialog, {
        title: 'Xóa bài học?',
        message: 'Bài học và các khối nội dung sẽ bị xóa khi lưu.',
        confirmLabel: 'Xóa',
        tone: 'danger',
      }),
    );
    if (!confirmed) return;
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
