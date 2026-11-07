import { Component, input, output } from '@angular/core';
import { Button } from '@lms/ui';
import { ContentThumbnail } from '../content-thumbnail/content-thumbnail';

/** Shared cover controls; the owning authoring store uploads and retains the selected asset. */
@Component({
  selector: 'app-community-cover-picker',
  imports: [Button, ContentThumbnail],
  templateUrl: './cover-picker.html',
  styleUrl: './cover-picker.scss',
})
export class CoverPicker {
  readonly kind = input('article');
  readonly contentId = input<number>(0);
  readonly revisionAssetId = input<number | null>();
  readonly preview = input<string>();
  readonly hasCover = input(false);
  readonly disabled = input(false);
  readonly uploading = input(false);
  readonly error = input<string>();
  readonly fileChosen = output<File>();
  readonly removed = output<void>();

  protected choose(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (file) this.fileChosen.emit(file);
    input.value = '';
  }
}
