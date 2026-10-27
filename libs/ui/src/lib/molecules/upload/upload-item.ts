import { Component, computed, input } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';
import { Progress } from '../../atoms/progress/progress';

export type UploadState = 'uploading' | 'processing' | 'done' | 'error';

/** The mockup's `fmt.bytes`: MB with one decimal above 1 MB, whole KB (at least 1) below. */
function formatBytes(bytes: number): string {
  return bytes > 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * One file in an upload list (the mockup's `.upload-item`): icon, name, size and, while
 * `uploading`, a progress bar. `processing` is the wait after the last byte, when there is nothing
 * to measure, so it has no bar. `status` is one line of text on what is happening. In the `error`
 * state it is an alert and the projected content is the message; the error icon has a name so the
 * failure is never colour alone.
 */
@Component({
  selector: 'ui-upload-item',
  imports: [Icon, Progress],
  host: {
    class: 'upload-item',
    '[class.is-error]': 'state() === "error"',
    '[attr.role]': 'state() === "error" ? "alert" : null',
  },
  template: `
    @if (state() === 'error') {
      <ui-icon name="circle-x" [label]="errorLabel()" />
    } @else {
      <ui-icon [name]="icon()" />
    }
    <div class="upload-item__body">
      <div class="upload-item__name">{{ name() }}</div>
      @if (state() === 'error') {
        <div class="upload-item__message"><ng-content /></div>
      }
      @if (sizeText(); as size) {
        <div class="upload-item__size">{{ size }}</div>
      }
      @if (status(); as line) {
        <div class="upload-item__status">{{ line }}</div>
      }
      @if (state() === 'uploading') {
        <ui-progress
          size="sm"
          [value]="progress() ?? 0"
          [label]="progressLabel()"
        />
      }
    </div>
  `,
})
export class UploadItem {
  readonly name = input.required<string>();
  /** Size in bytes. */
  readonly size = input<number>();
  readonly state = input<UploadState>('done');
  /** What the item is doing, as one line of text under the name. */
  readonly status = input<string>();
  /** Percentage while uploading. */
  readonly progress = input<number>();
  readonly icon = input<IconName>('file-text');
  readonly progressLabel = input('Tiến trình tải lên');
  readonly errorLabel = input('Lỗi');

  protected readonly sizeText = computed(() => {
    const size = this.size();
    return size === undefined ? '' : formatBytes(size);
  });
}
