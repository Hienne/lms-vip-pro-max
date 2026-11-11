import {
  afterRenderEffect,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import type { BodyFormat } from '@lms/contracts';
import { Button, Card } from '@lms/ui';
import {
  cleanLessonHtml,
  lessonEditorHtml,
} from '../../../../../shared/content/markdown/lesson-html';

const TOOLS = [
  { command: 'bold', label: 'Đậm' },
  { command: 'italic', label: 'Nghiêng' },
  { command: 'underline', label: 'Gạch chân' },
  { command: 'formatBlock', label: 'Tiêu đề', value: 'h2' },
  { command: 'insertUnorderedList', label: 'Danh sách' },
  { command: 'insertOrderedList', label: 'Đánh số' },
  { command: 'undo', label: 'Hoàn tác' },
  { command: 'redo', label: 'Làm lại' },
] as const;
type Tool = (typeof TOOLS)[number];

@Component({
  selector: 'app-lesson-text-editor',
  imports: [Button, Card],
  templateUrl: './lesson-text-editor.html',
  styleUrls: [
    './lesson-text-editor.scss',
    '../../../../../shared/content/markdown/lesson-html.scss',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class LessonTextEditor implements FormValueControl<string> {
  readonly value = model('');
  readonly touched = model(false);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly format = input<BodyFormat>('markdown');

  protected readonly tools = TOOLS;
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  private readonly document = inject(DOCUMENT);
  private readonly editor = viewChild<ElementRef<HTMLElement>>('editor');
  private lastValue: string | undefined;
  private selection: Range | undefined;

  private readonly render = afterRenderEffect(() => {
    const editor = this.editor()?.nativeElement;
    const value = this.value();
    const format = this.format();
    if (!editor || value === this.lastValue) return;
    untracked(() => {
      editor.innerHTML = lessonEditorHtml(value, format, this.document);
      this.lastValue = value;
      this.selection = undefined;
    });
  });

  focus(): void {
    this.editor()?.nativeElement.focus();
  }

  protected rememberSelection(): void {
    const editor = this.editor()?.nativeElement;
    const selection = this.document.getSelection();
    if (
      !editor ||
      !selection?.rangeCount ||
      !editor.contains(selection.anchorNode)
    )
      return;
    this.selection = selection.getRangeAt(0).cloneRange();
    this.selected.set(
      new Set(
        TOOLS.flatMap(({ command }) => {
          if (command === 'undo' || command === 'redo') return [];
          const active =
            command === 'formatBlock'
              ? this.document.queryCommandValue?.(command) === 'h2'
              : this.document.queryCommandState?.(command);
          return active ? [command] : [];
        }),
      ),
    );
  }

  protected formatText(tool: Tool): void {
    const editor = this.editor()?.nativeElement;
    if (!editor || this.disabled()) return;
    this.focus();
    if (
      this.selection &&
      editor.contains(this.selection.commonAncestorContainer)
    ) {
      const selection = this.document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(this.selection);
    }
    const value =
      'value' in tool
        ? this.selected().has(tool.command)
          ? 'p'
          : tool.value
        : undefined;
    // Editing commands retain the browser's undo history across formatting and paste.
    this.document.execCommand(tool.command, false, value);
    this.capture();
  }

  protected paste(event: ClipboardEvent): void {
    event.preventDefault();
    const clipboard = event.clipboardData;
    if (!clipboard || this.disabled()) return;
    const html = cleanLessonHtml(clipboard.getData('text/html'), this.document);
    if (html) this.document.execCommand('insertHTML', false, html);
    else
      this.document.execCommand(
        'insertText',
        false,
        clipboard.getData('text/plain'),
      );
    this.capture();
  }

  protected capture(): void {
    const editor = this.editor()?.nativeElement;
    if (!editor || this.disabled()) return;
    this.rememberSelection();
    const html = cleanLessonHtml(editor.innerHTML, this.document);
    this.lastValue = html;
    this.value.set(html);
  }

  protected blurred(): void {
    this.rememberSelection();
    this.touched.set(true);
  }
}
