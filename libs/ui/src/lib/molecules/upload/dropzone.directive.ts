import {
  booleanAttribute,
  Directive,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Drag-and-drop file target on a `<label>` that contains a hidden file input
 * (`<label uiDropzone accept=".pdf" (files)="add($event)">… <input type="file" hidden /></label>`).
 * Dropped files and files chosen in the picker are emitted through the same `files` output;
 * the zone can be reached with Tab and opens the picker on Enter or Space. It validates nothing:
 * type and size rules belong to the feature and the server. `accept` and `multiple` are passed
 * to the input.
 */
@Directive({
  selector: 'label[uiDropzone]',
  host: {
    class: 'dropzone',
    tabindex: '0',
    '[class.is-over]': 'over()',
    '(dragenter)': 'enter($event)',
    '(dragover)': 'enter($event)',
    '(dragleave)': 'leave($event)',
    '(drop)': 'drop($event)',
    '(change)': 'picked($event)',
    '(keydown.enter)': 'open($event)',
    '(keydown.space)': 'open($event)',
  },
})
export class Dropzone {
  /** Comma-separated types or extensions, as on a file input. */
  readonly accept = input('');
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly files = output<File[]>();

  protected readonly over = signal(false);
  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    afterRenderEffect(() => {
      const control = this.fileInput();
      if (!control) return;
      control.accept = this.accept();
      control.multiple = this.multiple();
    });
  }

  private fileInput(): HTMLInputElement | null {
    return this.host.querySelector('input[type="file"]');
  }

  protected enter(event: Event): void {
    event.preventDefault();
    this.over.set(true);
  }

  /** `dragleave` also fires when the pointer moves onto a child; only leaving the zone counts. */
  protected leave(event: DragEvent): void {
    const next = event.relatedTarget;
    if (!(next instanceof Node && this.host.contains(next)))
      this.over.set(false);
  }

  protected drop(event: Event): void {
    event.preventDefault();
    this.over.set(false);
    this.emit((event as DragEvent).dataTransfer?.files);
  }

  protected picked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.emit(input.files);
    input.value = '';
  }

  protected open(event: Event): void {
    event.preventDefault();
    this.fileInput()?.click();
  }

  private emit(list: ArrayLike<File> | null | undefined): void {
    const files = Array.from(list ?? []);
    if (files.length > 0) this.files.emit(files);
  }
}
