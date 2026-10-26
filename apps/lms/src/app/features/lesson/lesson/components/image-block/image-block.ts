import { Component, input, output, signal } from '@angular/core';
import { Button } from '@lms/ui';

/** An `image` block: the picture, its caption, and a line when the file does not load. */
@Component({
  selector: 'app-image-block',
  imports: [Button],
  templateUrl: './image-block.html',
  styleUrl: './image-block.scss',
})
export class ImageBlock {
  readonly src = input.required<string>();
  /** The asset's alt text, else the block title. */
  readonly alt = input.required<string>();
  readonly caption = input<string | null>(null);
  /** "Thử lại": the page claims the block again, which renews the media cookie. */
  readonly retry = output<void>();

  protected readonly failed = signal(false);

  protected retried(): void {
    this.failed.set(false);
    this.retry.emit();
  }
}
