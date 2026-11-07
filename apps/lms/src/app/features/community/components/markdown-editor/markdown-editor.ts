import {
  Component,
  computed,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { COMMUNITY_LIMITS } from '@lms/contracts';
import {
  Button,
  FmtNumPipe,
  Segmented,
  Textarea,
  type SegmentedOption,
} from '@lms/ui';
import { Markdown } from '../../../../shared/content/markdown/markdown';
import { applyMarkdown, type MarkdownAction } from './markdown-format';

type Mode = 'write' | 'preview';

/**
 * The community body editor: a textarea with a short text toolbar and a Soạn / Xem trước switch.
 * It is a Signal Forms value control, so `<app-markdown-editor [formField]="form.body" label="…" />`
 * binds like a native field. The preview is the same renderer the detail page uses.
 */
@Component({
  selector: 'app-markdown-editor',
  imports: [Button, FmtNumPipe, Markdown, Segmented, Textarea],
  templateUrl: './markdown-editor.html',
  styleUrl: './markdown-editor.scss',
})
export class MarkdownEditor implements FormValueControl<string> {
  readonly value = model('');
  readonly touched = model(false);
  readonly disabled = input(false);
  readonly invalid = input(false);
  /** Accessible name of the textarea; the screen's field label sits outside. */
  readonly label = input('Nội dung');
  readonly rows = input(14);

  protected readonly bodyMax = COMMUNITY_LIMITS.body.max;
  protected readonly bodyMin = COMMUNITY_LIMITS.body.min;
  protected readonly modes: readonly SegmentedOption<Mode>[] = [
    { value: 'write', label: 'Soạn' },
    { value: 'preview', label: 'Xem trước' },
  ];
  protected readonly tools: readonly {
    action: MarkdownAction;
    label: string;
  }[] = [
    { action: 'bold', label: 'Đậm' },
    { action: 'italic', label: 'Nghiêng' },
    { action: 'code', label: 'Mã' },
    { action: 'link', label: 'Liên kết' },
    { action: 'list', label: 'Danh sách' },
  ];

  // View-only state of this control: which pane shows.
  protected readonly mode = signal<Mode>('write');
  protected readonly length = computed(() => this.value().length);

  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  protected edit(event: Event): void {
    this.value.set((event.target as HTMLTextAreaElement).value);
  }

  protected format(action: MarkdownAction): void {
    const box = this.box()?.nativeElement;
    if (!box) return;
    const next = applyMarkdown(
      box.value,
      box.selectionStart,
      box.selectionEnd,
      action,
    );
    box.value = next.value;
    box.setSelectionRange(next.selectionStart, next.selectionEnd);
    box.focus();
    this.value.set(next.value);
  }
}
