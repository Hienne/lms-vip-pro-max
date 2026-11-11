import {
  afterRenderEffect,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import type { BodyFormat } from '@lms/contracts';
import { Button, Card, Textarea } from '@lms/ui';
import type { AssetValue } from '../../course-draft';
import { LessonInlineMediaStore } from '../../data-access/lesson-inline-media.store';
import { LessonImages } from '../../../../../shared/content/markdown/lesson-images';
import {
  cleanLessonHtml,
  lessonEditorHtml,
  lessonImageIds,
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
  imports: [Button, Card, Textarea, LessonImages],
  providers: [LessonInlineMediaStore],
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
  readonly ownerOrgId = input<number>();
  readonly assets = input<readonly AssetValue[]>([]);
  readonly imageAdded = output<AssetValue>();
  readonly uploadingChange = output<boolean>();

  protected readonly tools = TOOLS;
  protected readonly media = inject(LessonInlineMediaStore);
  protected readonly sourceMode = signal(false);
  protected readonly sourceText = signal('');
  protected readonly inTable = signal(false);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  private readonly document = inject(DOCUMENT);
  private readonly editor = viewChild<ElementRef<HTMLElement>>('editor');
  private lastValue: string | undefined;
  private selection: Range | undefined;
  protected readonly imageIds = computed(() =>
    this.assets().map((asset) => asset.assetId),
  );

  private readonly reportUpload = afterRenderEffect(() => {
    this.uploadingChange.emit(this.media.pending$());
  });

  private readonly render = afterRenderEffect({
    write: () => {
      const editor = this.editor()?.nativeElement;
      const value = this.value();
      const format = this.format();
      if (!editor || value === this.lastValue) return;
      untracked(() => {
        editor.innerHTML = lessonEditorHtml(value, format, this.document);
        this.lastValue = value;
        this.selection = undefined;
      });
    },
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
    const node = selection.anchorNode;
    this.inTable.set(
      !!(node instanceof Element ? node : node?.parentElement)?.closest(
        'td,th',
      ),
    );
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
    const images = Array.from(clipboard.files).filter((file) =>
      file.type.startsWith('image/'),
    );
    const fragment = this.document.createElement('template');
    fragment.innerHTML = clipboard.getData('text/html');
    const embedded: File[] = [];
    for (const image of fragment.content.querySelectorAll('img')) {
      const match = image
        .getAttribute('src')
        ?.match(/^data:image\/(png|jpeg|webp);base64,([\s\S]+)$/i);
      if (!match) continue;
      try {
        const bytes = Uint8Array.from(atob(match[2]), (character) =>
          character.charCodeAt(0),
        );
        if (!images.length)
          embedded.push(
            new File([bytes], `anh-dan-${embedded.length + 1}.${match[1]}`, {
              type: 'image/' + match[1].toLowerCase(),
            }),
          );
      } catch {
        continue;
      }
      image.remove();
    }
    const html = cleanLessonHtml(fragment.innerHTML, this.document);
    if (html) this.document.execCommand('insertHTML', false, html);
    else if (clipboard.getData('text/plain'))
      this.document.execCommand(
        'insertText',
        false,
        clipboard.getData('text/plain'),
      );
    this.capture();
    if (images.length || embedded.length)
      this.uploadImages([...images, ...embedded]);
  }

  protected pickedImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadImages(Array.from(input.files ?? []));
    input.value = '';
  }

  private uploadImages(files: readonly File[]): void {
    this.rememberSelection();
    this.media.upload(
      files,
      this.ownerOrgId(),
      lessonImageIds(this.value(), this.document).length,
      (asset) => {
        this.imageAdded.emit(asset);
        this.insertHtml(
          `<img data-asset-id="${asset.assetId}" alt="Ảnh bài học"><p><br></p>`,
        );
      },
    );
  }

  protected toggleSource(): void {
    if (this.sourceMode()) this.applySource();
    else {
      const editor = this.editor()?.nativeElement;
      this.sourceText.set(
        editor?.innerHTML
          ? cleanLessonHtml(editor.innerHTML, this.document)
          : '',
      );
      this.sourceMode.set(true);
    }
  }

  protected sourceChanged(event: Event): void {
    this.sourceText.set((event.target as HTMLTextAreaElement).value);
    this.publishSource();
    this.touched.set(true);
  }

  private publishSource(): string {
    const source = this.document.createElement('template');
    source.innerHTML = this.sourceText();
    // Pasted scripts are lesson examples. Represent their source inside code blocks.
    for (const script of source.content.querySelectorAll('script')) {
      const pre = this.document.createElement('pre');
      const code = this.document.createElement('code');
      code.textContent = script.outerHTML;
      pre.append(code);
      script.replaceWith(pre);
    }
    const html = cleanLessonHtml(source.innerHTML, this.document);
    this.value.set(html);
    this.lastValue = undefined;
    return html;
  }

  private applySource(): void {
    this.publishSource();
    this.sourceMode.set(false);
  }

  protected insertTable(): void {
    const row =
      '<tr><td><p>Ô 1</p></td><td><p>Ô 2</p></td><td><p>Ô 3</p></td></tr>';
    this.insertHtml(
      '<table><tbody>' + row.repeat(3) + '</tbody></table><p><br></p>',
    );
  }

  protected insertCode(): void {
    this.insertHtml(
      '<pre><code>// Nhập hoặc dán đoạn mã tại đây</code></pre><p><br></p>',
    );
  }

  protected extendTable(column: boolean): void {
    const cell = this.selection?.startContainer;
    const element = cell instanceof Element ? cell : cell?.parentElement;
    const selectedCell = element?.closest<HTMLTableCellElement>('td,th');
    const table = selectedCell?.closest('table');
    if (
      !selectedCell ||
      !table ||
      !this.editor()?.nativeElement.contains(table)
    )
      return;
    const selectedRow = selectedCell.parentElement;
    if (!(selectedRow instanceof HTMLTableRowElement)) return;
    if (column) {
      const index = selectedCell.cellIndex + 1;
      for (const row of table.rows)
        row.insertCell(Math.min(index, row.cells.length)).innerHTML =
          '<p><br></p>';
    } else {
      const row = table.insertRow(selectedRow.rowIndex + 1);
      for (let index = 0; index < selectedRow.cells.length; index++)
        row.insertCell().innerHTML = '<p><br></p>';
    }
    this.capture();
  }

  private insertHtml(html: string): void {
    const editor = this.editor()?.nativeElement;
    if (!editor || this.disabled()) return;
    this.focus();
    const selection = this.document.getSelection();
    if (
      this.selection &&
      editor.contains(this.selection.commonAncestorContainer)
    ) {
      selection?.removeAllRanges();
      selection?.addRange(this.selection);
    }
    this.document.execCommand('insertHTML', false, html);
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
