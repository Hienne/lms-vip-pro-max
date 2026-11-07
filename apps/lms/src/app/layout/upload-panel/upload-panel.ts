import { Component, inject, input } from '@angular/core';
import { Button, Icon, IconButton, Progress } from '@lms/ui';
import { ShellInsets } from '../shell-insets';
import { UploadPanelStore } from './data-access/upload-panel.store';

/**
 * "Đang tải lên (N)": the files the page is uploading in the background, beside the owl on every
 * app page. It reads the background-upload registry and nothing else about the page that
 * publishes it. Three rows at most until "Xem tất cả"; it minimises to its header.
 */
@Component({
  selector: 'app-upload-panel',
  imports: [Button, Icon, IconButton, Progress],
  providers: [UploadPanelStore],
  host: {
    '[class.upload-panel--beside-toolbar]': 'besideToolbar()',
    '[class.upload-panel--chat-open]': 'store.chatOpen$()',
    '[style.--panel-inset.px]': 'inset()',
  },
  templateUrl: './upload-panel.html',
  styleUrl: './upload-panel.scss',
})
export class UploadPanel {
  protected readonly store = inject(UploadPanelStore);
  /** Height of a bar pinned to the bottom of the page; the panel rises above it like the owl. */
  protected readonly inset = inject(ShellInsets).bottom;

  /** Moves the panel left with the owl, off the dev toolbar that is pinned to the same corner. */
  readonly besideToolbar = input(false);
}
