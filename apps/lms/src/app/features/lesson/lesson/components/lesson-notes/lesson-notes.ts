import { Component, input, linkedSignal, output } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
} from '@angular/forms/signals';
import {
  NOTE_MAX_LENGTH,
  type Anchor,
  type LessonBookmarkView,
  type LessonNoteView,
} from '@lms/contracts';
import {
  Button,
  ErrorState,
  Field,
  FmtRelativePipe,
  Icon,
  IconButton,
  Skeleton,
  Textarea,
} from '@lms/ui';
import { anchorText } from '../../anchor';

/**
 * "Ghi chú" of the lesson side panel: a form for a note at the spot on screen, the lesson's notes
 * and its bookmarks. It owns the form only; the lists, the commands and the confirm are the store's.
 */
@Component({
  selector: 'app-lesson-notes',
  imports: [
    Button,
    ErrorState,
    Field,
    FmtRelativePipe,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Skeleton,
    Textarea,
  ],
  templateUrl: './lesson-notes.html',
  styleUrl: './lesson-notes.scss',
})
export class LessonNotes {
  /** Where a new note goes, in words: "Trang 3", "Video 1:15" or "bài học". */
  readonly anchorLabel = input.required<string>();
  readonly notes = input.required<readonly LessonNoteView[]>();
  readonly bookmarks = input.required<readonly LessonBookmarkView[]>();
  readonly loading = input(false);
  readonly error = input<{ readonly message: string } | undefined>(undefined);
  readonly saving = input(false);
  /** Changes when a note was saved: the form starts empty again. */
  readonly savedKey = input(0);

  readonly add = output<string>();
  readonly remove = output<LessonNoteView>();
  readonly follow = output<Anchor>();
  readonly retry = output<void>();

  protected readonly anchorText = anchorText;

  private readonly model = linkedSignal(() => {
    this.savedKey();
    return { text: '' };
  });
  protected readonly noteForm = form(
    this.model,
    (path) => {
      required(path.text, { message: 'Hãy nhập nội dung ghi chú.' });
      maxLength(path.text, NOTE_MAX_LENGTH, {
        message: `Ghi chú tối đa ${NOTE_MAX_LENGTH} ký tự.`,
      });
    },
    {
      submission: {
        action: async () => {
          this.add.emit(this.model().text.trim());
        },
      },
    },
  );
}
